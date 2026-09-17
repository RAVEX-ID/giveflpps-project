// GiveFlpps — public read API.
//
// Serves the cached snapshot instantly. If no snapshot exists yet (very
// first deploy, before the scheduled job has fired even once), it runs a
// small on-demand scrape so the site isn't empty on day one, then caches
// that too. Every subsequent request just reads the cache.

const { loadSnapshot, saveSnapshot } = require("./lib/store");
const { scrapeActiveGiveaways, attachPerGameCounts } = require("./lib/scraper");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

async function bootstrapSnapshot() {
  const contact = process.env.SCRAPER_CONTACT || "";
  const userAgent = `GiveFlppsBot/1.0 (+https://github.com/; contact: ${contact || "not-set"})`;

  // Deliberately smaller than the scheduled job's default so a cold-start
  // request still returns well within a normal function timeout.
  const { giveaways, pagesOk, pagesFailed } = await scrapeActiveGiveaways({
    maxPages: parseInt(process.env.BOOTSTRAP_MAX_PAGES || "6", 10),
    concurrency: 3,
    userAgent,
  });

  const withGameCounts = attachPerGameCounts(giveaways);
  const top = [...withGameCounts].sort((a, b) => b.entries - a.entries).slice(0, 100);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    pagesScanned: pagesOk,
    pagesFailed,
    totalGiveawaysScanned: giveaways.length,
    top,
    bootstrap: true,
  };

  await saveSnapshot(snapshot);
  return snapshot;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    let snapshot = await loadSnapshot();
    if (!snapshot || !Array.isArray(snapshot.top)) {
      snapshot = await bootstrapSnapshot();
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(snapshot),
    };
  } catch (err) {
    console.error(`[GiveFlpps] get-giveaways failed: ${err.message}`);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "steamgifts_fetch_failed",
        message:
          "تعذّر جلب البيانات من SteamGifts حالياً. حاول مرة أخرى بعد قليل.",
      }),
    };
  }
};

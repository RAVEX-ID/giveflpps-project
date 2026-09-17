// GiveFlpps — public read API.
//
// Serves the cached snapshot instantly. If no snapshot exists yet (very
// first deploy, before the scheduled job has fired even once), it runs a
// small on-demand scrape so the site isn't empty on day one, then caches
// that too. Every subsequent request just reads the cache.

const { loadSnapshot, saveSnapshot } = require("./lib/store");
const {
  scrapeActiveGiveaways,
  groupGiveawaysByGame,
  rankGamesByActiveGiveaways,
} = require("./lib/scraper");

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
    maxPages: parseInt(process.env.BOOTSTRAP_MAX_PAGES || "4", 10),
    concurrency: 4,
    timeoutMs: 6000,
    userAgent,
  });

  const games = groupGiveawaysByGame(giveaways);
  const topGames = rankGamesByActiveGiveaways(games, parseInt(process.env.TOP_N || "100", 10));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    pagesScanned: pagesOk,
    pagesFailed,
    totalGiveawaysScanned: giveaways.length,
    totalGamesScanned: games.length,
    topGames,
    bootstrap: true,
  };

  // Never let a caching failure stop us from returning what we just
  // scraped — saveSnapshot() itself never throws either way.
  await saveSnapshot(snapshot);
  return snapshot;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    let snapshot = await loadSnapshot();
    if (!snapshot || !Array.isArray(snapshot.topGames)) {
      snapshot = await bootstrapSnapshot();
    }

    // Scraped fine (no exception) but found nothing at all across every
    // page — almost always means SteamGifts blocked/challenged the
    // request rather than "there are genuinely zero active giveaways".
    // Surface that distinction instead of returning an empty list that
    // looks identical to "still loading".
    if (snapshot.topGames.length === 0 && snapshot.pagesScanned === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ...snapshot,
          warning: "no_pages_scanned",
          message:
            "لم نتمكن من قراءة أي صفحة من SteamGifts في آخر محاولة (قد يكون حظراً مؤقتاً للطلبات الآلية). راجع سجلّات دالة get-giveaways في Netlify لمعرفة السبب الدقيق.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(snapshot),
    };
  } catch (err) {
    console.error(`[GiveFlpps] get-giveaways failed: ${err.stack || err.message}`);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "steamgifts_fetch_failed",
        message: err.message,
      }),
    };
  }
};

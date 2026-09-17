// GiveFlpps — scheduled sync job.
//
// Runs on a cron schedule (see the `schedule` call at the bottom, also
// mirrored in netlify.toml) and refreshes the shared snapshot that
// get-giveaways.js serves to the frontend. Keeping the scrape here — off
// the request path of actual visitors — is what makes the site feel
// instant and keeps our request volume against SteamGifts low and
// predictable.

const { schedule } = require("@netlify/functions");
const { scrapeActiveGiveaways, attachPerGameCounts } = require("./lib/scraper");
const { saveSnapshot } = require("./lib/store");

const MAX_PAGES = parseInt(process.env.SYNC_MAX_PAGES || "15", 10);
const CONCURRENCY = parseInt(process.env.SYNC_CONCURRENCY || "3", 10);
const TOP_N = parseInt(process.env.TOP_N || "100", 10);

async function runSync() {
  const startedAt = Date.now();
  const contact = process.env.SCRAPER_CONTACT || "";
  const userAgent = `GiveFlppsBot/1.0 (+https://github.com/; contact: ${contact || "not-set"})`;

  const { giveaways, pagesOk, pagesFailed } = await scrapeActiveGiveaways({
    maxPages: MAX_PAGES,
    concurrency: CONCURRENCY,
    userAgent,
  });

  const withGameCounts = attachPerGameCounts(giveaways);
  const top = [...withGameCounts]
    .sort((a, b) => b.entries - a.entries)
    .slice(0, TOP_N);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    pagesScanned: pagesOk,
    pagesFailed,
    totalGiveawaysScanned: giveaways.length,
    top,
  };

  await saveSnapshot(snapshot);
  console.log(
    `[GiveFlpps] sync ok: ${giveaways.length} giveaways scanned across ${pagesOk} pages ` +
      `(${pagesFailed} failed) in ${snapshot.durationMs}ms`
  );
  return snapshot;
}

const handler = schedule(process.env.SYNC_CRON || "*/30 * * * *", async () => {
  try {
    await runSync();
    return { statusCode: 200 };
  } catch (err) {
    console.error(`[GiveFlpps] sync failed: ${err.message}`);
    return { statusCode: 500 };
  }
});

module.exports = { handler, runSync };

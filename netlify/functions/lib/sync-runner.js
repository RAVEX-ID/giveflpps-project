// GiveFlpps — the actual "go scrape SteamGifts and save a snapshot" logic,
// kept separate from netlify/functions/sync-giveaways.js on purpose: that
// file must contain nothing but a direct `schedule(...)` call, or Netlify's
// build-time bundler can't statically detect it as a scheduled function.

const {
  scrapeActiveGiveaways,
  groupGiveawaysByGame,
  rankGamesByActiveGiveaways,
} = require("./scraper");
const { saveSnapshot } = require("./store");

const MAX_PAGES = parseInt(process.env.SYNC_MAX_PAGES || "18", 10);
const CONCURRENCY = parseInt(process.env.SYNC_CONCURRENCY || "6", 10);
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

  const games = groupGiveawaysByGame(giveaways);
  const topGames = rankGamesByActiveGiveaways(games, TOP_N);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    pagesScanned: pagesOk,
    pagesFailed,
    totalGiveawaysScanned: giveaways.length,
    totalGamesScanned: games.length,
    topGames,
  };

  // A storage hiccup shouldn't make the whole sync (or, worse, a live
  // visitor's request in get-giveaways.js) blow up — saveSnapshot() itself
  // never throws; we just note it if the write didn't succeed.
  const persisted = await saveSnapshot(snapshot);
  if (!persisted) snapshot.persisted = false;

  console.log(
    `[GiveFlpps] sync ok: ${giveaways.length} giveaways across ${games.length} games, ` +
      `${pagesOk} pages scanned (${pagesFailed} failed), in ${snapshot.durationMs}ms`
  );
  return snapshot;
}

module.exports = { runSync };

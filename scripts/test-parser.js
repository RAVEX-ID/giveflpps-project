// Sanity check for the scraping engine — run with: npm run test:parser
//
// This does NOT hit the network. It runs the exact same parseGiveawaysFromHtml()
// used in production against a bundled sample page (fixtures/sample-listing-page.html)
// and checks the numbers it extracts against known-correct values. Run this after
// `npm install` whenever you touch netlify/functions/lib/scraper.js, and again if
// SteamGifts ever redesigns their giveaway listing — a failure here is your signal
// that the href/wording patterns in scraper.js need an update (see README.md).

const fs = require("fs");
const path = require("path");
const { parseGiveawaysFromHtml } = require("../netlify/functions/lib/scraper");

const html = fs.readFileSync(
  path.join(__dirname, "..", "fixtures", "sample-listing-page.html"),
  "utf-8"
);

const rows = parseGiveawaysFromHtml(html);

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

assertEqual(rows.length, 4, "row count");

const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));

assertEqual(byCode.wg763?.entries, 507, "wg763 entries");
assertEqual(byCode.wg763?.copies, 109, "wg763 copies");
assertEqual(byCode.wg763?.points, 6, "wg763 points");
assertEqual(byCode.wg763?.comments, 4, "wg763 comments");
assertEqual(byCode.wg763?.gameCode, "eNQFR", "wg763 gameCode");
assertEqual(byCode.wg763?.creator, "MalboM", "wg763 creator");
assertEqual(byCode.wg763?.title, "Mai: Child of Ages - Storms of Time", "wg763 title");

assertEqual(byCode.qNeK9?.entries, 2442, "qNeK9 entries (comma-separated)");
assertEqual(byCode.qNeK9?.levelRequired, 0, "qNeK9 levelRequired (none stated)");
assertEqual(byCode.qNeK9?.title, "Manairons", "qNeK9 title (not the comments link)");

assertEqual(byCode.TD87Q?.levelRequired, 1, "TD87Q levelRequired");
assertEqual(byCode.TD87Q?.comments, 1, "TD87Q comments (singular wording)");

assertEqual(byCode.GnBSq?.copies, 2, "GnBSq copies");
assertEqual(byCode.GnBSq?.points, 5, "GnBSq points");
assertEqual(byCode.GnBSq?.comments, 0, "GnBSq comments (zero)");

if (process.exitCode === 1) {
  console.error("\nParser test FAILED — see README.md's troubleshooting section.");
} else {
  console.log("\nAll parser checks passed.");
}

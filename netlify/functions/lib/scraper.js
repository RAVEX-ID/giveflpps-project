// GiveFlpps — SteamGifts scraping engine
//
// Design notes (read this before "fixing" a selector):
// SteamGifts' visual template/class names can change over time, but the
// underlying URL scheme is a much more stable contract: every giveaway row
// always links to /giveaway/{code}/{slug}, its entry list at
// /giveaway/{code}/{slug}/entries, its game page at /game/{code}/{slug},
// its creator at /user/{name}, and the Steam store page. So instead of
// hard-coding CSS class names, this scraper locates rows by those href
// patterns and reads the human-readable numbers ("507 entries", "(30P)",
// "Level 2+", "3 hours remaining") straight out of the row's text. That
// makes it resilient to template/redesign changes that don't touch the
// URL scheme or the wording SteamGifts uses.
//
// If SteamGifts overhauls both the URLs and the wording at once, this will
// need updating — see README.md's "لو توقف الاستخراج" section.

const cheerio = require("cheerio");

const BASE_URL = "https://www.steamgifts.com";

const TITLE_HREF_RE = /^\/giveaway\/([A-Za-z0-9]+)\/([A-Za-z0-9-]+)\/?$/;
const GAME_HREF_RE = /^\/game\/([A-Za-z0-9]+)\/([A-Za-z0-9-]+)\/?$/;
const USER_HREF_RE = /^\/user\/([A-Za-z0-9_-]+)\/?$/;
const STEAM_APP_RE = /store\.steampowered\.com\/app\/(\d+)/;

const POINTS_RE = /\((\d+)\s*P\)/;
const COPIES_RE = /\((\d+)\s*Copies\)/i;
const LEVEL_RE = /Level\s*(\d+)\+/i;
const ENTRIES_TXT_RE = /([\d,]+)\s+entries?\b/i;
const COMMENTS_TXT_RE = /([\d,]+)\s+comments?\b/i;
const REMAINING_RE = /(\d+\s*(?:day|days|hour|hours|minute|minutes|second|seconds))\s+remaining/i;
const COMMENTS_ONLY_RE = /^\d[\d,]*\s+comments?$/i;

/**
 * Walk up from a giveaway title anchor until we find the smallest ancestor
 * that (a) references exactly one distinct giveaway and (b) also contains
 * that giveaway's "/entries" link. That ancestor is the row container.
 */
function findRowContainer($, titleEl, code) {
  const entriesPrefix = `/giveaway/${code}/`;
  let node = titleEl;
  let steps = 0;

  while (steps < 40) {
    steps += 1;
    const parent = node.parent();
    if (!parent || parent.length === 0) {
      return node; // reached the document root without a clean match; best effort
    }
    node = parent;

    const hrefsInside = new Set();
    let hasEntriesLink = false;
    node.find("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (TITLE_HREF_RE.test(href)) hrefsInside.add(href);
      if (href.startsWith(entriesPrefix) && href.endsWith("/entries")) {
        hasEntriesLink = true;
      }
    });

    if (hrefsInside.size === 1 && hasEntriesLink) {
      return node;
    }
  }
  return node; // safety valve against unexpectedly deep/cyclical trees
}

function scoreCandidate(text) {
  const trimmed = (text || "").trim();
  if (!trimmed || COMMENTS_ONLY_RE.test(trimmed)) return -1;
  return trimmed.length;
}

/**
 * Parse one SteamGifts giveaway-listing HTML page into an array of
 * normalized giveaway objects.
 */
function parseGiveawaysFromHtml(html) {
  const $ = cheerio.load(html);
  const byCode = new Map(); // code -> { el, slug, score }

  $("a").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const m = href.match(TITLE_HREF_RE);
    if (!m) return;
    const [, code, slug] = m;
    const score = scoreCandidate($el.text());
    const existing = byCode.get(code);
    if (!existing || score > existing.score) {
      byCode.set(code, { el: $el, slug, score });
    }
  });

  const results = [];

  for (const [code, { el, slug }] of byCode.entries()) {
    const row = findRowContainer($, el, code);
    const rowText = row.text().replace(/\s+/g, " ").trim();

    const pointsM = rowText.match(POINTS_RE);
    const copiesM = rowText.match(COPIES_RE);
    const levelM = rowText.match(LEVEL_RE);
    const entriesM = rowText.match(ENTRIES_TXT_RE);
    const commentsM = rowText.match(COMMENTS_TXT_RE);
    const remainingM = rowText.match(REMAINING_RE);

    let gameCode = null;
    let gameSlug = null;
    let steamAppId = null;
    let creator = null;

    row.find("a").each((_, a) => {
      const href = $(a).attr("href") || "";
      if (!gameCode) {
        const gm = href.match(GAME_HREF_RE);
        if (gm) {
          gameCode = gm[1];
          gameSlug = gm[2];
        }
      }
      if (!steamAppId) {
        const sm = href.match(STEAM_APP_RE);
        if (sm) steamAppId = sm[1];
      }
      if (!creator) {
        const um = href.match(USER_HREF_RE);
        if (um) creator = um[1];
      }
    });

    // Thumbnail image, if present, for a nicer UI (Steam header art via appid).
    const title = el.text().trim();

    results.push({
      code,
      slug,
      title,
      url: `${BASE_URL}/giveaway/${code}/${slug}`,
      points: pointsM ? parseInt(pointsM[1], 10) : null,
      copies: copiesM ? parseInt(copiesM[1], 10) : 1,
      levelRequired: levelM ? parseInt(levelM[1], 10) : 0,
      entries: entriesM ? parseInt(entriesM[1].replace(/,/g, ""), 10) : 0,
      comments: commentsM ? parseInt(commentsM[1].replace(/,/g, ""), 10) : 0,
      remainingText: remainingM ? remainingM[1].trim() : null,
      gameCode,
      gameSlug,
      steamAppId,
      steamHeaderUrl: steamAppId
        ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`
        : null,
      creator,
    });
  }

  return results;
}

/** Small helper: run async tasks with a concurrency cap, politely. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function fetchPage(pageNum, { userAgent }) {
  const url =
    pageNum <= 1
      ? `${BASE_URL}/giveaways/search?page=1`
      : `${BASE_URL}/giveaways/search?page=${pageNum}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`SteamGifts returned HTTP ${res.status} for page ${pageNum}`);
  }
  return res.text();
}

/**
 * Scrape a batch of listing pages (in ascending page order, low concurrency,
 * one distinct in-flight batch at a time) and return the deduplicated,
 * combined set of giveaways found.
 *
 * We deliberately keep this polite and modest by default: a small
 * concurrency cap and a page ceiling, since this runs as a scheduled job
 * every so often rather than per visitor.
 */
async function scrapeActiveGiveaways({
  maxPages = 15,
  concurrency = 3,
  userAgent = "GiveFlppsBot/1.0 (+https://github.com/; contact: set SCRAPER_CONTACT env var)",
} = {}) {
  const pageNumbers = Array.from({ length: maxPages }, (_, i) => i + 1);
  const byCode = new Map();
  let pagesOk = 0;
  let pagesFailed = 0;

  await mapWithConcurrency(pageNumbers, concurrency, async (pageNum) => {
    try {
      const html = await fetchPage(pageNum, { userAgent });
      const rows = parseGiveawaysFromHtml(html);
      for (const row of rows) {
        if (!byCode.has(row.code)) byCode.set(row.code, row);
      }
      pagesOk += 1;
    } catch (err) {
      pagesFailed += 1;
      // A failed page (rate limit, transient network error, etc.) shouldn't
      // take down the whole sync — we just end up with slightly fewer rows.
      console.error(`[GiveFlpps] page ${pageNum} failed: ${err.message}`);
    }
  });

  return {
    giveaways: Array.from(byCode.values()),
    pagesOk,
    pagesFailed,
  };
}

/**
 * Group giveaways by game (via the stable /game/{code}/ id) and attach an
 * `activeGiveawaysForGame` count + sibling list to every entry — this is
 * the "how many active giveaways does this game currently have" feature.
 */
function attachPerGameCounts(giveaways) {
  const byGame = new Map();
  for (const g of giveaways) {
    const key = g.gameCode || `title:${g.title.toLowerCase()}`;
    if (!byGame.has(key)) byGame.set(key, []);
    byGame.get(key).push(g.code);
  }
  return giveaways.map((g) => {
    const key = g.gameCode || `title:${g.title.toLowerCase()}`;
    const siblings = byGame.get(key) || [g.code];
    return {
      ...g,
      activeGiveawaysForGame: siblings.length,
      siblingGiveawayCodes: siblings.filter((c) => c !== g.code),
    };
  });
}

module.exports = {
  parseGiveawaysFromHtml,
  scrapeActiveGiveaways,
  attachPerGameCounts,
  findRowContainer,
};

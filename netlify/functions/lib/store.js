// GiveFlpps — persistence layer on top of Netlify Blobs.
//
// Netlify Functions are stateless between invocations, so the scheduled
// scraper writes its results here, and the public API function reads from
// here. `getStore` auto-detects the site/deploy context when run inside a
// live Netlify Function — no manual site ID or token needed.
//
// Both functions here are defensive on purpose: a Blobs outage/misconfig
// should never take down the whole site (get-giveaways.js can still return
// freshly-scraped data even if it couldn't be cached), so this module
// always resolves rather than throwing, and callers check the returned
// shape instead of relying on try/catch.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "giveflpps-data";
const SNAPSHOT_KEY = "latest-snapshot";

function store() {
  return getStore(STORE_NAME);
}

/** Resolves to true on success, false on any failure (never throws). */
async function saveSnapshot(snapshot) {
  try {
    await store().setJSON(SNAPSHOT_KEY, snapshot);
    return true;
  } catch (err) {
    console.error(`[GiveFlpps] failed to write snapshot to Blobs: ${err.message}`);
    return false;
  }
}

/** Resolves to the snapshot, or null if missing/unavailable (never throws). */
async function loadSnapshot() {
  try {
    const data = await store().get(SNAPSHOT_KEY, { type: "json" });
    return data || null;
  } catch (err) {
    console.error(`[GiveFlpps] failed to read snapshot from Blobs: ${err.message}`);
    return null;
  }
}

module.exports = { saveSnapshot, loadSnapshot };

// GiveFlpps — persistence layer on top of Netlify Blobs.
//
// Netlify Functions are stateless between invocations, so the scheduled
// scraper writes its results here, and the public API function reads from
// here. `getStore` auto-detects the site/deploy context when run inside a
// live Netlify Function — no manual site ID or token needed.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "giveflpps-data";
const SNAPSHOT_KEY = "latest-snapshot";

function store() {
  return getStore(STORE_NAME);
}

async function saveSnapshot(snapshot) {
  await store().setJSON(SNAPSHOT_KEY, snapshot);
}

async function loadSnapshot() {
  try {
    const data = await store().get(SNAPSHOT_KEY, { type: "json" });
    return data || null;
  } catch (err) {
    console.error(`[GiveFlpps] failed to read snapshot: ${err.message}`);
    return null;
  }
}

module.exports = { saveSnapshot, loadSnapshot };

// GiveFlpps — scheduled sync job.
//
// IMPORTANT: Netlify's build-time bundler statically scans this exact file
// for a direct `schedule("literal cron", fn)` call assigned to the handler
// export — that's how it registers the scheduled trigger. Don't refactor
// this into a variable, don't build the cron string dynamically (it must be
// known at build time), and don't move the export into a destructured
// `module.exports = {...}` — any of that makes the bundler report
// "the schedule helper was imported but we couldn't find any usages" and
// fail the whole build. The actual scraping logic lives in
// lib/sync-runner.js; keep this file this thin.

const { schedule } = require("@netlify/functions");
const { runSync } = require("./lib/sync-runner");

exports.handler = schedule("*/30 * * * *", async () => {
  try {
    await runSync();
    return { statusCode: 200 };
  } catch (err) {
    console.error(`[GiveFlpps] sync failed: ${err.message}`);
    return { statusCode: 500 };
  }
});

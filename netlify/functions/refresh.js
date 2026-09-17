// GiveFlpps — manual refresh endpoint.
//
// Lets you force a fresh scrape without waiting for the cron schedule —
// handy right after deploying, or while tuning MAX_PAGES. Protected by a
// shared secret (REFRESH_SECRET env var) so the public can't use it to
// spam requests at SteamGifts. If REFRESH_SECRET isn't set, this endpoint
// refuses to run at all (fails closed, not open).

const { runSync } = require("./lib/sync-runner");

exports.handler = async (event) => {
  const configuredSecret = process.env.REFRESH_SECRET;
  if (!configuredSecret) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        error: "not_configured",
        message: "REFRESH_SECRET غير مُعرّف في إعدادات الموقع، لذا هذا المسار معطّل.",
      }),
    };
  }

  const provided =
    event.queryStringParameters && event.queryStringParameters.secret;
  if (provided !== configuredSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };
  }

  try {
    const snapshot = await runSync();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: true,
        generatedAt: snapshot.generatedAt,
        totalGiveawaysScanned: snapshot.totalGiveawaysScanned,
        pagesScanned: snapshot.pagesScanned,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "sync_failed", message: err.message }),
    };
  }
};

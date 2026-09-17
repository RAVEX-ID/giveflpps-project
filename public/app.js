(function () {
  "use strict";

  const API_URL = "/api/get-giveaways";

  const listBody = document.getElementById("listBody");
  const searchInput = document.getElementById("searchInput");
  const sortButtons = document.querySelectorAll(".sort-pill button");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const pagesScannedEl = document.getElementById("pagesScanned");

  let allGames = [];
  let currentSort = "count";
  let currentQuery = "";
  const expanded = new Set(); // gameCode/title keys the user has expanded

  const numberFmt = new Intl.NumberFormat("en-US");

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function timeAgoArabic(iso) {
    if (!iso) return "غير معروف";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.round(diffMs / 60000));
    if (mins < 1) return "الآن";
    if (mins < 60) return `قبل ${mins} دقيقة`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.round(hours / 24);
    return `قبل ${days} يوم`;
  }

  function remainingToMinutes(remainingText) {
    if (!remainingText) return Number.MAX_SAFE_INTEGER;
    const m = remainingText.match(/(\d+)\s*(day|hour|minute|second)s?/i);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const n = parseInt(m[1], 10);
    const mult = { day: 1440, hour: 60, minute: 1, second: 1 / 60 }[m[2].toLowerCase()] || 1;
    return n * mult;
  }

  function remainingArabic(remainingText) {
    if (!remainingText) return "—";
    const m = remainingText.match(/(\d+)\s*(day|hour|minute|second)s?/i);
    if (!m) return remainingText;
    const n = m[1];
    const unit = m[2].toLowerCase();
    const units = { day: "يوم", hour: "ساعة", minute: "دقيقة", second: "ثانية" };
    return `${n} ${units[unit] || unit}`;
  }

  function isUrgent(remainingText) {
    return !!remainingText && /minute|second/i.test(remainingText);
  }

  function gameKey(game) {
    return game.gameCode || `title:${(game.title || "").toLowerCase()}`;
  }

  function soonestRemaining(game) {
    let best = null;
    let bestMinutes = Infinity;
    for (const g of game.giveaways) {
      const mins = remainingToMinutes(g.remainingText);
      if (mins < bestMinutes) {
        bestMinutes = mins;
        best = g.remainingText;
      }
    }
    return { text: best, minutes: bestMinutes };
  }

  function giveawayLine(g) {
    return `
      <div class="sub-row">
        <span class="ltr sub-title">${escapeHtml(g.title)}</span>
        <span class="badge points">${g.points != null ? g.points + "P" : "—"}</span>
        ${g.levelRequired > 0 ? `<span class="badge level">Lvl ${g.levelRequired}+</span>` : ""}
        ${g.copies > 1 ? `<span class="badge copies">${g.copies} نسخ</span>` : ""}
        <span class="sub-entries">${numberFmt.format(g.entries)} دخول</span>
        <span class="sub-remaining ${isUrgent(g.remainingText) ? "urgent" : ""}">${remainingArabic(g.remainingText)}</span>
        <a class="enter-btn small" href="${escapeHtml(g.url)}" target="_blank" rel="noopener">ادخل</a>
      </div>`;
  }

  function rowTemplate(game, rank) {
    const key = gameKey(game);
    const tier = rank <= 3 ? String(rank) : "";
    const soonest = soonestRemaining(game);
    const urgent = isUrgent(soonest.text);
    const img = game.steamHeaderUrl
      ? `<img class="thumb" loading="lazy" src="${escapeHtml(game.steamHeaderUrl)}" alt="" onerror="this.style.visibility='hidden'">`
      : `<span class="thumb"></span>`;

    const primaryUrl = game.gameUrl || (game.giveaways[0] && game.giveaways[0].url) || "#";
    const isExpanded = expanded.has(key);

    const levelBadge =
      game.lowestLevelRequired > 0
        ? `<span class="badge level">من Lvl ${game.lowestLevelRequired}+</span>`
        : "";
    const pointsBadge =
      game.cheapestPoints != null ? `<span class="badge points">من ${game.cheapestPoints}P</span>` : "";

    const metaLine = `
      <div class="meta-line">
        ${pointsBadge}
        ${levelBadge}
        <span class="meta-sep">·</span>
        <span>${numberFmt.format(game.totalEntries)} دخول إجمالاً</span>
      </div>`;

    const toggleOrEnter =
      game.activeGiveawaysCount > 1
        ? `<button class="enter-btn toggle-btn" data-toggle="${escapeHtml(key)}" type="button">${
            isExpanded ? "إخفاء النسخ" : `عرض ${game.activeGiveawaysCount} نسخ`
          }</button>`
        : `<a class="enter-btn" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener">ادخل</a>`;

    const statsMobile = `
      <div class="stats-mobile">
        <span>🎮 ${game.activeGiveawaysCount} نسخة نشطة</span>
        <span>${numberFmt.format(game.totalEntries)} دخول</span>
        <span class="${urgent ? "urgent" : ""}">${remainingArabic(soonest.text)}</span>
        ${toggleOrEnter}
      </div>`;

    const detailsPanel =
      game.activeGiveawaysCount > 1
        ? `<div class="game-details" data-panel="${escapeHtml(key)}" style="display:${
            isExpanded ? "block" : "none"
          }">${game.giveaways.map(giveawayLine).join("")}</div>`
        : "";

    return `
      <div class="row" data-tier="${tier}">
        <div class="rank">${rank}</div>
        ${img}
        <div class="title-cell">
          <a class="title-link ltr" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener">${escapeHtml(game.title)}</a>
          ${metaLine}
        </div>
        <div class="num-cell entries">${game.activeGiveawaysCount}<span class="unit">نسخة نشطة</span></div>
        <div class="num-cell">${numberFmt.format(game.totalEntries)}<span class="unit">دخول</span></div>
        <div class="time-cell ${urgent ? "urgent" : ""}">${remainingArabic(soonest.text)}</div>
        ${toggleOrEnter}
        ${statsMobile}
      </div>
      ${detailsPanel}`;
  }

  function applySort(games, sortKey) {
    const copy = [...games];
    switch (sortKey) {
      case "totalEntries":
        return copy.sort((a, b) => b.totalEntries - a.totalEntries);
      case "points":
        return copy.sort((a, b) => (a.cheapestPoints ?? 9999) - (b.cheapestPoints ?? 9999));
      case "remaining":
        return copy.sort((a, b) => soonestRemaining(a).minutes - soonestRemaining(b).minutes);
      case "count":
      default:
        return copy.sort(
          (a, b) => b.activeGiveawaysCount - a.activeGiveawaysCount || b.totalEntries - a.totalEntries
        );
    }
  }

  function render() {
    let games = allGames;
    if (currentQuery.trim()) {
      const q = currentQuery.trim().toLowerCase();
      games = games.filter((g) => g.title.toLowerCase().includes(q));
    }
    games = applySort(games, currentSort);

    if (games.length === 0) {
      listBody.innerHTML = `
        <div class="state-panel">
          <strong>لا توجد نتائج مطابقة</strong>
          جرّب كلمة بحث مختلفة أو امسح الفلتر.
        </div>`;
      return;
    }

    listBody.innerHTML = games.map((game, idx) => rowTemplate(game, idx + 1)).join("");
  }

  function setStatus(snapshot, ok) {
    if (!ok) {
      statusDot.classList.add("stale");
      statusText.textContent = "تعذّر التحديث — نعرض آخر بيانات متاحة إن وُجدت";
      return;
    }
    statusDot.classList.remove("stale");
    statusText.textContent = `آخر تحديث: ${timeAgoArabic(snapshot.generatedAt)}`;
    if (snapshot.pagesScanned != null) {
      pagesScannedEl.textContent = `pages scanned: ${snapshot.pagesScanned}${
        snapshot.pagesFailed ? ` (${snapshot.pagesFailed} failed)` : ""
      }`;
    }
  }

  async function load() {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      if (!Array.isArray(data.topGames)) {
        throw new Error("استجابة غير متوقعة من الخادم");
      }
      allGames = data.topGames;
      setStatus(data, true);

      if (data.warning === "no_pages_scanned") {
        listBody.innerHTML = `
          <div class="state-panel">
            <strong>لم نستطع قراءة أي بيانات من SteamGifts حالياً</strong>
            ${escapeHtml(data.message || "")}
          </div>`;
        return;
      }
      render();
    } catch (err) {
      console.error(err);
      setStatus(null, false);
      if (allGames.length === 0) {
        listBody.innerHTML = `
          <div class="state-panel">
            <strong>تعذّر جلب البيانات حالياً</strong>
            ${escapeHtml(err.message || "خطأ غير معروف")} — تحقّق من سجلّات دوال Netlify (get-giveaways) لمزيد من التفاصيل.
          </div>`;
      }
    }
  }

  searchInput.addEventListener("input", (e) => {
    currentQuery = e.target.value;
    render();
  });

  sortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sortButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      render();
    });
  });

  listBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    const key = btn.dataset.toggle;
    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
    }
    render();
  });

  load();
  setInterval(load, 5 * 60 * 1000); // soft client-side refresh; server cache does the real work
})();

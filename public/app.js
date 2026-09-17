(function () {
  "use strict";

  const API_URL = "/api/get-giveaways";

  const listBody = document.getElementById("listBody");
  const searchInput = document.getElementById("searchInput");
  const sortButtons = document.querySelectorAll(".sort-pill button");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const pagesScannedEl = document.getElementById("pagesScanned");

  let allItems = [];
  let currentSort = "entries";
  let currentQuery = "";

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

  function isUrgent(remainingText) {
    if (!remainingText) return false;
    return /minute|second/i.test(remainingText);
  }

  function remainingArabic(remainingText) {
    if (!remainingText) return "—";
    const m = remainingText.match(/(\d+)\s*(day|hour|minute|second)s?/i);
    if (!m) return remainingText;
    const n = m[1];
    const unit = m[2].toLowerCase();
    const units = {
      day: "يوم",
      hour: "ساعة",
      minute: "دقيقة",
      second: "ثانية",
    };
    return `${n} ${units[unit] || unit}`;
  }

  // Rough minutes-remaining estimate, used only for the "remaining" sort
  // (the API already ranks by entries by default).
  function remainingToMinutes(remainingText) {
    if (!remainingText) return Number.MAX_SAFE_INTEGER;
    const m = remainingText.match(/(\d+)\s*(day|hour|minute|second)s?/i);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const n = parseInt(m[1], 10);
    const mult = { day: 1440, hour: 60, minute: 1, second: 1 / 60 }[m[2].toLowerCase()] || 1;
    return n * mult;
  }

  function rowTemplate(item, rank) {
    const tier = rank <= 3 ? String(rank) : rank <= 10 ? "top10" : "";
    const urgent = isUrgent(item.remainingText);
    const img = item.steamHeaderUrl
      ? `<img class="thumb" loading="lazy" src="${escapeHtml(item.steamHeaderUrl)}" alt="" onerror="this.style.visibility='hidden'">`
      : `<span class="thumb"></span>`;

    const gameBadge =
      item.activeGiveawaysForGame > 1
        ? `<span class="badge game-count">+${item.activeGiveawaysForGame - 1} أخرى لنفس اللعبة نشطة الآن</span>`
        : "";

    const levelBadge =
      item.levelRequired > 0 ? `<span class="badge level">Lvl ${item.levelRequired}+</span>` : "";
    const copiesBadge =
      item.copies > 1 ? `<span class="badge copies">${item.copies} نسخ</span>` : "";

    const metaLine = `
      <div class="meta-line">
        <span class="ltr">${escapeHtml(item.creator || "?")}</span>
        <span class="meta-sep">·</span>
        <span>${item.comments} تعليق</span>
        ${levelBadge}
        ${copiesBadge}
        ${gameBadge}
      </div>`;

    const statsMobile = `
      <div class="stats-mobile">
        <span>🎟️ ${numberFmt.format(item.entries)}</span>
        <span class="badge points">${item.points != null ? item.points + "P" : "—"}</span>
        <span class="${urgent ? "urgent-text" : ""}">${remainingArabic(item.remainingText)}</span>
        <a class="enter-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">ادخل الآن</a>
      </div>`;

    return `
      <div class="row" data-tier="${tier}">
        <div class="rank">${rank}</div>
        ${img}
        <div class="title-cell">
          <a class="title-link ltr" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
          ${metaLine}
        </div>
        <div class="num-cell entries">${numberFmt.format(item.entries)}<span class="unit">دخول</span></div>
        <div class="num-cell"><span class="badge points">${item.points != null ? item.points + "P" : "—"}</span></div>
        <div class="time-cell ${urgent ? "urgent" : ""}">${remainingArabic(item.remainingText)}</div>
        <a class="enter-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">ادخل</a>
        ${statsMobile}
      </div>`;
  }

  function applySort(items, sortKey) {
    const copy = [...items];
    switch (sortKey) {
      case "points":
        return copy.sort((a, b) => (a.points ?? 9999) - (b.points ?? 9999));
      case "level":
        return copy.sort((a, b) => a.levelRequired - b.levelRequired);
      case "remaining":
        return copy.sort(
          (a, b) => remainingToMinutes(a.remainingText) - remainingToMinutes(b.remainingText)
        );
      case "entries":
      default:
        return copy.sort((a, b) => b.entries - a.entries);
    }
  }

  function render() {
    let items = allItems;
    if (currentQuery.trim()) {
      const q = currentQuery.trim().toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    items = applySort(items, currentSort);

    if (items.length === 0) {
      listBody.innerHTML = `
        <div class="state-panel">
          <strong>لا توجد نتائج مطابقة</strong>
          جرّب كلمة بحث مختلفة أو امسح الفلتر.
        </div>`;
      return;
    }

    listBody.innerHTML = items.map((item, idx) => rowTemplate(item, idx + 1)).join("");
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
      if (!res.ok || !Array.isArray(data.top)) {
        throw new Error(data.message || "bad response");
      }
      allItems = data.top;
      setStatus(data, true);
      render();
    } catch (err) {
      console.error(err);
      setStatus(null, false);
      if (allItems.length === 0) {
        listBody.innerHTML = `
          <div class="state-panel">
            <strong>تعذّر جلب البيانات حالياً</strong>
            قد يكون السبب تحديثاً جارياً أو ضغطاً مؤقتاً على SteamGifts. حاول تحديث الصفحة بعد قليل.
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

  load();
  setInterval(load, 5 * 60 * 1000); // soft client-side refresh; server cache does the real work
})();

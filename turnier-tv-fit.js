(() => {
  const istTv = new URLSearchParams(window.location.search).get("tv") === "true";
  if (!istTv) return;

  let skalierungGeplant = false;
  let kameraFrame = null;
  const kameraDaten = new Map();

  const clamp = (wert, min, max) => Math.min(max, Math.max(min, wert));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - (2 * t));

  function kamerafahrtPosition(fortschritt, maxLeft, maxTop) {
    const stops = [
      { p: 0, x: 0, y: 0 },
      { p: .12, x: 0, y: 0 },
      { p: .31, x: 0, y: maxTop },
      { p: .55, x: maxLeft, y: maxTop },
      { p: .78, x: maxLeft, y: 0 },
      { p: 1, x: 0, y: 0 }
    ];

    const naechsterIndex = stops.findIndex(stop => fortschritt <= stop.p);
    const ende = stops[Math.max(1, naechsterIndex)];
    const start = stops[Math.max(0, stops.indexOf(ende) - 1)];
    const span = Math.max(ende.p - start.p, .001);
    const lokal = ease(clamp((fortschritt - start.p) / span, 0, 1));
    return {
      left: lerp(start.x, ende.x, lokal),
      top: lerp(start.y, ende.y, lokal)
    };
  }

  function kameraLoop(zeit) {
    kameraDaten.forEach((daten, container) => {
      if (!document.body.contains(container)) {
        kameraDaten.delete(container);
        return;
      }

      const slide = container.closest(".tv-slide");
      if (slide && !slide.classList.contains("active")) return;

      const fortschritt = ((zeit - daten.start) % daten.dauer) / daten.dauer;
      const pos = kamerafahrtPosition(fortschritt, daten.maxLeft, daten.maxTop);
      container.scrollLeft = pos.left;
      container.scrollTop = pos.top;
    });

    kameraFrame = kameraDaten.size ? requestAnimationFrame(kameraLoop) : null;
  }

  function kameraStarten(container, maxLeft, maxTop, dauer) {
    const alt = kameraDaten.get(container);
    kameraDaten.set(container, {
      maxLeft,
      maxTop,
      dauer,
      start: alt?.start || performance.now()
    });

    if (!kameraFrame) kameraFrame = requestAnimationFrame(kameraLoop);
  }

  function kameraStoppen(container) {
    kameraDaten.delete(container);
    container.scrollLeft = 0;
    container.scrollTop = 0;
  }

  function bracketSkalieren(container) {
    const grid = container?.querySelector(".tv-bracket-grid");
    if (!container || !grid) return;

    const runden = [...grid.children];
    const maxMatches = Math.max(
      1,
      ...runden.map(runde => runde.querySelectorAll(".tv-bracket-match").length)
    );

    container.classList.toggle("dichte-kompakt", maxMatches > 10 || runden.length > 7);
    container.classList.toggle("dichte-sehr-kompakt", maxMatches > 18 || runden.length > 10);

    grid.style.setProperty("--tv-scale", "1");
    container.style.setProperty("--tv-pan-x", "0px");
    container.style.setProperty("--tv-pan-y", "0px");
    requestAnimationFrame(() => {
      const box = container.getBoundingClientRect();
      const breite = grid.scrollWidth || grid.offsetWidth || 1;
      const hoehe = grid.scrollHeight || grid.offsetHeight || 1;
      if (!box.width || !box.height) return;

      const fitScale = Math.min(box.width / breite, box.height / hoehe);
      const lesbarerScale = Math.min(1, Math.max(0.88, fitScale * 2.25));
      const scaledWidth = breite * lesbarerScale;
      const scaledHeight = hoehe * lesbarerScale;
      const panX = Math.max(0, scaledWidth - box.width);
      const panY = Math.max(0, scaledHeight - box.height);
      const panDistanz = panX + panY;
      const dauer = Math.min(42000, Math.max(22000, (panDistanz / 42) * 1000));
      const maxLeft = Math.max(0, (breite - (box.width / lesbarerScale)) - 6);
      const maxTop = Math.max(0, (hoehe - (box.height / lesbarerScale)) - 6);

      grid.style.setProperty("--tv-scale", String(lesbarerScale));
      container.style.setProperty("--tv-pan-x", `${Math.round(panX)}px`);
      container.style.setProperty("--tv-pan-y", `${Math.round(panY)}px`);
      container.style.setProperty("--tv-pan-duration", `${(dauer / 1000).toFixed(1)}s`);

      if (maxLeft > 8 || maxTop > 8) kameraStarten(container, maxLeft, maxTop, dauer);
      else kameraStoppen(container);
    });
  }

  function alleBracketSlidesSkalieren() {
    bracketSkalieren(document.getElementById("tvGewinnerbaum"));
    bracketSkalieren(document.getElementById("tvVerliererbaum"));
  }

  function skalierungPlanen() {
    if (skalierungGeplant) return;
    skalierungGeplant = true;
    requestAnimationFrame(() => {
      skalierungGeplant = false;
      alleBracketSlidesSkalieren();
    });
  }

  function starten() {
    skalierungPlanen();
    window.addEventListener("resize", skalierungPlanen, { passive: true });

    const tvAnsicht = document.getElementById("tvAnsicht");
    if (tvAnsicht) {
      new MutationObserver((mutations) => {
        const relevant = mutations.some(mutation =>
          mutation.type === "childList" ||
          (mutation.type === "attributes" && mutation.target.classList?.contains("tv-slide"))
        );
        if (relevant) skalierungPlanen();
      }).observe(tvAnsicht, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    setInterval(skalierungPlanen, 9000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", starten, { once: true });
  } else {
    starten();
  }
})();

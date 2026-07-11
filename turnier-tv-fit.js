(() => {
  const istTv = new URLSearchParams(window.location.search).get("tv") === "true";
  if (!istTv) return;

  const SLIDE_DAUER = 10000;
  let skalierungGeplant = false;
  let kameraFrame = null;
  const kameraDaten = new Map();

  const clamp = (wert, min, max) => Math.min(max, Math.max(min, wert));
  const ease = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function position(fortschritt, maxLeft, maxTop) {
    // Kurzer Halt oben, Schwerpunkt vertikal, kurzer Blick auf die rechte Finalrunde.
    const stops = maxLeft > 12
      ? [
          { p: 0.00, x: 0, y: 0 },
          { p: 0.14, x: 0, y: 0 },
          { p: 0.62, x: 0, y: maxTop },
          { p: 0.78, x: maxLeft, y: maxTop },
          { p: 0.92, x: maxLeft, y: Math.max(0, maxTop * .35) },
          { p: 1.00, x: maxLeft, y: Math.max(0, maxTop * .35) }
        ]
      : [
          { p: 0.00, x: 0, y: 0 },
          { p: 0.18, x: 0, y: 0 },
          { p: 0.82, x: 0, y: maxTop },
          { p: 1.00, x: 0, y: maxTop }
        ];

    let endeIndex = stops.findIndex(stop => fortschritt <= stop.p);
    if (endeIndex < 1) endeIndex = 1;
    const start = stops[endeIndex - 1];
    const ende = stops[endeIndex];
    const lokal = ease(clamp((fortschritt - start.p) / Math.max(.001, ende.p - start.p), 0, 1));
    return { left: lerp(start.x, ende.x, lokal), top: lerp(start.y, ende.y, lokal) };
  }

  function kameraLoop(zeit) {
    kameraDaten.forEach((daten, container) => {
      if (!document.body.contains(container)) return kameraDaten.delete(container);
      const slide = container.closest(".tv-slide");
      if (!slide?.classList.contains("active")) return;
      const fortschritt = clamp((zeit - daten.start) / daten.dauer, 0, 1);
      const pos = position(fortschritt, daten.maxLeft, daten.maxTop);
      container.scrollLeft = pos.left;
      container.scrollTop = pos.top;
    });
    kameraFrame = kameraDaten.size ? requestAnimationFrame(kameraLoop) : null;
  }

  function kameraNeuStarten(container, maxLeft, maxTop) {
    kameraDaten.set(container, {
      maxLeft,
      maxTop,
      dauer: SLIDE_DAUER - 350,
      start: performance.now()
    });
    container.scrollLeft = 0;
    container.scrollTop = 0;
    if (!kameraFrame) kameraFrame = requestAnimationFrame(kameraLoop);
  }

  function bracketSkalieren(container) {
    const grid = container?.querySelector(".tv-bracket-grid");
    if (!container || !grid) return;

    grid.style.setProperty("--tv-scale", "1");
    grid.style.setProperty("--tv-grid-width", "100%");

    requestAnimationFrame(() => {
      const box = container.getBoundingClientRect();
      const breite = Math.max(grid.scrollWidth, grid.offsetWidth, 1);
      const hoehe = Math.max(grid.scrollHeight, grid.offsetHeight, 1);
      if (!box.width || !box.height) return;

      // Breite zuerst vollständig nutzen. Nur bei extrem vielen Runden leicht verkleinern.
      const scaleBreite = Math.min(1, box.width / breite);
      const scale = clamp(scaleBreite, .72, 1);
      grid.style.setProperty("--tv-scale", String(scale));

      const sichtbareBreite = box.width / scale;
      const sichtbareHoehe = box.height / scale;
      const maxLeft = Math.max(0, breite - sichtbareBreite);
      const maxTop = Math.max(0, hoehe - sichtbareHoehe);

      container.classList.toggle("braucht-kamera", maxLeft > 8 || maxTop > 8);
      if (maxLeft > 8 || maxTop > 8) kameraNeuStarten(container, maxLeft, maxTop);
      else {
        kameraDaten.delete(container);
        container.scrollLeft = 0;
        container.scrollTop = 0;
      }
    });
  }

  function alleSkalieren() {
    bracketSkalieren(document.getElementById("tvGewinnerbaum"));
    bracketSkalieren(document.getElementById("tvVerliererbaum"));
  }

  function planen() {
    if (skalierungGeplant) return;
    skalierungGeplant = true;
    requestAnimationFrame(() => {
      skalierungGeplant = false;
      alleSkalieren();
    });
  }

  function starten() {
    planen();
    window.addEventListener("resize", planen, { passive: true });
    const tvAnsicht = document.getElementById("tvAnsicht");
    if (tvAnsicht) {
      new MutationObserver(mutations => {
        const aktiveAenderung = mutations.some(m => m.type === "attributes" && m.target.classList?.contains("tv-slide"));
        if (aktiveAenderung) {
          const aktive = document.querySelector(".tv-slide.active .tv-bracket");
          if (aktive) setTimeout(() => bracketSkalieren(aktive), 40);
        } else planen();
      }).observe(tvAnsicht, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starten, { once: true });
  else starten();
})();

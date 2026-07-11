(() => {
  const istTv = new URLSearchParams(window.location.search).get("tv") === "true";
  if (!istTv) return;

  const SLIDE_DAUER = 10000;
  const RAND = 6;

  let skalierungGeplant = false;
  let kameraFrame = null;
  const kameraDaten = new Map();

  const clamp = (wert, min, max) => Math.min(max, Math.max(min, wert));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  function zwischen(stops, fortschritt) {
    let endeIndex = stops.findIndex(stop => fortschritt <= stop.p);
    if (endeIndex < 0) endeIndex = stops.length - 1;
    if (endeIndex === 0) return { left: stops[0].x, top: stops[0].y };

    const start = stops[endeIndex - 1];
    const ende = stops[endeIndex];
    const span = Math.max(0.001, ende.p - start.p);
    const lokal = ease(clamp((fortschritt - start.p) / span, 0, 1));

    return {
      left: lerp(start.x, ende.x, lokal),
      top: lerp(start.y, ende.y, lokal)
    };
  }

  function kameraStops(maxLeft, maxTop) {
    /*
      Eine komplette Fahrt passt in genau einen 10-Sekunden-Slide:
      - kurzer Halt oben
      - zügige Fahrt nach unten
      - bei horizontalem Überstand zusätzlich zur Finalseite
      - kein langsames Abfahren jedes einzelnen Spiels
    */
    if (maxLeft > 8 && maxTop > 8) {
      return [
        { p: 0.00, x: 0,       y: 0 },
        { p: 0.12, x: 0,       y: 0 },
        { p: 0.48, x: 0,       y: maxTop },
        { p: 0.60, x: 0,       y: maxTop },
        { p: 0.84, x: maxLeft, y: maxTop },
        { p: 1.00, x: maxLeft, y: 0 }
      ];
    }

    if (maxTop > 8) {
      return [
        { p: 0.00, x: 0, y: 0 },
        { p: 0.16, x: 0, y: 0 },
        { p: 0.76, x: 0, y: maxTop },
        { p: 1.00, x: 0, y: maxTop }
      ];
    }

    if (maxLeft > 8) {
      return [
        { p: 0.00, x: 0,       y: 0 },
        { p: 0.18, x: 0,       y: 0 },
        { p: 0.82, x: maxLeft, y: 0 },
        { p: 1.00, x: maxLeft, y: 0 }
      ];
    }

    return [{ p: 0, x: 0, y: 0 }, { p: 1, x: 0, y: 0 }];
  }

  function kameraLoop(zeit) {
    kameraDaten.forEach((daten, container) => {
      if (!document.body.contains(container)) {
        kameraDaten.delete(container);
        return;
      }

      const slide = container.closest(".tv-slide");
      if (slide && !slide.classList.contains("active")) return;

      const fortschritt = clamp((zeit - daten.start) / daten.dauer, 0, 1);
      const pos = zwischen(daten.stops, fortschritt);
      container.scrollLeft = pos.left;
      container.scrollTop = pos.top;
    });

    kameraFrame = kameraDaten.size ? requestAnimationFrame(kameraLoop) : null;
  }

  function kameraStarten(container, maxLeft, maxTop) {
    container.scrollLeft = 0;
    container.scrollTop = 0;
    kameraDaten.set(container, {
      dauer: SLIDE_DAUER - 350,
      start: performance.now(),
      stops: kameraStops(maxLeft, maxTop)
    });
    if (!kameraFrame) kameraFrame = requestAnimationFrame(kameraLoop);
  }

  function kameraStoppen(container) {
    kameraDaten.delete(container);
    container.scrollLeft = 0;
    container.scrollTop = 0;
  }

  function bracketSkalieren(container, neuStarten = false) {
    const grid = container?.querySelector(".tv-bracket-grid");
    if (!container || !grid) return;

    const runden = [...grid.children];
    const maxMatches = Math.max(1, ...runden.map(runde => runde.querySelectorAll(".tv-bracket-match").length));
    container.classList.toggle("dichte-kompakt", maxMatches > 10 || runden.length > 7);
    container.classList.toggle("dichte-sehr-kompakt", maxMatches > 18 || runden.length > 10);

    grid.style.setProperty("--tv-scale", "1");

    requestAnimationFrame(() => {
      const box = container.getBoundingClientRect();
      const breite = grid.scrollWidth || grid.offsetWidth || 1;
      const hoehe = grid.scrollHeight || grid.offsetHeight || 1;
      if (!box.width || !box.height) return;

      /*
        Vorrang hat die volle TV-Breite: Alle Gewinner-Runden werden über
        den Bildschirm verteilt. Nur wenn die Schrift sonst extrem klein
        würde, bleibt ein kleiner horizontaler Kamerabereich übrig.
      */
      const breiteFit = box.width / breite;
      const mindestScale = runden.length >= 9 ? 0.64 : 0.70;
      const scale = Math.min(1, Math.max(mindestScale, breiteFit));

      grid.style.setProperty("--tv-scale", String(scale));

      requestAnimationFrame(() => {
        const sichtBreiteImGrid = box.width / scale;
        const sichtHoeheImGrid = box.height / scale;
        const maxLeft = Math.max(0, breite - sichtBreiteImGrid - RAND);
        const maxTop = Math.max(0, hoehe - sichtHoeheImGrid - RAND);

        container.style.setProperty("--tv-content-width", `${Math.ceil(breite * scale)}px`);

        const slide = container.closest(".tv-slide");
        const istAktiv = !slide || slide.classList.contains("active");
        if ((maxLeft > 8 || maxTop > 8) && (neuStarten || istAktiv)) {
          kameraStarten(container, maxLeft, maxTop);
        } else if (maxLeft <= 8 && maxTop <= 8) {
          kameraStoppen(container);
        }
      });
    });
  }

  function alleBracketSlidesSkalieren(neuStarten = false) {
    bracketSkalieren(document.getElementById("tvGewinnerbaum"), neuStarten);
    bracketSkalieren(document.getElementById("tvVerliererbaum"), neuStarten);
  }

  function skalierungPlanen(neuStarten = false) {
    if (skalierungGeplant) return;
    skalierungGeplant = true;
    requestAnimationFrame(() => {
      skalierungGeplant = false;
      alleBracketSlidesSkalieren(neuStarten);
    });
  }

  function starten() {
    skalierungPlanen(true);
    window.addEventListener("resize", () => skalierungPlanen(true), { passive: true });

    const tvAnsicht = document.getElementById("tvAnsicht");
    if (tvAnsicht) {
      new MutationObserver(mutations => {
        let slideAktiviert = false;
        let inhaltGeaendert = false;

        mutations.forEach(mutation => {
          if (mutation.type === "attributes" && mutation.target.classList?.contains("tv-slide")) {
            if (mutation.target.classList.contains("active")) slideAktiviert = true;
          }
          if (mutation.type === "childList") inhaltGeaendert = true;
        });

        if (slideAktiviert || inhaltGeaendert) skalierungPlanen(slideAktiviert);
      }).observe(tvAnsicht, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", starten, { once: true });
  } else {
    starten();
  }
})();

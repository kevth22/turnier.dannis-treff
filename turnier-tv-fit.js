(() => {
  const istTv = new URLSearchParams(window.location.search).get("tv") === "true";
  if (!istTv) return;

  let skalierungGeplant = false;

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

    grid.classList.remove("auto-pan");
    grid.style.setProperty("--tv-scale", "1");
    container.style.setProperty("--tv-pan-x", "0px");
    container.style.setProperty("--tv-pan-y", "0px");
    requestAnimationFrame(() => {
      const box = container.getBoundingClientRect();
      const breite = grid.scrollWidth || grid.offsetWidth || 1;
      const hoehe = grid.scrollHeight || grid.offsetHeight || 1;
      if (!box.width || !box.height) return;

      const fitScale = Math.min(box.width / breite, box.height / hoehe);
      const lesbarerScale = Math.min(1, Math.max(0.58, fitScale * 1.38));
      const scaledWidth = breite * lesbarerScale;
      const scaledHeight = hoehe * lesbarerScale;
      const panX = Math.max(0, scaledWidth - box.width);
      const panY = Math.max(0, scaledHeight - box.height);
      const panDistanz = panX + panY;
      const dauer = Math.min(18, Math.max(10, panDistanz / 95));

      grid.style.setProperty("--tv-scale", String(lesbarerScale));
      container.style.setProperty("--tv-pan-x", `${Math.round(panX)}px`);
      container.style.setProperty("--tv-pan-y", `${Math.round(panY)}px`);
      container.style.setProperty("--tv-pan-duration", `${dauer.toFixed(1)}s`);

      if (panX > 8 || panY > 8) {
        void grid.offsetWidth;
        grid.classList.add("auto-pan");
      }
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

    setInterval(skalierungPlanen, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", starten, { once: true });
  } else {
    starten();
  }
})();

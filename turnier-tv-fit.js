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

    grid.style.setProperty("--tv-scale", "1");
    requestAnimationFrame(() => {
      const box = container.getBoundingClientRect();
      const breite = grid.scrollWidth || grid.offsetWidth || 1;
      const hoehe = grid.scrollHeight || grid.offsetHeight || 1;
      const scale = Math.min(1, box.width / breite, box.height / hoehe);
      grid.style.setProperty("--tv-scale", String(Math.max(0.24, scale)));
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
      new MutationObserver(() => skalierungPlanen()).observe(tvAnsicht, {
        childList: true,
        subtree: true
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

const MODE_KEY = "dart11enV3TurnierModus";

function $(id) { return document.getElementById(id); }

function aktiveAnsichtSetzen(mode) {
  const gruppen = mode === "gruppenko";
  $("gruppenKonfiguration")?.classList.toggle("modus-versteckt", !gruppen);
  $("doppelKoKonfiguration")?.classList.toggle("modus-versteckt", gruppen);
  $("gruppenBereich")?.classList.toggle("modus-versteckt", !gruppen);
  $("turnierBaumBereich")?.classList.toggle("modus-versteckt", gruppen);
  const draw = $("turnierAuslosenBtn");
  if (draw) draw.textContent = gruppen ? "🎲 Gruppen auslosen" : "🎲 Live-Auslosung starten";
  const hint = $("v3StatusHinweis");
  if (hint) hint.textContent = gruppen
    ? "Aktiv: Gruppenphase + K.-o. Der Doppel-K.-o.-Stand bleibt getrennt gespeichert."
    : "Aktiv: Doppel-K.-o. Der Gruppenstand bleibt getrennt gespeichert.";
}

function resetAusloesen(scope) {
  window.dispatchEvent(new CustomEvent("dart11en:v3-reset", { detail: { scope } }));
}

document.addEventListener("DOMContentLoaded", () => {
  const mode = $("turnierModus");
  const gespeichert = localStorage.getItem(MODE_KEY) || "doppelko";
  if (mode) mode.value = gespeichert;
  aktiveAnsichtSetzen(gespeichert);

  mode?.addEventListener("change", () => {
    localStorage.setItem(MODE_KEY, mode.value);
    aktiveAnsichtSetzen(mode.value);
  }, true);

  $("turnierZuruecksetzenBtn")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const label = (localStorage.getItem(MODE_KEY) || "doppelko") === "gruppenko"
      ? "Gruppenphase, Gruppenergebnisse und K.-o.-Bäume"
      : "Doppel-K.-o.-Baum und Ergebnisse";
    if (!confirm(`${label} wirklich zurücksetzen? Die Teilnehmerliste bleibt erhalten.`)) return;
    resetAusloesen("active");
  }, true);

  $("neuesTurnierBtn")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!confirm("Beide Turniermodi samt Ergebnissen und Bäumen zurücksetzen? Die Anmeldungen bleiben zur Sicherheit erhalten.")) return;
    resetAusloesen("all");
    localStorage.setItem(MODE_KEY, "doppelko");
    if (mode) mode.value = "doppelko";
    aktiveAnsichtSetzen("doppelko");
  }, true);
});

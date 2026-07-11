window.__dart11enV3ManagerAktiv = true;
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
  $("gruppenSimulationBtn")?.classList.toggle("modus-versteckt", !gruppen);
  $("gruppenSimulationHinweis")?.classList.toggle("modus-versteckt", !gruppen);
  const tvLink = $("tvAnsichtLink");
  if (tvLink) tvLink.href = `turnier-live-v3.html?tv=true&mode=${gruppen ? "gruppenko" : "doppelko"}`;
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
  const roh = localStorage.getItem(MODE_KEY);
  const gespeichert = roh === "gruppenko" ? "gruppenko" : "doppelko";
  localStorage.setItem(MODE_KEY, gespeichert);
  if (mode) mode.value = gespeichert;
  aktiveAnsichtSetzen(gespeichert);

  const modusWechseln = () => {
    const wert = mode?.value === "gruppenko" ? "gruppenko" : "doppelko";
    localStorage.setItem(MODE_KEY, wert);
    if(mode) mode.value=wert;
    aktiveAnsichtSetzen(wert);
    mode?.blur();
    window.dispatchEvent(new CustomEvent("dart11en:v3-mode", { detail: { mode: wert } }));
  };
  mode?.addEventListener("change", modusWechseln);
  mode?.addEventListener("input", modusWechseln);

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

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { addDoc, getFirestore, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { turnierPushSynchronisieren } from "./turnier-push-sync.js";

console.log("Turnier-Center geladen");

const firebaseConfig = {
  apiKey: "AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",
  authDomain: "dannistreffturnier.firebaseapp.com",
  projectId: "dannistreffturnier",
  storageBucket: "dannistreffturnier.firebasestorage.app",
  messagingSenderId: "829873084116",
  appId: "1:829873084116:web:683bbf1ea3e58f1a4ecd41",
  measurementId: "G-QEL7FSWMLG"
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

document.addEventListener("DOMContentLoaded", () => {
  const istTvModus = new URLSearchParams(window.location.search).get("tv") === "true";
  const gespeicherterUser = localStorage.getItem("dart11enLogin");

  let aktuellerUser = null;
  let istAdmin = false;

  if (gespeicherterUser) {
    try {
      aktuellerUser = JSON.parse(gespeicherterUser);
      const rolle = (aktuellerUser?.rolle || "").toLowerCase().trim();
      istAdmin = rolle === "admin";
    } catch (e) {
      localStorage.removeItem("dart11enLogin");
      istAdmin = false;
    }
  }

  if (istAdmin) {
    document.body.classList.add("is-admin");
  } else {
    document.body.classList.remove("is-admin");

    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = "none";
    });
  }

  console.log("User:", aktuellerUser);
  console.log("Admin:", istAdmin);

  const gesamtAnzeige = document.getElementById("gesamtSpieler");
  const bezahltAnzeige = document.getElementById("bezahltSpieler");
  const anwesendAnzeige = document.getElementById("anwesendSpieler");
  const spieleBeendetAnzeige = document.getElementById("spieleBeendet");
  const spieleOffenAnzeige = document.getElementById("spieleOffen");
  const gewinnerbaumSpielerAnzeige = document.getElementById("gewinnerbaumSpieler");
  const verliererbaumSpielerAnzeige = document.getElementById("verliererbaumSpieler");
  const ausgeschiedeneSpielerAnzeige = document.getElementById("ausgeschiedeneSpieler");
  const teilnehmerListe = document.getElementById("teilnehmerListe");
  const spielerHinzufuegenForm = document.getElementById("spielerHinzufuegenForm");
  const spielerHinzufuegenMeldung = document.getElementById("spielerHinzufuegenMeldung");
  const auslosungTeilnehmer = document.getElementById("auslosungTeilnehmer");
  const auslosungFeldgroesse = document.getElementById("auslosungFeldgroesse");
  const auslosungFreilose = document.getElementById("auslosungFreilose");
  const freiloseAnzeige = document.getElementById("freilose");
  const turnierGroesseAuswahl = document.getElementById("turnierGroesse");
  const turnierGroesseHinweis = document.getElementById("turnierGroesseHinweis");
  const matchFormatAuswahl = document.getElementById("matchFormat");
  const matchFormatInfo = document.getElementById("matchFormatInfo");
  const turnierAuslosenBtn = document.getElementById("turnierAuslosenBtn");
  const turnierZuruecksetzenBtn = document.getElementById("turnierZuruecksetzenBtn");
  const spieleListe = document.getElementById("spieleListe");
  const ergebnisZurueckBtn = document.getElementById("ergebnisZurueckBtn");
  const ergebnisZurueckInfo = document.getElementById("ergebnisZurueckInfo");
  const boardAnzahlAuswahl = document.getElementById("boardAnzahl");
  const gewinnerBaum = document.getElementById("gewinnerBaum");
  const verliererBaum = document.getElementById("verliererBaum");
  const finalBaum = document.getElementById("finalBaum");
  const baumStatus = document.getElementById("baumStatus");
  const spielerSuche = document.getElementById("spielerSuche");
  const spielerAuswahl = document.getElementById("spielerAuswahl");
  const spielerInfos = document.getElementById("spielerInfos");

  let letzteTeilnehmer = [];
  let anwesendeAnzahl = 0;
  let turnierGroesse = Number(localStorage.getItem("dart11enV3TurnierGroesse")) || 16;
  let turnierDaten = JSON.parse(localStorage.getItem("dart11enV3DoppelKo") || "null");
  let bestOf = Number(localStorage.getItem("dart11enV3BestOf")) || 3;
  let boardAnzahl = Number(localStorage.getItem("dart11enV3BoardAnzahl")) || 6;
  let ergebnisHistorie = [];

  try {
    ergebnisHistorie = JSON.parse(localStorage.getItem("dart11enV3ErgebnisHistorie") || "[]");
    if (!Array.isArray(ergebnisHistorie)) ergebnisHistorie = [];
  } catch {
    ergebnisHistorie = [];
  }

  function historieSpeichern() {
    localStorage.setItem("dart11enV3ErgebnisHistorie", JSON.stringify(ergebnisHistorie));
    const anzahl = ergebnisHistorie.length;
    if (ergebnisZurueckBtn) ergebnisZurueckBtn.disabled = anzahl === 0;
    if (ergebnisZurueckInfo) {
      ergebnisZurueckInfo.textContent = anzahl
        ? `${anzahl} ${anzahl === 1 ? "Änderung" : "Änderungen"} können zurückgenommen werden.`
        : "Noch keine Änderung zum Zurücknehmen.";
    }
  }

  function ergebnisSnapshotMerken() {
    if (!turnierDaten) return;
    ergebnisHistorie.push(JSON.parse(JSON.stringify(turnierDaten)));
    if (ergebnisHistorie.length > 12) ergebnisHistorie.shift();
    historieSpeichern();
  }

  function ergebnisHistorieLeeren() {
    ergebnisHistorie = [];
    historieSpeichern();
  }

  historieSpeichern();

  if (![16, 32, 64].includes(turnierGroesse)) turnierGroesse = 32;
  if (turnierGroesseAuswahl) turnierGroesseAuswahl.value = String(turnierGroesse);
  if (matchFormatAuswahl) matchFormatAuswahl.value = String(bestOf);
  if (boardAnzahlAuswahl) boardAnzahlAuswahl.value = String(boardAnzahl);

  const siegLegs = () => Math.ceil(bestOf / 2);
  function formatInfoAktualisieren() {
    if (matchFormatInfo) matchFormatInfo.textContent = `${siegLegs()} gewonnene Legs werden zum Sieg benötigt.`;
  }
  formatInfoAktualisieren();

  function neuesMatch(id) { return { id, a: null, b: null, scoreA: null, scoreB: null }; }

  function turnierErstellen(spieler) {
    // Das gewählte Feld ist die Obergrenze. Für den tatsächlichen Baum wird
    // die kleinste passende Zweiergröße genutzt, damit nie Freilos gegen
    // Freilos angesetzt wird.
    const feldGroesse = Math.min(turnierGroesse, Math.max(2, 2 ** Math.ceil(Math.log2(spieler.length))));
    const runden = Math.log2(feldGroesse);
    const gemischt = [...spieler].sort(() => Math.random() - .5);
    const w = [];
    for (let r = 0; r < runden; r += 1) {
      w.push(Array.from({ length: feldGroesse / (2 ** (r + 1)) }, (_, i) => neuesMatch(`W${r + 1}-${i + 1}`)));
    }

    // Freilose werden bei jeder Auslosung zufällig auf verschiedene Matches
    // verteilt. So bleibt die Vergabe zufällig, ohne Freilos-gegen-Freilos.
    const ersteRunde = w[0];
    const freilosAnzahl = feldGroesse - gemischt.length;
    const freilosMatches = new Set(
      Array.from({ length: ersteRunde.length }, (_, i) => i)
        .sort(() => Math.random() - .5)
        .slice(0, freilosAnzahl)
    );
    let spielerIndex = 0;
    ersteRunde.forEach((match, matchIndex) => {
      if (freilosMatches.has(matchIndex)) {
        const spielerName = gemischt[spielerIndex++];
        if (Math.random() < .5) { match.a = spielerName; match.b = "Freilos"; }
        else { match.a = "Freilos"; match.b = spielerName; }
      } else {
        match.a = gemischt[spielerIndex++];
        match.b = gemischt[spielerIndex++];
      }
    });

    const l = [];
    for (let r = 0; r < (runden * 2) - 2; r += 1) {
      const paarStufe = Math.floor(r / 2) + 2;
      const anzahl = feldGroesse / (2 ** paarStufe);
      l.push(Array.from({ length: anzahl }, (_, i) => neuesMatch(`L${r + 1}-${i + 1}`)));
    }
    return { groesse: feldGroesse, maxGroesse: turnierGroesse, bestOf, erstellt: Date.now(), w, l, finale: [neuesMatch("F-1"), neuesMatch("F-2")] };
  }

  function ergebnisVon(match) {
    if (!match?.a && !match?.b) return null;
    if (match.a === "Freilos" && match.b === "Freilos") return { gewinner: "Freilos", verlierer: "Freilos" };
    if (match.a === "Freilos" && match.b) return { gewinner: match.b, verlierer: "Freilos" };
    if (match.b === "Freilos" && match.a) return { gewinner: match.a, verlierer: "Freilos" };
    if (!match.a || !match.b) return null;
    const ziel = siegLegs();
    if (match.scoreA === ziel && match.scoreB < ziel) return { gewinner: match.a, verlierer: match.b };
    if (match.scoreB === ziel && match.scoreA < ziel) return { gewinner: match.b, verlierer: match.a };
    return null;
  }

  function platzSetzen(match, feld, name) {
    if (!match) return;
    if (match[feld] !== name) { match[feld] = name; match.scoreA = null; match.scoreB = null; }
  }

  function wegeBerechnen() {
    if (!turnierDaten) return;
    bestOf = turnierDaten.bestOf || bestOf;
    const vorherigeErgebnisse = new Map(
      [...turnierDaten.w.flat(), ...turnierDaten.l.flat(), ...turnierDaten.finale]
        .map(m => [m.id, { a: m.a, b: m.b, scoreA: m.scoreA, scoreB: m.scoreB }])
    );
    const ergebnisWiederherstellen = (match) => {
      const alt = vorherigeErgebnisse.get(match.id);
      if (alt && alt.a === match.a && alt.b === match.b) {
        match.scoreA = alt.scoreA;
        match.scoreB = alt.scoreB;
      }
      return ergebnisVon(match);
    };
    turnierDaten.w.slice(1).flat().forEach(m => { m.a = null; m.b = null; });
    turnierDaten.l.flat().forEach(m => { m.a = null; m.b = null; });
    turnierDaten.finale.forEach(m => { m.a = null; m.b = null; });

    turnierDaten.w.forEach((runde, r) => runde.forEach((match, i) => {
      const erg = ergebnisWiederherstellen(match); if (!erg) return;
      if (r < turnierDaten.w.length - 1) platzSetzen(turnierDaten.w[r + 1][Math.floor(i / 2)], i % 2 ? "b" : "a", erg.gewinner);
      else platzSetzen(turnierDaten.finale[0], "a", erg.gewinner);
      if (r === 0) {
        platzSetzen(turnierDaten.l[0]?.[Math.floor(i / 2)], i % 2 ? "b" : "a", erg.verlierer);
      } else {
        // Crossover: Verlierer aus dem Gewinnerbaum wechseln in den
        // gegenüberliegenden Ast. So treffen sie nicht direkt erneut auf
        // jemanden aus ihrem bisherigen Gewinnerbaum-Zweig.
        const zielRunde = turnierDaten.l[(2 * r) - 1];
        if (zielRunde?.length) {
          const zielIndex = (i + Math.ceil(zielRunde.length / 2)) % zielRunde.length;
          platzSetzen(zielRunde[zielIndex], "b", erg.verlierer);
        }
      }
    }));

    turnierDaten.l.forEach((runde, r) => runde.forEach((match, i) => {
      const erg = ergebnisWiederherstellen(match); if (!erg) return;
      if (r < turnierDaten.l.length - 1) {
        const ziel = turnierDaten.l[r + 1];
        if (r % 2 === 0) platzSetzen(ziel[i], "a", erg.gewinner);
        else platzSetzen(ziel[Math.floor(i / 2)], i % 2 ? "b" : "a", erg.gewinner);
      } else platzSetzen(turnierDaten.finale[0], "b", erg.gewinner);
    }));

    const finale1 = ergebnisWiederherstellen(turnierDaten.finale[0]);
    if (finale1 && finale1.gewinner === turnierDaten.finale[0].b) {
      platzSetzen(turnierDaten.finale[1], "a", turnierDaten.finale[0].a);
      platzSetzen(turnierDaten.finale[1], "b", turnierDaten.finale[0].b);
    }
    // Das Entscheidungsspiel wird beim Neuaufbau des Baums ebenfalls geleert.
    // Sobald seine Paarung wieder feststeht, muss deshalb auch sein zuvor
    // gespeichertes Ergebnis zurückgeschrieben werden.
    ergebnisWiederherstellen(turnierDaten.finale[1]);
  }

  function matchKarte(match) {
    const karte = document.createElement("div"); karte.className = "bracket-match";
    const erg = ergebnisVon(match);
    karte.classList.add(erg ? "is-complete" : match.a && match.b ? "is-ready" : "is-waiting");
    if (match.id.startsWith("F-")) karte.classList.add("is-final");
    const id = document.createElement("span"); id.className = "bracket-match-id"; id.textContent = match.id;
    karte.appendChild(id);
    if (match.board) {
      const boardBadge = document.createElement("strong");
      boardBadge.className = "board-badge";
      boardBadge.textContent = `BOARD ${match.board}`;
      karte.appendChild(boardBadge);
    }
    [[match.a, match.scoreA], [match.b, match.scoreB]].forEach(([name, score]) => {
      const zeile = document.createElement("div"); zeile.className = "bracket-player";
      if (erg?.gewinner === name && name !== "Freilos") zeile.classList.add("winner");
      if (match.id.startsWith("L") && erg?.verlierer === name && spielerIstAusgeschieden(name)) {
        zeile.classList.add("eliminated");
        zeile.title = "Ausgeschieden";
      }
      const n = document.createElement("span"); n.textContent = name || "Noch offen";
      const s = document.createElement("b"); s.textContent = score ?? "–";
      zeile.append(n, s); karte.appendChild(zeile);
    });

    if (istAdmin && erg && match.a !== "Freilos" && match.b !== "Freilos") {
      const bearbeiten = document.createElement("button");
      bearbeiten.type = "button";
      bearbeiten.className = "bracket-ergebnis-bearbeiten";
      bearbeiten.textContent = "Ergebnis ändern";
      bearbeiten.addEventListener("click", () => {
        const ergebnisKarte = spieleListe?.querySelector(`[data-match-id="${match.id}"]`);
        if (!ergebnisKarte) return;
        ergebnisKarte.scrollIntoView({ behavior: "smooth", block: "center" });
        ergebnisKarte.classList.add("ergebnis-hervorgehoben");
        setTimeout(() => ergebnisKarte.classList.remove("ergebnis-hervorgehoben"), 1800);
      });
      karte.appendChild(bearbeiten);
    }
    return karte;
  }

  function spielerIstAusgeschieden(name) {
    if (!name || name === "Freilos") return false;
    let niederlagen = 0;
    alleTurnierMatches().forEach(match => {
      if (match.a === "Freilos" || match.b === "Freilos") return;
      if (ergebnisVon(match)?.verlierer === name) niederlagen += 1;
    });
    return niederlagen >= 2;
  }

  function baumRendern(container, runden, titelPrefix) {
    if (!container) return; container.replaceChildren();
    const grid = document.createElement("div"); grid.className = "bracket-grid";
    const groessteRunde = Math.max(1, ...runden.map(matches => matches.length));
    grid.style.setProperty("--max-matches", groessteRunde);
    runden.forEach((matches, r) => {
      const spalte = document.createElement("section");
      spalte.className = "bracket-round";

      const h = document.createElement("h4");
      const rundenName = titelPrefix === "Finale" ? "Finalspiele" : `${titelPrefix} ${r + 1}`;
      h.innerHTML = `<span>${rundenName}</span><small>${matches.length} ${matches.length === 1 ? "Spiel" : "Spiele"}</small>`;

      const spiele = document.createElement("div");
      spiele.className = "bracket-round-matches";
      matches.forEach(match => spiele.appendChild(matchKarte(match)));
      spalte.append(h, spiele);
      grid.appendChild(spalte);
    });
    container.appendChild(grid);
  }

  function ergebnisseRendern() {
    if (!spieleListe || !istAdmin) return; spieleListe.replaceChildren();
    if (!turnierDaten) { spieleListe.textContent = "Bitte zuerst das Turnier auslosen."; return; }
    const gruppen = {
      laufend: ergebnisGruppeErstellen("Laufende Spiele", "Partien mit zugewiesenem Board"),
      anstehend: ergebnisGruppeErstellen("Anstehende Partien", "Spielbereit und noch ohne freies Board"),
      beendet: ergebnisGruppeErstellen("Beendete Spiele", "Ergebnisse können weiterhin korrigiert werden")
    };
    spieleListe.append(gruppen.laufend.bereich, gruppen.anstehend.bereich, gruppen.beendet.bereich);
    const alle = [...turnierDaten.w.flat(), ...turnierDaten.l.flat(), ...turnierDaten.finale]
      .map((match, reihenfolge) => ({ match, reihenfolge }))
      .sort((a, b) => {
        if (a.match.board && b.match.board) return a.match.board - b.match.board;
        if (a.match.board) return -1;
        if (b.match.board) return 1;
        return a.reihenfolge - b.reihenfolge;
      })
      .map(eintrag => eintrag.match);
    let anstehendGesamt = 0;
    let anstehendAngezeigt = 0;
    alle.filter(m => m.a && m.b && m.a !== "Freilos" && m.b !== "Freilos").forEach(match => {
      const matchErgebnis = ergebnisVon(match);
      const box = document.createElement("article"); box.className = "ergebnis-match";
      box.dataset.matchId = match.id;
      const kopf = document.createElement("div"); kopf.className = "ergebnis-kopf";
      const matchInfo = document.createElement("span"); matchInfo.textContent = `${match.id} · Best of ${bestOf}`;
      const boardInfo = document.createElement("strong");
      boardInfo.className = match.board ? "board-badge board-badge-small" : "board-wartet";
      boardInfo.textContent = matchErgebnis ? "BEENDET" : match.board ? `BOARD ${match.board}` : "WARTET AUF BOARD";
      kopf.append(matchInfo, boardInfo);
      box.appendChild(kopf);
      const eingabe = document.createElement("div");
      eingabe.className = "ergebnis-eingabe";
      const selects = [];
      [["a", match.a, match.scoreA], ["b", match.b, match.scoreB]].forEach(([feld, name, wert]) => {
        const row = document.createElement("div"); row.className = "ergebnis-spieler"; const label = document.createElement("strong"); label.textContent = name; const select = document.createElement("select"); select.dataset.feld = feld;
        for (let i = 0; i <= siegLegs(); i += 1) { const o = document.createElement("option"); o.value = i; o.textContent = `${i} Legs`; if (wert === i) o.selected = true; select.appendChild(o); }
        row.append(label, select); eingabe.appendChild(row); selects.push(select);
      });
      const speichern = document.createElement("button"); speichern.className = "main-button ergebnis-speichern"; speichern.textContent = "Speichern";
      speichern.addEventListener("click", () => {
        const a = Number(selects[0].value), b = Number(selects[1].value), ziel = siegLegs();
        if ((a === ziel) === (b === ziel)) { alert(`Genau eine Person muss ${ziel} Legs erreicht haben.`); return; }
        const warBereitsBeendet = Boolean(matchErgebnis);
        ergebnisSnapshotMerken();
        match.scoreA = a;
        match.scoreB = b;
        wegeBerechnen();
        turnierSpeichernUndRendern();
        if (!warBereitsBeendet) {
          const sieger = a === ziel ? match.a : match.b;
          const verlierer = a === ziel ? match.b : match.a;
          const liveEvent = {
            id: `${match.id}-${Date.now()}`,
            sieger,
            verlierer,
            ergebnis: `${a}:${b}`,
            matchId: match.id,
            naechstesSpiel: naechstesSpielBestimmen(sieger, match.id),
            zeit: Date.now()
          };
          letztesLiveEventId = liveEvent.id;
          localStorage.setItem("dart11enV3TvWinnerEvent", JSON.stringify(liveEvent));
          liveEventOnlineSpeichern(liveEvent);
          siegPopupAnzeigen(liveEvent);
        }
      });
      eingabe.appendChild(speichern);
      box.appendChild(eingabe);
      const zielGruppe = matchErgebnis ? gruppen.beendet : match.board ? gruppen.laufend : gruppen.anstehend;
      if (!matchErgebnis && !match.board) {
        anstehendGesamt += 1;
        if (anstehendAngezeigt < 3) { zielGruppe.inhalt.appendChild(box); anstehendAngezeigt += 1; }
      } else zielGruppe.inhalt.appendChild(box);
    });

    if (anstehendGesamt > 3) {
      const weitere = document.createElement("p");
      weitere.className = "section-text weitere-partien-hinweis";
      weitere.textContent = `Weitere ${anstehendGesamt - 3} Partie${anstehendGesamt - 3 === 1 ? "" : "n"} warten danach.`;
      gruppen.anstehend.inhalt.appendChild(weitere);
    }

    Object.values(gruppen).forEach(gruppe => {
      if (!gruppe.inhalt.children.length) {
        const leer = document.createElement("p"); leer.className = "section-text ergebnis-gruppe-leer"; leer.textContent = "Keine Partien in diesem Bereich."; gruppe.inhalt.appendChild(leer);
      }
    });
  }

  function ergebnisGruppeErstellen(titelText, untertitelText) {
    const bereich = document.createElement("section"); bereich.className = "ergebnis-gruppe";
    const kopf = document.createElement("div"); kopf.className = "ergebnis-gruppe-kopf";
    const titel = document.createElement("h3"); titel.textContent = titelText;
    const untertitel = document.createElement("p"); untertitel.textContent = untertitelText;
    const inhalt = document.createElement("div"); inhalt.className = "ergebnis-gruppe-inhalt";
    kopf.append(titel, untertitel); bereich.append(kopf, inhalt);
    return { bereich, inhalt };
  }

  function turnierSpeichernUndRendern() {
    if (!turnierDaten) return;
    if (!turnierDaten.pushTurnierId) turnierDaten.pushTurnierId = crypto.randomUUID();
    boardsVerteilen();
    localStorage.setItem("dart11enV3DoppelKo", JSON.stringify(turnierDaten));
    turnierAnsichtRendern();
    if (istAdmin) turnierOnlineSpeichern(turnierDaten);
  }

  function turnierAnsichtRendern() {
    if (!turnierDaten) {
      gewinnerBaum?.replaceChildren();
      verliererBaum?.replaceChildren();
      finalBaum?.replaceChildren();
      spieleListe?.replaceChildren();
      if (baumStatus) baumStatus.textContent = "Der Turnierbaum wird nach der Auslosung angezeigt.";
      tvSpieleRendern();
      tvTurnierbaumRendern();
      statistikAktualisieren();
      return;
    }
    if (baumStatus) {
      const maxText = turnierDaten.maxGroesse && turnierDaten.maxGroesse !== turnierDaten.groesse
        ? ` · gewählt maximal ${turnierDaten.maxGroesse}`
        : "";
      baumStatus.textContent = `${turnierDaten.groesse}er-Feld${maxText} · Best of ${bestOf}`;
    }
    baumRendern(gewinnerBaum, turnierDaten.w, "Gewinnerrunde");
    baumRendern(verliererBaum, turnierDaten.l, "Verliererrunde");
    baumRendern(finalBaum, [turnierDaten.finale], "Finale");
    ergebnisseRendern();
    tvSpieleRendern();
    tvTurnierbaumRendern();
    statistikAktualisieren();
    if (spielerSuche?.value.trim()) spielerSucheAktualisieren();
    historieSpeichern();
  }

  async function turnierOnlineSpeichern(daten) {
    try {
      await setDoc(doc(db, "turnierLive", "aktuellesTurnierV3"), {
        daten: null,
        datenJson: daten ? JSON.stringify(daten) : null,
        pushTurnierId: daten?.pushTurnierId || null,
        aktualisiert: Date.now()
      });
      turnierPushSynchronisieren();
    } catch (fehler) {
      console.error("Der öffentliche Turnierstand konnte nicht gespeichert werden:", fehler);
    }
  }

  async function einstellungenOnlineSpeichern() {
    if (!istAdmin || istTvModus) return;
    try {
      await setDoc(doc(db, "turnierLive", "einstellungenV3"), {
        turnierGroesse,
        boardAnzahl,
        bestOf,
        turnierModus: localStorage.getItem("dart11enV3TurnierModus") || "doppelko",
        aktualisiert: Date.now()
      }, { merge: true });
    } catch (fehler) {
      console.error("Die Turniereinstellungen konnten nicht gespeichert werden:", fehler);
    }
  }

  window.addEventListener("dart11en:v3-mode", () => {
    einstellungenOnlineSpeichern();
  });

  ergebnisZurueckBtn?.addEventListener("click", () => {
    const vorherigerStand = ergebnisHistorie.pop();
    if (!vorherigerStand) return;
    turnierDaten = vorherigerStand;
    bestOf = turnierDaten.bestOf || bestOf;
    historieSpeichern();
    turnierSpeichernUndRendern();
  });

  function turnierSpielerNamen() {
    if (!turnierDaten?.w?.[0]) return [];
    return [...new Set(
      turnierDaten.w[0].flatMap(match => [match.a, match.b]).filter(name => name && name !== "Freilos")
    )].sort((a, b) => a.localeCompare(b, "de"));
  }

  function statistikAktualisieren() {
    const echteMatches = alleTurnierMatches().filter(match =>
      match.a && match.b && match.a !== "Freilos" && match.b !== "Freilos"
    );
    const beendet = echteMatches.filter(match => Boolean(ergebnisVon(match)));
    const offen = echteMatches.filter(match => !ergebnisVon(match));
    const niederlagen = new Map(turnierSpielerNamen().map(name => [name, 0]));

    beendet.forEach(match => {
      const verlierer = ergebnisVon(match)?.verlierer;
      if (verlierer && niederlagen.has(verlierer)) {
        niederlagen.set(verlierer, niederlagen.get(verlierer) + 1);
      }
    });

    const staende = [...niederlagen.values()];
    if (spieleBeendetAnzeige) spieleBeendetAnzeige.textContent = beendet.length;
    if (spieleOffenAnzeige) spieleOffenAnzeige.textContent = offen.length;
    if (gewinnerbaumSpielerAnzeige) gewinnerbaumSpielerAnzeige.textContent = staende.filter(anzahl => anzahl === 0).length;
    if (verliererbaumSpielerAnzeige) verliererbaumSpielerAnzeige.textContent = staende.filter(anzahl => anzahl === 1).length;
    if (ausgeschiedeneSpielerAnzeige) ausgeschiedeneSpielerAnzeige.textContent = staende.filter(anzahl => anzahl >= 2).length;
  }

  function spielerVerlaufRendern(name) {
    if (!spielerInfos) return;
    spielerInfos.replaceChildren();
    const spiele = alleTurnierMatches().filter(match => match.a === name || match.b === name);

    const kopf = document.createElement("div");
    kopf.className = "spieler-verlauf-kopf";
    const titel = document.createElement("h3"); titel.textContent = name;
    const info = document.createElement("p"); info.textContent = `${spiele.length} zugeordnete Partie${spiele.length === 1 ? "" : "n"}`;
    kopf.append(titel, info); spielerInfos.appendChild(kopf);

    if (!spiele.length) {
      const leer = document.createElement("p"); leer.className = "section-text"; leer.textContent = "Für diese Person ist noch keine Partie eingetragen."; spielerInfos.appendChild(leer); return;
    }

    spiele.forEach(match => {
      const erg = ergebnisVon(match);
      const gegner = match.a === name ? match.b : match.a;
      const eigenerStand = match.a === name ? match.scoreA : match.scoreB;
      const gegnerStand = match.a === name ? match.scoreB : match.scoreA;
      const karte = document.createElement("article"); karte.className = "spieler-verlauf-spiel";
      const status = document.createElement("span"); status.className = "spieler-verlauf-status";
      if (erg) {
        const gewonnen = erg.gewinner === name;
        status.textContent = gewonnen ? "Gewonnen" : "Verloren";
        status.classList.add(gewonnen ? "gewonnen" : "verloren");
      } else if (match.board) { status.textContent = `JETZT AUF BOARD ${match.board}`; status.classList.add("auf-board"); }
      else status.textContent = "Nächste Partie · wartet auf Board";
      const paarung = document.createElement("strong"); paarung.textContent = `${name} gegen ${gegner || "noch offen"}`;
      const meta = document.createElement("small");
      meta.textContent = erg ? `${match.id} · ${eigenerStand ?? 0}:${gegnerStand ?? 0} Legs` : `${match.id} · Best of ${bestOf}`;
      karte.append(status, paarung, meta); spielerInfos.appendChild(karte);
    });

    const hinweis = document.createElement("p"); hinweis.className = "section-text spieler-zukunft-hinweis";
    hinweis.textContent = "Weitere Partien werden automatisch ergänzt, sobald vorherige Ergebnisse feststehen.";
    spielerInfos.appendChild(hinweis);
  }

  function spielerSucheAktualisieren() {
    if (!spielerSuche || !spielerAuswahl) return;
    const suche = spielerSuche.value.trim().toLocaleLowerCase("de");
    spielerAuswahl.replaceChildren();
    if (!suche) { spielerInfos?.replaceChildren(); return; }

    const treffer = turnierSpielerNamen().filter(name => name.toLocaleLowerCase("de").includes(suche));
    treffer.slice(0, 8).forEach(name => {
      const button = document.createElement("button"); button.type = "button"; button.className = "spieler-suchtreffer"; button.textContent = name;
      button.addEventListener("click", () => { spielerSuche.value = name; spielerAuswahl.replaceChildren(); spielerVerlaufRendern(name); });
      spielerAuswahl.appendChild(button);
    });

    const exakt = treffer.find(name => name.toLocaleLowerCase("de") === suche);
    if (exakt) spielerVerlaufRendern(exakt);
    else if (!treffer.length) {
      const leer = document.createElement("p"); leer.className = "section-text"; leer.textContent = "Kein Spieler mit diesem Namen gefunden."; spielerAuswahl.appendChild(leer); spielerInfos?.replaceChildren();
    }
  }

  spielerSuche?.addEventListener("input", spielerSucheAktualisieren);

  function alleTurnierMatches() {
    return turnierDaten ? [...turnierDaten.w.flat(), ...turnierDaten.l.flat(), ...turnierDaten.finale] : [];
  }

  function istSpielbereit(match) {
    return Boolean(match.a && match.b && match.a !== "Freilos" && match.b !== "Freilos" && !ergebnisVon(match));
  }

  function boardsVerteilen() {
    const matches = alleTurnierMatches();
    const bereit = matches.filter(istSpielbereit);
    matches.filter(match => !istSpielbereit(match)).forEach(match => { match.board = null; });

    const belegt = new Set();
    bereit.forEach(match => {
      if (match.board >= 1 && match.board <= boardAnzahl && !belegt.has(match.board)) belegt.add(match.board);
      else match.board = null;
    });

    const frei = [];
    for (let board = 1; board <= boardAnzahl; board += 1) if (!belegt.has(board)) frei.push(board);
    bereit.filter(match => !match.board).forEach(match => { match.board = frei.shift() || null; });
  }

  function dashboardTurnierInhalteSichtbar(sichtbar) {
    ["aktuelleSpieleBereich", "naechsteSpieleBereich", "statistikBereich", "spielerBereich"].forEach(id => {
      document.getElementById(id)?.classList.toggle("modus-versteckt", !sichtbar);
    });
    if (!sichtbar) {
      document.getElementById("dashboardGruppenBereich")?.classList.add("modus-versteckt");
      document.getElementById("dashboardAktuelleSpiele")?.replaceChildren();
      document.getElementById("dashboardNaechsteSpiele")?.replaceChildren();
      document.getElementById("dashboardGruppenTabellen")?.replaceChildren();
      const aktuell = document.getElementById("aktuelleSpieleAnzahl");
      const naechste = document.getElementById("naechsteSpieleAnzahl");
      if (aktuell) aktuell.textContent = "0 Spiele";
      if (naechste) naechste.textContent = "0 Spiele";
    }
  }
  window.dart11enDashboardTurnierInhalteSichtbar = dashboardTurnierInhalteSichtbar;

  function dashboardAktuelleSpieleRendern(matches, bestOfWert) {
    const container = document.getElementById("dashboardAktuelleSpiele");
    const anzahl = document.getElementById("aktuelleSpieleAnzahl");
    const gruppenBox = document.getElementById("dashboardGruppenBereich");
    if (!container) return;
    gruppenBox?.classList.add("modus-versteckt");
    container.replaceChildren();
    const liste = matches.filter(match => match.board).sort((a,b) => a.board-b.board);
    if (anzahl) anzahl.textContent = `${liste.length} ${liste.length === 1 ? "Spiel" : "Spiele"}`;
    if (!liste.length) {
      container.innerHTML = '<div class="tv-leer">Zurzeit läuft keine Partie.</div>';
      return;
    }
    liste.forEach(match => {
      const karte = document.createElement("article");
      karte.className = "dashboard-current-match";
      const board = Math.min(8, Math.max(1, Number(match.board) || 1));
      const meta = document.createElement("div");
      meta.className = "dashboard-current-meta";
      meta.innerHTML = `<span class="dashboard-board-badge board-${board}">BOARD ${match.board}</span><small>${match.id || "Partie"} · Best of ${bestOfWert}</small>`;
      const paarung = document.createElement("div");
      paarung.className = "dashboard-current-pairing";
      paarung.innerHTML = `<strong>${match.a}</strong><span>VS</span><strong>${match.b}</strong>`;
      karte.append(meta,paarung);
      container.append(karte);
    });
  }

  function dashboardNaechsteSpieleRendern(matches, bestOfWert) {
    const container = document.getElementById("dashboardNaechsteSpiele");
    const anzahl = document.getElementById("naechsteSpieleAnzahl");
    if (!container) return;
    container.replaceChildren();
    const liste = matches.filter(match => !match.board).slice(0, 6);
    if (anzahl) anzahl.textContent = `${liste.length} ${liste.length === 1 ? "Spiel" : "Spiele"}`;
    if (!liste.length) {
      container.innerHTML = '<div class="tv-leer">Aktuell ist keine weitere spielbereite Partie vorhanden.</div>';
      return;
    }
    liste.forEach((match, index) => {
      const karte = document.createElement("article");
      karte.className = "dashboard-next-match";
      const meta = document.createElement("div");
      meta.className = "dashboard-next-meta";
      const reihenfolge = document.createElement("span");
      reihenfolge.className = "next-order-box";
      reihenfolge.textContent = `${index + 1}. NÄCHSTES`;
      const matchId = document.createElement("small");
      matchId.textContent = match.id || "Partie";
      meta.append(reihenfolge, matchId);
      const paarung = document.createElement("div");
      paarung.className = "dashboard-next-pairing";
      const a = document.createElement("strong"); a.textContent = match.a;
      const vs = document.createElement("span"); vs.textContent = "VS";
      const b = document.createElement("strong"); b.textContent = match.b;
      paarung.append(a, vs, b);
      const format = document.createElement("small");
      format.className = "dashboard-next-format";
      format.textContent = `Best of ${bestOfWert}`;
      karte.append(meta, paarung, format);
      container.appendChild(karte);
    });
  }

  function tvSpieleRendern() {
    const aktuell = document.getElementById("tvAktuelleSpiele");
    const naechste = document.getElementById("tvNaechsteSpiele");
    if (!aktuell || !naechste) return;
    aktuell.replaceChildren(); naechste.replaceChildren();
    if (!turnierDaten) {
      if ((localStorage.getItem("dart11enV3TurnierModus") || "doppelko") === "doppelko") dashboardTurnierInhalteSichtbar(false);
      const modus = new URLSearchParams(location.search).get("mode") || "auto";
      if (modus === "gruppenko" || modus === "auto") return;
      aktuell.innerHTML = '<div class="tv-leer">Das Turnier wurde noch nicht ausgelost.</div>';
      naechste.innerHTML = '<div class="tv-leer">Noch keine Partien vorhanden.</div>';
      dashboardAktuelleSpieleRendern([], bestOf);
      dashboardNaechsteSpieleRendern([], bestOf);
      return;
    }
    dashboardTurnierInhalteSichtbar(true);
    let naechsteAngezeigt = 0;
    let aktuellAngezeigt = 0;
    alleTurnierMatches().filter(istSpielbereit).sort((a, b) => {
      if (a.board && b.board) return a.board - b.board;
      if (a.board) return -1;
      if (b.board) return 1;
      return 0;
    }).forEach(match => {
      if (!match.board && naechsteAngezeigt >= 6) return;
      const zeile = document.createElement("article"); zeile.className = "tv-match-row";
      const meta = document.createElement("div"); meta.className = "tv-match-meta";
      meta.textContent = match.board ? `BOARD ${match.board}` : `ALS NÄCHSTES · ${match.id}`;
      const paarung = document.createElement("div"); paarung.className = "tv-match-paarung";
      const spielerA = document.createElement("strong"); spielerA.textContent = match.a;
      const gegen = document.createElement("span"); gegen.textContent = "VS";
      const spielerB = document.createElement("strong"); spielerB.textContent = match.b;
      paarung.append(spielerA, gegen, spielerB);
      const format = document.createElement("small"); format.textContent = `Best of ${bestOf}`;
      zeile.append(meta, paarung, format);
      (match.board ? aktuell : naechste).appendChild(zeile);
      if (match.board) aktuellAngezeigt += 1;
      else naechsteAngezeigt += 1;
    });
    if (!aktuellAngezeigt) aktuell.innerHTML = '<div class="tv-leer">Zurzeit läuft kein Spiel.</div>';
    if (!naechsteAngezeigt) naechste.innerHTML = '<div class="tv-leer">Keine weiteren spielbereiten Partien.</div>';
    dashboardAktuelleSpieleRendern(alleTurnierMatches().filter(istSpielbereit), bestOf);
    dashboardNaechsteSpieleRendern(alleTurnierMatches().filter(istSpielbereit).sort((a, b) => {
      if (a.board && b.board) return a.board - b.board;
      if (a.board) return -1;
      if (b.board) return 1;
      return String(a.id || "").localeCompare(String(b.id || ""), "de");
    }), bestOf);
  }

  function tvTurnierbaumRendern() {
    const container = document.getElementById("tvTurnierbaum");
    if (!container) return;
    container.replaceChildren();
    tvEinzelBaumRendern(document.getElementById("tvGewinnerbaum"), turnierDaten?.w || [], "Gewinnerrunde");
    tvEinzelBaumRendern(document.getElementById("tvVerliererbaum"), turnierDaten?.l || [], "Verliererrunde");
    tvFinaleRendern();
    if (!turnierDaten) {
      container.innerHTML = '<div class="tv-leer">Der Turnierbaum erscheint nach der Auslosung.</div>';
      return;
    }

    const niederlagen = new Map(turnierSpielerNamen().map(name => [name, 0]));
    alleTurnierMatches().forEach(match => {
      const verlierer = ergebnisVon(match)?.verlierer;
      if (verlierer && niederlagen.has(verlierer)) niederlagen.set(verlierer, niederlagen.get(verlierer) + 1);
    });

    const gruppen = [
      { titel: "Gewinnerbaum", klasse: "gewinner", namen: [...niederlagen].filter(([, n]) => n === 0).map(([name]) => name) },
      { titel: "Verliererbaum", klasse: "verlierer", namen: [...niederlagen].filter(([, n]) => n === 1).map(([name]) => name) },
      { titel: "Ausgeschieden", klasse: "raus", namen: [...niederlagen].filter(([, n]) => n >= 2).map(([name]) => name) }
    ];

    gruppen.forEach(gruppe => {
      const spalte = document.createElement("section"); spalte.className = `tv-baum-spalte ${gruppe.klasse}`;
      const titel = document.createElement("h3"); titel.innerHTML = `<span>${gruppe.titel}</span><b>${gruppe.namen.length}</b>`;
      const liste = document.createElement("div"); liste.className = "tv-baum-liste";
      gruppe.namen.forEach(name => {
        const chip = document.createElement("span"); chip.textContent = name; liste.appendChild(chip);
      });
      if (!gruppe.namen.length) liste.innerHTML = '<small>Keine Spieler</small>';
      spalte.append(titel, liste); container.appendChild(spalte);
    });
  }

  function tvFinaleRendern() {
    const container = document.getElementById("tvFinale");
    if (!container) return;
    container.replaceChildren();

    if (!turnierDaten?.finale?.length) {
      container.innerHTML = '<div class="tv-leer">Das Grand Final erscheint nach der Auslosung.</div>';
      return;
    }

    const finale1 = turnierDaten.finale[0];
    const finale2 = turnierDaten.finale[1];
    const erg1 = ergebnisVon(finale1);
    const erg2 = ergebnisVon(finale2);

    const kopf = document.createElement("div");
    kopf.className = "tv-finale-herkunft";
    kopf.innerHTML = `
      <div><span>Gewinner Gewinnerbaum</span><strong>${finale1.a || "Noch offen"}</strong></div>
      <b>VS</b>
      <div><span>Gewinner Verliererbaum</span><strong>${finale1.b || "Noch offen"}</strong></div>`;

    const matchKarte = (match, titel, zusatzKlasse = "") => {
      const erg = ergebnisVon(match);
      const karte = document.createElement("article");
      karte.className = `tv-grand-final-match ${zusatzKlasse}${erg ? " beendet" : ""}`.trim();
      const headline = document.createElement("div");
      headline.className = "tv-grand-final-kopf";
      headline.innerHTML = `<span>${titel}</span><small>${match.id}</small>`;
      karte.appendChild(headline);
      [[match.a, match.scoreA], [match.b, match.scoreB]].forEach(([name, score]) => {
        const zeile = document.createElement("div");
        zeile.className = "tv-grand-final-spieler";
        if (erg?.gewinner === name && name !== "Freilos") zeile.classList.add("winner");
        const spieler = document.createElement("span");
        spieler.textContent = name || "Noch offen";
        const stand = document.createElement("b");
        stand.textContent = score ?? "–";
        zeile.append(spieler, stand);
        karte.appendChild(zeile);
      });
      return karte;
    };

    const spiele = document.createElement("div");
    spiele.className = "tv-finale-spiele";
    spiele.appendChild(matchKarte(finale1, "Grand Final"));

    const resetNoetig = Boolean(finale2?.a && finale2?.b);
    if (resetNoetig || erg1?.gewinner === finale1.b) {
      spiele.appendChild(matchKarte(finale2, "Grand Final Reset", "reset"));
    } else {
      const hinweis = document.createElement("div");
      hinweis.className = "tv-reset-hinweis";
      hinweis.innerHTML = '<strong>Mögliches Reset-Finale</strong><span>Nur wenn der Gewinner des Verliererbaums das erste Grand Final gewinnt.</span>';
      spiele.appendChild(hinweis);
    }

    const status = document.createElement("div");
    status.className = "tv-finale-status";
    if (erg2?.gewinner) status.innerHTML = `<span>TURNIERSIEGER</span><strong>🏆 ${erg2.gewinner}</strong>`;
    else if (erg1?.gewinner === finale1.a) status.innerHTML = `<span>TURNIERSIEGER</span><strong>🏆 ${erg1.gewinner}</strong>`;
    else if (erg1?.gewinner === finale1.b) status.innerHTML = '<span>RESET ERFORDERLICH</span><strong>Beide Spieler haben jetzt eine Niederlage</strong>';
    else status.innerHTML = '<span>DOPPEL-K.-O.-FINALE</span><strong>Gewinnerbaum gegen Verliererbaum</strong>';

    container.append(kopf, spiele, status);
  }

  function tvEinzelBaumRendern(container, runden, titelPrefix) {
    if (!container) return;
    container.replaceChildren();
    if (!runden.length) {
      container.innerHTML = '<div class="tv-leer">Der Turnierbaum erscheint nach der Auslosung.</div>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "tv-bracket-grid";
    grid.style.setProperty("--tv-rounds", runden.length);

    runden.forEach((matches, rundeIndex) => {
      const runde = document.createElement("section");
      runde.className = "tv-bracket-round";
      const titel = document.createElement("h3");
      titel.innerHTML = `<span>${titelPrefix} ${rundeIndex + 1}</span><small>${matches.length}</small>`;
      const spiele = document.createElement("div");
      spiele.className = "tv-bracket-matches";

      matches.forEach(match => {
        const erg = ergebnisVon(match);
        const karte = document.createElement("article");
        const boardKlasse = match.board ? ` board-${Math.min(8, Math.max(1, Number(match.board) || 1))}` : "";
        karte.className = `tv-bracket-match${erg ? " beendet" : ""}${boardKlasse}`;
        const meta = document.createElement("small");
        meta.className = "tv-bracket-meta";
        const matchId = document.createElement("span");
        matchId.textContent = match.id;
        meta.appendChild(matchId);
        if (match.board) {
          const boardBadge = document.createElement("b");
          boardBadge.className = `tv-tree-board board-${Math.min(8, Math.max(1, Number(match.board) || 1))}`;
          boardBadge.textContent = `BOARD ${match.board}`;
          meta.appendChild(boardBadge);
        }
        karte.appendChild(meta);

        [[match.a, match.scoreA], [match.b, match.scoreB]].forEach(([name, score]) => {
          const zeile = document.createElement("div");
          zeile.className = "tv-bracket-player";
          if (erg?.gewinner === name && name !== "Freilos") zeile.classList.add("winner");
          if (match.id.startsWith("L") && erg?.verlierer === name && spielerIstAusgeschieden(name)) zeile.classList.add("eliminated");
          if (name === "Freilos") zeile.classList.add("freilos");
          const spieler = document.createElement("span"); spieler.textContent = name || "Noch offen";
          const stand = document.createElement("b"); stand.textContent = score ?? "–";
          zeile.append(spieler, stand); karte.appendChild(zeile);
        });
        spiele.appendChild(karte);
      });

      runde.append(titel, spiele); grid.appendChild(runde);
    });
    container.appendChild(grid);
  }

  let winnerTimer = null;
  let letztesLiveEventId = null;

  function naechstesSpielBestimmen(sieger, beendetesMatchId) {
    const bereiteSpiele = alleTurnierMatches().filter(match =>
      match.id !== beendetesMatchId && istSpielbereit(match)
    );
    const siegerSpiel = bereiteSpiele.find(match => match.a === sieger || match.b === sieger);
    const naechstes = siegerSpiel || bereiteSpiele.sort((a, b) => (a.board || 999) - (b.board || 999))[0];
    if (!naechstes) return "Noch keine nächste Paarung festgelegt.";
    const board = naechstes.board ? ` · Board ${naechstes.board}` : "";
    return `${naechstes.a} gegen ${naechstes.b}${board}`;
  }

  async function liveEventOnlineSpeichern(daten) {
    try { await setDoc(doc(db, "turnierLive", "liveEventV3"), daten); }
    catch (fehler) { console.error("Die Live-Meldung konnte nicht gespeichert werden:", fehler); }
  }

  async function auslosungEventOnlineSpeichern() {
    if (!turnierDaten?.w?.[0]) return;
    const paarungen = turnierDaten.w[0].map(match => ({
      matchId: match.id,
      spielerA: match.a || "Offen",
      spielerB: match.b || "Offen",
      board: match.board || null
    }));
    try {
      await setDoc(doc(db, "turnierLive", "auslosungEventV3"), {
        id: `auslosung-${Date.now()}`,
        zeit: Date.now(),
        paarungen
      });
    } catch (fehler) {
      console.error("Die TV-Auslosung konnte nicht gestartet werden:", fehler);
    }
  }

  let auslosungTimer = null;
  let tvDiashowIntervall = null;
  let tvDiashowStarten = () => {};
  let tvVorstartAnzeigen = () => {};
  function tvAuslosungAnzeigen(daten) {
    if (!istTvModus || !Array.isArray(daten?.paarungen) || !daten.paarungen.length) return;
    tvDiashowStarten();
    const popup = document.getElementById("drawPopup");
    const matchId = document.getElementById("drawMatchId");
    const playerA = document.getElementById("drawPlayerA");
    const playerB = document.getElementById("drawPlayerB");
    const board = document.getElementById("drawBoard");
    const progress = document.getElementById("drawProgress");
    if (!popup || !matchId || !playerA || !playerB || !board || !progress) return;

    clearTimeout(auslosungTimer);
    let index = 0;
    popup.style.display = "flex";
    popup.classList.add("show");

    const naechstePaarung = () => {
      const paarung = daten.paarungen[index];
      popup.classList.remove("reveal");
      void popup.offsetWidth;
      matchId.textContent = paarung.matchId || `PARTIE ${index + 1}`;
      playerA.textContent = paarung.spielerA || "Offen";
      playerB.textContent = paarung.spielerB || "Offen";
      board.textContent = paarung.board
        ? `BOARD ${paarung.board}`
        : (paarung.spielerA === "Freilos" || paarung.spielerB === "Freilos")
          ? "FREILOS · KEIN BOARD"
          : "BOARD WIRD SPÄTER ZUGETEILT";
      board.classList.toggle("wartet", !paarung.board);
      progress.textContent = `${index + 1} / ${daten.paarungen.length}`;
      popup.classList.add("reveal");
      index += 1;

      if (index < daten.paarungen.length) {
        auslosungTimer = setTimeout(naechstePaarung, 2600);
      } else {
        auslosungTimer = setTimeout(() => {
          popup.classList.remove("show", "reveal");
          setTimeout(() => { popup.style.display = "none"; }, 450);
        }, 3200);
      }
    };
    naechstePaarung();
  }

  function siegPopupAnzeigen(daten) {
    if (istAdmin && !istTvModus) return;
    if (!daten?.sieger) return;
    const popup = document.getElementById("winnerPopup");
    const name = document.getElementById("winnerName");
    const result = document.getElementById("winnerResult");
    const next = document.getElementById("winnerNext");
    if (!popup || !name || !result || !next) return;
    name.textContent = daten.sieger;
    result.textContent = `${daten.ergebnis} gegen ${daten.verlierer} · ${daten.matchId}`;
    next.innerHTML = `<span>ALS NÄCHSTES</span><strong>${daten.naechstesSpiel || "Noch keine nächste Paarung festgelegt."}</strong>`;
    popup.style.display = "flex";
    popup.classList.remove("show");
    requestAnimationFrame(() => popup.classList.add("show"));
    clearTimeout(winnerTimer);
    winnerTimer = setTimeout(() => {
      popup.classList.remove("show");
      setTimeout(() => { popup.style.display = "none"; }, 450);
    }, 7000);
  }

  window.addEventListener("storage", event => {
    if (event.key !== "dart11enV3TvWinnerEvent" || !event.newValue) return;
    try {
      const daten = JSON.parse(event.newValue);
      if (daten.id === letztesLiveEventId) return;
      letztesLiveEventId = daten.id;
      siegPopupAnzeigen(daten);
    } catch (fehler) {
      console.error("Die Siegeranzeige konnte nicht geöffnet werden:", fehler);
    }
  });

  function tvModusStarten() {
    document.body.classList.add("tv-mode");
    const tvAnsicht = document.getElementById("tvAnsicht");
    if (tvAnsicht) tvAnsicht.style.display = "block";

    tvSpieleRendern();
    tvTurnierbaumRendern();

    const angefragterModus = new URLSearchParams(window.location.search).get("mode")
      || localStorage.getItem("dart11enV3TurnierModus")
      || "doppelko";
    const alleSlides = [...document.querySelectorAll(".tv-slide")];
    const gruppenIds = new Set(["slideAktuelleSpiele", "slideNaechsteSpiele", "slideGruppen", "slideGruppenKo", "slideWerbung"]);
    const doppelKoIds = new Set(["slideAktuelleSpiele", "slideNaechsteSpiele", "slideTurnierbaum", "slideGewinnerbaum", "slideVerliererbaum", "slideFinale", "slideWerbung"]);
    const erlaubteIds = angefragterModus === "gruppenko" ? gruppenIds : angefragterModus === "doppelko" ? doppelKoIds : new Set([...gruppenIds, ...doppelKoIds]);
    const slides = alleSlides.filter(slide => erlaubteIds.has(slide.id));
    alleSlides.forEach(slide => { if(!erlaubteIds.has(slide.id)) slide.classList.remove("active"); });
    const status = document.getElementById("tvRotationStatus");
    let index = 0;
    const punkte = slides.map((slide, i) => {
      const punkt = document.createElement("i");
      punkt.classList.toggle("active", i === 0);
      status?.appendChild(punkt);
      return punkt;
    });
    const slideZeigen = (neu) => {
      index = neu % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
      punkte.forEach((punkt, i) => punkt.classList.toggle("active", i === index));
    };
    tvDiashowStarten = () => {
      document.body.classList.add("tv-started");
      if (status) status.style.display = "flex";
      if (tvDiashowIntervall) return;
      slideZeigen(0);
      tvDiashowIntervall = setInterval(() => slideZeigen(index + 1), 10000);
    };
    tvVorstartAnzeigen = () => {
      document.body.classList.remove("tv-started");
      if (status) status.style.display = "none";
      slides.forEach(slide => slide.classList.remove("active"));
      if (tvDiashowIntervall) clearInterval(tvDiashowIntervall);
      tvDiashowIntervall = null;
      index = 0;
    };
    tvVorstartAnzeigen();
    let gruppenDatenVorhanden = false;
    try { gruppenDatenVorhanden = Boolean(JSON.parse(localStorage.getItem("dart11enV3GruppenKo") || "null")); } catch {}
    if (gruppenDatenVorhanden || turnierDaten) tvDiashowStarten();
    window.addEventListener("dart11en:gruppen-tv-ready", () => {
      tvDiashowStarten();
    });

    const uhr = document.getElementById("tvUhrzeit");
    const uhrAktualisieren = () => {
      if (uhr) uhr.textContent = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    };
    uhrAktualisieren();
    setInterval(uhrAktualisieren, 30000);

    document.getElementById("tvVollbildBtn")?.addEventListener("click", () => {
      document.documentElement.requestFullscreen?.();
    });

    window.addEventListener("storage", event => {
      if (event.key === "dart11enV3DoppelKo") {
        try {
          turnierDaten = JSON.parse(event.newValue || "null");
          if (turnierDaten) bestOf = turnierDaten.bestOf || bestOf;
          tvSpieleRendern();
          tvTurnierbaumRendern();
          if (turnierDaten) tvDiashowStarten();
          else tvVorstartAnzeigen();
        } catch (fehler) {
          console.error("TV-Ansicht konnte nicht aktualisiert werden:", fehler);
        }
      }
    });
  }

  boardAnzahlAuswahl?.addEventListener("change", () => {
    if (!istAdmin) return;
    boardAnzahl = Number(boardAnzahlAuswahl.value);
    localStorage.setItem("dart11enV3BoardAnzahl", String(boardAnzahl));
    einstellungenOnlineSpeichern();
    if (turnierDaten) turnierSpeichernUndRendern();
  });

  matchFormatAuswahl?.addEventListener("change", () => {
    if (!istAdmin) return; bestOf = Number(matchFormatAuswahl.value); localStorage.setItem("dart11enV3BestOf", String(bestOf)); formatInfoAktualisieren();
    einstellungenOnlineSpeichern();
    if (turnierDaten) { turnierDaten.bestOf = bestOf; [...turnierDaten.w.flat(), ...turnierDaten.l.flat(), ...turnierDaten.finale].forEach(m => { m.scoreA = null; m.scoreB = null; }); wegeBerechnen(); turnierSpeichernUndRendern(); }
  });

  turnierAuslosenBtn?.addEventListener("click", () => {
    if ((localStorage.getItem("dart11enV3TurnierModus") || "doppelko") !== "doppelko") return;
    if (!istAdmin) return;
    const namen = letzteTeilnehmer.filter(p => p.anwesend === true).map(p => p.nickname || [p.vorname, p.nachname].filter(Boolean).join(" ")).filter(Boolean);
    if (namen.length < 2) { alert("Mindestens zwei anwesende Personen werden für die Auslosung benötigt."); return; }
    if (namen.length > turnierGroesse) { alert("Es sind mehr Personen anwesend als das Turnierfeld Plätze hat."); return; }
    ergebnisHistorieLeeren();
    turnierDaten = turnierErstellen(namen); wegeBerechnen(); turnierSpeichernUndRendern();
    auslosungEventOnlineSpeichern();
  });

  turnierZuruecksetzenBtn?.addEventListener("click", () => {
    if (window.__dart11enV3ManagerAktiv) return;
    if (!istAdmin) return;
    if (!confirm("Turnierbaum und alle Ergebnisse wirklich zurücksetzen?")) return;

    turnierDaten = null;
    dashboardTurnierInhalteSichtbar(false);
    ergebnisHistorieLeeren();
    localStorage.removeItem("dart11enV3DoppelKo");
    turnierAnsichtRendern();
    turnierOnlineSpeichern(null);
    setDoc(doc(db, "turnierLive", "auslosungEventV3"), {
      id: null,
      zeit: Date.now(),
      paarungen: []
    }).catch(fehler => console.error("Die TV-Auslosung konnte nicht zurückgesetzt werden:", fehler));

    if (baumStatus) {
      baumStatus.textContent = "Der Turnierbaum wurde zurückgesetzt. Du kannst neu auslosen.";
    }
  });

  if (turnierDaten) { dashboardTurnierInhalteSichtbar(true); bestOf = turnierDaten.bestOf || bestOf; if (matchFormatAuswahl) matchFormatAuswahl.value = String(bestOf); formatInfoAktualisieren(); wegeBerechnen(); turnierSpeichernUndRendern(); }
  else { dashboardTurnierInhalteSichtbar(false); statistikAktualisieren(); }
  if (istTvModus) tvModusStarten();
  if (istAdmin && !istTvModus) einstellungenOnlineSpeichern();

  function turnierZahlenAktualisieren() {
    const freilose = Math.max(turnierGroesse - anwesendeAnzahl, 0);

    if (auslosungTeilnehmer) auslosungTeilnehmer.textContent = anwesendeAnzahl;
    if (auslosungFeldgroesse) auslosungFeldgroesse.textContent = turnierGroesse;
    if (auslosungFreilose) auslosungFreilose.textContent = freilose;
    if (freiloseAnzeige) freiloseAnzeige.textContent = freilose;

    if (turnierGroesseHinweis) {
      turnierGroesseHinweis.textContent = anwesendeAnzahl > turnierGroesse
        ? `${anwesendeAnzahl - turnierGroesse} anwesende Person(en) überschreiten die gewählte Turniergröße.`
        : `${anwesendeAnzahl} anwesend · ${freilose} Freilos${freilose === 1 ? "" : "e"}`;
      turnierGroesseHinweis.classList.toggle("warnung", anwesendeAnzahl > turnierGroesse);
    }
  }

  turnierGroesseAuswahl?.addEventListener("change", () => {
    if (!istAdmin) return;
    turnierGroesse = Number(turnierGroesseAuswahl.value);
    localStorage.setItem("dart11enV3TurnierGroesse", String(turnierGroesse));
    einstellungenOnlineSpeichern();
    turnierZahlenAktualisieren();
  });

  function teilnehmerRendern() {
    if (!istAdmin || !teilnehmerListe) return;

    teilnehmerListe.replaceChildren();

    if (letzteTeilnehmer.length === 0) {
      const leer = document.createElement("p");
      leer.className = "section-text";
      leer.textContent = "Aktuell gibt es keine Anmeldungen.";
      teilnehmerListe.appendChild(leer);
      return;
    }

    letzteTeilnehmer.forEach((person) => {
      const zeile = document.createElement("article");
      zeile.className = "teilnehmer-admin-zeile";

      const name = document.createElement("div");
      name.className = "teilnehmer-name";
      const nickname = document.createElement("strong");
      nickname.textContent = person.nickname || "Ohne Spitzname";
      const klarname = document.createElement("small");
      klarname.textContent = [person.vorname, person.nachname].filter(Boolean).join(" ");
      name.append(nickname, klarname);

      const bezahltLabel = document.createElement("label");
      bezahltLabel.className = "admin-status-toggle";
      const bezahltCheck = document.createElement("input");
      bezahltCheck.type = "checkbox";
      bezahltCheck.checked = person.bezahlt === true;
      bezahltCheck.setAttribute("aria-label", `${person.nickname || "Person"} als bezahlt markieren`);
      bezahltLabel.append(bezahltCheck, document.createTextNode(" Bezahlt"));

      const anwesendLabel = document.createElement("label");
      anwesendLabel.className = "admin-status-toggle";
      const anwesendCheck = document.createElement("input");
      anwesendCheck.type = "checkbox";
      anwesendCheck.checked = person.anwesend === true;
      anwesendCheck.setAttribute("aria-label", `${person.nickname || "Person"} als anwesend markieren`);
      anwesendLabel.append(anwesendCheck, document.createTextNode(" Anwesend"));

      const loeschenButton = document.createElement("button");
      loeschenButton.type = "button";
      loeschenButton.className = "teilnehmer-loeschen-button";
      loeschenButton.textContent = "Löschen";
      loeschenButton.setAttribute("aria-label", `${person.nickname || "Person"} löschen`);

      const statusSpeichern = async (feld, wert, checkbox) => {
        checkbox.disabled = true;
        try {
          await updateDoc(doc(db, "warteschlange", person.id), { [feld]: wert });
        } catch (fehler) {
          checkbox.checked = !wert;
          console.error(`Status ${feld} konnte nicht gespeichert werden:`, fehler);
          alert("Der Status konnte nicht gespeichert werden. Bitte prüfe deine Admin-Berechtigung.");
        } finally {
          checkbox.disabled = false;
        }
      };

      bezahltCheck.addEventListener("change", () => statusSpeichern("bezahlt", bezahltCheck.checked, bezahltCheck));
      anwesendCheck.addEventListener("change", () => statusSpeichern("anwesend", anwesendCheck.checked, anwesendCheck));

      loeschenButton.addEventListener("click", async () => {
        if (!istAdmin) return;
        if (!confirm(`${person.nickname || "Diese Person"} wirklich aus den Anmeldungen löschen?`)) return;

        loeschenButton.disabled = true;
        try {
          await deleteDoc(doc(db, "warteschlange", person.id));
        } catch (fehler) {
          loeschenButton.disabled = false;
          console.error("Teilnehmer konnte nicht gelöscht werden:", fehler);
          alert("Die Person konnte nicht gelöscht werden. Bitte prüfe deine Admin-Berechtigung.");
        }
      });

      zeile.append(name, bezahltLabel, anwesendLabel, loeschenButton);
      teilnehmerListe.appendChild(zeile);
    });
  }

  spielerHinzufuegenForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!istAdmin) return;

    const nickname = document.getElementById("neuerSpielerNickname").value.trim();
    const vorname = document.getElementById("neuerSpielerVorname").value.trim();
    const nachname = document.getElementById("neuerSpielerNachname").value.trim();
    const bezahlt = document.getElementById("neuerSpielerBezahlt").checked;
    const anwesend = document.getElementById("neuerSpielerAnwesend").checked;

    if (nickname.length < 2) {
      spielerHinzufuegenMeldung.textContent = "Bitte einen Spitznamen mit mindestens zwei Zeichen eingeben.";
      return;
    }

    if (letzteTeilnehmer.some(person => (person.nickname || "").toLocaleLowerCase("de") === nickname.toLocaleLowerCase("de"))) {
      spielerHinzufuegenMeldung.textContent = "Dieser Spitzname ist bereits angemeldet.";
      return;
    }

    const button = spielerHinzufuegenForm.querySelector('button[type="submit"]');
    button.disabled = true;
    spielerHinzufuegenMeldung.textContent = "Spieler wird hinzugefügt …";

    try {
      await addDoc(collection(db, "warteschlange"), {
        nickname, vorname, nachname, bezahlt, anwesend,
        manuellHinzugefuegt: true,
        zeit: Date.now()
      });
      spielerHinzufuegenForm.reset();
      spielerHinzufuegenMeldung.textContent = `${nickname} wurde erfolgreich hinzugefügt.`;
    } catch (fehler) {
      console.error("Spieler konnte nicht hinzugefügt werden:", fehler);
      spielerHinzufuegenMeldung.textContent = "Der Spieler konnte nicht hinzugefügt werden. Bitte prüfe deine Admin-Berechtigung.";
    } finally {
      button.disabled = false;
    }
  });

  onSnapshot(doc(db, "turnierLive", "aktuellesTurnierV3"), (snapshot) => {
    if (istAdmin && !istTvModus) return;
    if (!snapshot.exists()) return;

    const snapshotDaten = snapshot.data() || {};
    let onlineDaten = snapshotDaten.daten || null;
    if (snapshotDaten.datenJson) {
      try { onlineDaten = JSON.parse(snapshotDaten.datenJson); }
      catch (fehler) { console.error("Der öffentliche Turnierstand ist ungültig:", fehler); }
    }
    turnierDaten = onlineDaten;
    if (turnierDaten) {
      bestOf = turnierDaten.bestOf || bestOf;
      turnierGroesse = turnierDaten.maxGroesse || turnierDaten.groesse || turnierGroesse;
      localStorage.setItem("dart11enV3DoppelKo", JSON.stringify(turnierDaten));
      wegeBerechnen();
    } else {
      localStorage.removeItem("dart11enV3DoppelKo");
    }
    turnierAnsichtRendern();
    if (istTvModus) {
      if (turnierDaten) tvDiashowStarten();
      else tvVorstartAnzeigen();
    }
  }, (fehler) => {
    console.error("Der öffentliche Turnierstand konnte nicht geladen werden:", fehler);
  });

  onSnapshot(doc(db, "turnierLive", "einstellungenV3"), (snapshot) => {
    if (!snapshot.exists()) return;
    const daten = snapshot.data() || {};
    const neueGroesse = Number(daten.turnierGroesse);
    const neueBoardAnzahl = Number(daten.boardAnzahl);
    const neuesBestOf = Number(daten.bestOf);
    const onlineModus = daten.turnierModus === "gruppenko" ? "gruppenko" : daten.turnierModus === "doppelko" ? "doppelko" : null;
    if (onlineModus) {
      localStorage.setItem("dart11enV3TurnierModus", onlineModus);
      if (istTvModus) {
        const url = new URL(window.location.href);
        const aktuellerTvModus = url.searchParams.get("mode");
        if (aktuellerTvModus !== onlineModus) {
          url.searchParams.set("mode", onlineModus);
          window.location.replace(url.toString());
          return;
        }
      }
    }
    if ([16, 32, 64].includes(neueGroesse)) turnierGroesse = neueGroesse;
    if (neueBoardAnzahl >= 1 && neueBoardAnzahl <= 6) boardAnzahl = neueBoardAnzahl;
    if ([1, 3, 5, 7].includes(neuesBestOf)) bestOf = neuesBestOf;
    if (turnierGroesseAuswahl) turnierGroesseAuswahl.value = String(turnierGroesse);
    if (boardAnzahlAuswahl) boardAnzahlAuswahl.value = String(boardAnzahl);
    if (matchFormatAuswahl) matchFormatAuswahl.value = String(bestOf);
    formatInfoAktualisieren();
    turnierZahlenAktualisieren();
  }, (fehler) => {
    console.error("Die Turniereinstellungen konnten nicht geladen werden:", fehler);
  });

  onSnapshot(doc(db, "turnierLive", "liveEventV3"), (snapshot) => {
    if (!snapshot.exists()) return;
    const daten = snapshot.data();
    if (!daten?.id || daten.id === letztesLiveEventId) return;
    letztesLiveEventId = daten.id;
    if (Date.now() - Number(daten.zeit || 0) <= 15000) siegPopupAnzeigen(daten);
  }, (fehler) => {
    console.error("Live-Meldungen konnten nicht geladen werden:", fehler);
  });

  window.addEventListener("dart11en:v3-reset", (event) => {
    const scope = event.detail?.scope || "active";
    const activeMode = localStorage.getItem("dart11enV3TurnierModus") || "doppelko";
    if (scope === "active" && activeMode !== "doppelko") return;
    turnierDaten = null;
    ergebnisHistorieLeeren();
    localStorage.removeItem("dart11enV3DoppelKo");
    turnierAnsichtRendern();
    turnierOnlineSpeichern(null);
    if (baumStatus) baumStatus.textContent = "Der Doppel-K.-o.-Baum wurde zurückgesetzt.";
  });

  onSnapshot(doc(db, "turnierLive", "auslosungEventV3"), (snapshot) => {
    if (!istTvModus || !snapshot.exists()) return;
    const daten = snapshot.data();
    if (!daten?.id) {
      tvVorstartAnzeigen();
      return;
    }
    tvDiashowStarten();
    if (Date.now() - Number(daten.zeit || 0) <= 30000) tvAuslosungAnzeigen(daten);
  }, (fehler) => {
    console.error("Die TV-Auslosung konnte nicht geladen werden:", fehler);
  });

  onSnapshot(collection(db, "warteschlange"), (snapshot) => {
    let bezahlt = 0;
    let anwesend = 0;
    letzteTeilnehmer = [];

    snapshot.forEach((dokument) => {
      const person = { id: dokument.id, ...dokument.data() };
      letzteTeilnehmer.push(person);
      if (person.bezahlt === true) bezahlt += 1;
      if (person.anwesend === true) anwesend += 1;
    });

    letzteTeilnehmer.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "", "de"));

    // Alle Einträge = bezahlte Personen + Personen in der Warteschlange.
    if (gesamtAnzeige) gesamtAnzeige.textContent = snapshot.size;
    if (bezahltAnzeige) bezahltAnzeige.textContent = bezahlt;
    if (anwesendAnzeige) anwesendAnzeige.textContent = anwesend;
    anwesendeAnzahl = anwesend;
    turnierZahlenAktualisieren();
    teilnehmerRendern();
  }, (fehler) => {
    console.error("Anmeldungen konnten nicht geladen werden:", fehler);
  });
});

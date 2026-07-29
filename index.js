import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getLogin } from "./auth-utils.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",
  authDomain: "dannistreffturnier.firebaseapp.com",
  projectId: "dannistreffturnier",
  storageBucket: "dannistreffturnier.firebasestorage.app",
  messagingSenderId: "829873084116",
  appId: "1:829873084116:web:683bbf1ea3e58f1a4ecd41"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

function closeVotePopup() {
  const popup = document.getElementById("votePopup");
  if (popup) popup.style.display = "none";
}

window.closeVotePopup = closeVotePopup;

async function checkVotePopup() {
  const popup = document.getElementById("votePopup");
  if (!popup) return;

  const user = getLogin();
  if (!user) return;

  const rolle = String(user.rolle || "").toLowerCase().trim();
  const benutzername = String(user.benutzername || "").trim();
  const erlaubteRollen = ["mitglied", "captain", "admin"];

  // Registrierte Gäste erhalten ausdrücklich keine Spieltagsbenachrichtigungen.
  if (!benutzername || !erlaubteRollen.includes(rolle)) return;

  try {
    const spieltageSnap = await getDocs(collection(db, "spieltage"));
    let spieltage = [];

    spieltageSnap.forEach(docSnap => {
      spieltage.push({ id: docSnap.id, ...docSnap.data() });
    });

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const in7Tagen = new Date(heute);
    in7Tagen.setDate(heute.getDate() + 7);
    in7Tagen.setHours(23, 59, 59, 999);

    spieltage = spieltage
      .filter(spieltag => {
        const datum = new Date(spieltag.datum);
        datum.setHours(0, 0, 0, 0);
        return datum >= heute && datum <= in7Tagen;
      })
      .sort((a, b) => new Date(a.datum) - new Date(b.datum));

    let offenerSpieltag = null;

    for (const spieltag of spieltage) {
      const zusageId = `${spieltag.id}_${benutzername}`;
      const zusageSnap = await getDoc(doc(db, "zusagen", zusageId));
      if (!zusageSnap.exists()) {
        offenerSpieltag = spieltag;
        break;
      }
    }

    if (!offenerSpieltag) return;

    const popupText = document.getElementById("votePopupText");
    const gegnerText = offenerSpieltag.typ === "heim"
      ? `Dart11en : ${offenerSpieltag.ort}`
      : `${offenerSpieltag.ort} : Dart11en`;

    popupText.innerHTML = `
      Du hast für diesen Spieltag noch keine Verfügbarkeit angegeben:<br><br>
      <strong>${offenerSpieltag.liga}</strong><br>
      ${gegnerText}<br>
      ${offenerSpieltag.datum}<br>
      Treffen: ${offenerSpieltag.treffen || "-"}<br>
      Anwurf: ${offenerSpieltag.anwurf}
    `;

    popup.style.display = "flex";
  } catch (error) {
    console.error("Spieltag-Popup konnte nicht geprüft werden:", error);
  }
}

document.addEventListener("DOMContentLoaded", checkVotePopup);


function normalisiereVergleichswert(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function istEigeneTurnieranmeldung(data, user) {
  const benutzername = normalisiereVergleichswert(user?.benutzername);
  const nickname = normalisiereVergleichswert(user?.nickname);
  const vollerName = normalisiereVergleichswert(
    [user?.vorname, user?.nachname].filter(Boolean).join(" ")
  );

  const gespeicherteKonten = [
    data.kontoBenutzername,
    data.mitgliedId,
    data.benutzername,
    data.kontoId
  ].map(normalisiereVergleichswert).filter(Boolean);

  if (benutzername && gespeicherteKonten.includes(benutzername)) return true;

  // Übergang für ältere Anmeldungen, bei denen noch keine Konto-ID gespeichert wurde.
  const anmeldungsNickname = normalisiereVergleichswert(data.nickname);
  const anmeldungsName = normalisiereVergleichswert(
    [data.vorname, data.nachname].filter(Boolean).join(" ")
  );

  return Boolean(
    (nickname && anmeldungsNickname === nickname)
    || (benutzername && anmeldungsNickname === benutzername)
    || (vollerName && anmeldungsName === vollerName)
  );
}

async function eigeneTurnieranmeldungLaden(user) {
  const snap = await getDocs(collection(db, "warteschlange"));
  let eigenerEintrag = null;

  snap.forEach(d => {
    if (eigenerEintrag) return;
    const data = d.data();
    if (istEigeneTurnieranmeldung(data, user)) {
      eigenerEintrag = { id: d.id, ...data };
    }
  });

  return eigenerEintrag;
}

function turnierAnwesenheitImDashboard() {
  const card = document.getElementById("turnierAnwesenheitCard");
  const text = document.getElementById("turnierAnwesenheitText");
  const button = document.getElementById("turnierAnwesenheitBtn");
  const user = getLogin();

  if (!card || !text || !button || !user?.benutzername) return;

  let ladeNummer = 0;

  const statusRef = doc(db, "turnierLive", "steuerungV4");
  onSnapshot(statusRef, async statusSnap => {
    const aktuelleLadeNummer = ++ladeNummer;
    const status = String(statusSnap.data()?.status || "vorbereitung").toLowerCase();

    // Die Selbstbestätigung ist ausschließlich während der Anmeldephase möglich.
    if (status !== "anmeldung") {
      card.hidden = true;
      button.disabled = false;
      button.onclick = null;
      return;
    }

    try {
      const eigenerEintrag = await eigeneTurnieranmeldungLaden(user);
      if (aktuelleLadeNummer !== ladeNummer) return;

      if (!eigenerEintrag) {
        card.hidden = true;
        return;
      }

      card.hidden = false;
      const anzeigename = eigenerEintrag.nickname || user.nickname || user.benutzername;

      if (eigenerEintrag.anwesend === true) {
        text.textContent = `Du bist für das Turnier als anwesend bestätigt (${anzeigename}).`;
        button.textContent = "Anwesenheit bestätigt ✓";
        button.disabled = true;
        button.onclick = null;
        return;
      }

      text.textContent = `Die Anmeldung ist geöffnet. Bestätige hier deine Anwesenheit als ${anzeigename}.`;
      button.textContent = "Ich bin anwesend";
      button.disabled = false;

      button.onclick = async () => {
        button.disabled = true;
        try {
          await updateDoc(doc(db, "warteschlange", eigenerEintrag.id), {
            anwesend: true,
            anwesenheitBestaetigtAm: Date.now(),
            anwesenheitBestaetigtVon: user.benutzername,
            kontoBenutzername: eigenerEintrag.kontoBenutzername || user.benutzername,
            mitgliedId: eigenerEintrag.mitgliedId || user.benutzername
          });
          text.textContent = "Deine Anwesenheit wurde bestätigt.";
          button.textContent = "Anwesenheit bestätigt ✓";
          button.onclick = null;
        } catch (error) {
          console.error("Turnier-Anwesenheit konnte nicht gespeichert werden:", error);
          button.disabled = false;
          alert("Die Anwesenheit konnte nicht gespeichert werden. Bitte prüfe deine Verbindung oder Berechtigung.");
        }
      };
    } catch (error) {
      console.error("Turnieranmeldung konnte im Dashboard nicht geprüft werden:", error);
      card.hidden = true;
    }
  }, error => {
    console.error("Turnierstatus konnte im Dashboard nicht geladen werden:", error);
    card.hidden = true;
  });
}

document.addEventListener("DOMContentLoaded", turnierAnwesenheitImDashboard);

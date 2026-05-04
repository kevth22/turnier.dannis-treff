import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",
  authDomain: "dannistreffturnier.firebaseapp.com",
  projectId: "dannistreffturnier",
  storageBucket: "dannistreffturnier.firebasestorage.app",
  messagingSenderId: "829873084116",
  appId: "1:829873084116:web:683bbf1ea3e58f1a4ecd41"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const spieltageRef = collection(db, "spieltage");
const zusagenRef = collection(db, "zusagen");
let zusagen = [];

let aktuellerUser = null;
let spieltage = [];
let aktuellesDatum = new Date();

window.login = async function () {
  const userInput = document.getElementById("loginUser").value.trim();
  const passInput = document.getElementById("loginPass").value.trim();

  if (!userInput || !passInput) {
    alert("Bitte Benutzername und Passwort eingeben");
    return;
  }

  const snapshot = await getDocs(collection(db, "mitglieder"));
  let gefunden = null;

  snapshot.forEach((doc) => {
    const data = doc.data();

    if (data.benutzername === userInput && data.passwort === passInput) {
      gefunden = data;
    }
  });

  if (gefunden) {
    aktuellerUser = gefunden;
    sessionStorage.setItem("user", JSON.stringify(gefunden));

    document.getElementById("loginBox").style.display = "none";
    document.getElementById("kalenderBereich").style.display = "block";

    if (gefunden.rolle === "admin") {
      document.getElementById("adminSpieltagBox").style.display = "block";
    }

    kalenderZeichnen();
  } else {
    document.getElementById("loginFehler").style.display = "block";
  }
};
  function spieltagListeAnzeigen() {
  const liste = document.getElementById("spieltagListe");
  if (!liste) return;

  liste.innerHTML = "";

  const jahr = aktuellesDatum.getFullYear();
  const monat = aktuellesDatum.getMonth() + 1;

  const relevanteSpieltage = spieltage.filter(s => {
    const [y, m] = s.datum.split("-");
    return parseInt(y) === jahr && parseInt(m) === monat;
  });

  if (relevanteSpieltage.length === 0) {
    liste.innerHTML = "<p>Keine Spieltage in diesem Monat.</p>";
    return;
  }

  relevanteSpieltage.forEach(spieltag => {
    const card = document.createElement("div");
    card.classList.add("spieltag-card");

    card.innerHTML = `
      <h4>${spieltag.liga}</h4>
      <div class="spieltag-meta">
        📅 ${spieltag.datum} <br>
        ⏰ Anwurf: ${spieltag.anwurf} <br>
        🕒 Treffen: ${spieltag.treffen || "-"} <br>
        📍 ${spieltag.ort} <br>
        ${spieltag.typ === "heim" ? "🏠 Heimspiel" : "🚗 Auswärtsspiel"}
      </div>

      <div class="spieltag-actions">
        <button onclick="zeigeSpieltag('${spieltag.id}')">Details</button>
      </div>
    `;

    liste.appendChild(card);
  });
}
window.spieltagSpeichern = async function () {
  const liga = document.getElementById("spieltagLiga").value.trim();
  const datum = document.getElementById("spieltagDatum").value;
  const treffen = document.getElementById("spieltagTreffen").value;
  const anwurf = document.getElementById("spieltagAnwurf").value;
  const ort = document.getElementById("spieltagOrt").value.trim();
  const typ = document.getElementById("spieltagTyp").value;

  if (!liga || !datum || !anwurf || !ort) {
    alert("Bitte Liga, Datum, Anwurf und Ort ausfüllen.");
    return;
  }

  await addDoc(spieltageRef, {
    liga,
    datum,
    treffen,
    anwurf,
    ort,
    typ,
    erstelltAm: serverTimestamp()
  });

  document.getElementById("spieltagLiga").value = "";
  document.getElementById("spieltagDatum").value = "";
  document.getElementById("spieltagTreffen").value = "";
  document.getElementById("spieltagAnwurf").value = "";
  document.getElementById("spieltagOrt").value = "";

  alert("Spieltag gespeichert.");
};

onSnapshot(spieltageRef, (snapshot) => {
  spieltage = [];

  snapshot.forEach((doc) => {
    spieltage.push({
      id: doc.id,
      ...doc.data()
    });
  });

  kalenderZeichnen();
});

onSnapshot(zusagenRef, (snapshot) => {
  zusagen = [];

  snapshot.forEach((doc) => {
    zusagen.push({
      id: doc.id,
      ...doc.data()
    });
  });
if (window.aktiverSpieltagId) {
  rueckmeldungenAnzeigen(window.aktiverSpieltagId);
}});

function kalenderZeichnen() {
  const grid = document.getElementById("kalenderGrid");
  const titel = document.getElementById("monatTitel");

  if (!grid || !titel) return;

  grid.innerHTML = "";

  const jahr = aktuellesDatum.getFullYear();
  const monat = aktuellesDatum.getMonth();

  const monatsName = aktuellesDatum.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });

  titel.textContent = monatsName;

  const ersterTag = new Date(jahr, monat, 1);
  const letzterTag = new Date(jahr, monat + 1, 0);

  let startWochentag = ersterTag.getDay();
  if (startWochentag === 0) startWochentag = 7;

  for (let i = 1; i < startWochentag; i++) {
    const leer = document.createElement("div");
    leer.classList.add("kalender-tag", "leer");
    grid.appendChild(leer);
  }

  for (let tag = 1; tag <= letzterTag.getDate(); tag++) {
    const datumString =
      jahr + "-" +
      String(monat + 1).padStart(2, "0") + "-" +
      String(tag).padStart(2, "0");

    const feld = document.createElement("div");
    feld.classList.add("kalender-tag");

    feld.innerHTML = `<strong>${tag}</strong>`;

    const eventsHeute = spieltage.filter((s) => s.datum === datumString);

    eventsHeute.forEach((spieltag) => {
      const event = document.createElement("div");
      event.classList.add("kalender-event");
      event.textContent = spieltag.liga;
      event.onclick = function () {
        zeigeSpieltag(spieltag.id);
      };

      feld.appendChild(event);
    });

    grid.appendChild(feld);
  }
spieltagListeAnzeigen();}

window.monatZurueck = function () {
  aktuellesDatum.setMonth(aktuellesDatum.getMonth() - 1);
  kalenderZeichnen();
};

window.monatVor = function () {
  aktuellesDatum.setMonth(aktuellesDatum.getMonth() + 1);
  kalenderZeichnen();
};
window.zeigeSpieltag = function (spieltagId) {
  const spieltag = spieltage.find(s => s.id === spieltagId);
  if (!spieltag) return;

window.aktiverSpieltagId = spieltag.id;

  const details = document.getElementById("spieltagDetails");
  details.style.display = "block";

  details.innerHTML = `
    <h2>${spieltag.liga}</h2>
    <p>📅 Datum: ${spieltag.datum}</p>
    <p>⏰ Treffen: ${spieltag.treffen || "Noch offen"}</p>
    <p>🎯 Anwurf: ${spieltag.anwurf}</p>
    <p>📍 Ort: ${spieltag.ort}</p>
    <p>🏠 Typ: ${spieltag.typ === "heim" ? "Heimspiel" : "Auswärtsspiel"}</p>

    <h3>Deine Rückmeldung</h3>

    <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Dabei')">Dabei</button>

    ${spieltag.typ === "auswaerts" ? `
      <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Fahrer')">Fahrer</button>
      <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Komme direkt')">Komme direkt</button>
    ` : ""}

    <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Nein')">Nein</button>

    <h3>Rückmeldungen</h3>
    <div id="rueckmeldungen"></div>
  `;

  rueckmeldungenAnzeigen(spieltag.id);
};
function rueckmeldungenAnzeigen(spieltagId) {
  const box = document.getElementById("rueckmeldungen");
  if (!box) return;

  const rueckmeldungen = zusagen.filter(z => z.spieltagId === spieltagId);

  const fahrer = rueckmeldungen.filter(z => z.status === "Fahrer");
  const direkt = rueckmeldungen.filter(z => z.status === "Komme direkt");
  const dabei = rueckmeldungen.filter(z => z.status === "Dabei");
  const nein = rueckmeldungen.filter(z => z.status === "Nein");

  box.innerHTML = `
    <p><strong>🚗 Fahrer:</strong> ${fahrer.map(z => z.name).join(", ") || "-"}</p>
    <p><strong>📍 Kommt direkt:</strong> ${direkt.map(z => z.name).join(", ") || "-"}</p>
    <p><strong>✅ Dabei:</strong> ${dabei.map(z => z.name).join(", ") || "-"}</p>
    <p><strong>❌ Nein:</strong> ${nein.map(z => z.name).join(", ") || "-"}</p>
  `;
}

window.abstimmen = async function (spieltagId, status) {
  if (!aktuellerUser) {
    alert("Bitte neu einloggen.");
    return;
  }

  await addDoc(zusagenRef, {
    spieltagId: spieltagId,
    name: aktuellerUser.name,
    benutzername: aktuellerUser.benutzername,
    status: status,
    erstelltAm: serverTimestamp()
  });

  alert("Rückmeldung gespeichert: " + status);
};
const gespeicherterUser = sessionStorage.getItem("user");

if (gespeicherterUser) {
  aktuellerUser = JSON.parse(gespeicherterUser);

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("kalenderBereich").style.display = "block";

  if (aktuellerUser.rolle === "admin") {
    document.getElementById("adminSpieltagBox").style.display = "block";
  }
}
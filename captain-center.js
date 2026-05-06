const gespeicherterUser = localStorage.getItem("dart11enLogin");

if (!gespeicherterUser) {
  alert("Bitte einloggen.");
  window.location.href = "index.html";
  throw new Error("Kein Zugriff");
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot
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

const aktuellerUser = JSON.parse(gespeicherterUser);

const erlaubteRollen = ["admin", "captain"];

if (!erlaubteRollen.includes(aktuellerUser.rolle)) {
  alert("Nur Captain oder Admin haben Zugriff.");
  window.location.href = "index.html";
  throw new Error("Keine Berechtigung");
}

const userInfo = document.getElementById("userInfo");

if (userInfo) {
  userInfo.textContent =
    "Eingeloggt als: " +
    (aktuellerUser.nickname || aktuellerUser.benutzername);
}

const spieltageRef = collection(db, "spieltage");
const zusagenRef = collection(db, "zusagen");

let spieltage = [];
let zusagen = [];
let aktuellerSpieltag = null;
let verfuegbareSpieler = [];

onSnapshot(spieltageRef, (snapshot) => {
  spieltage = [];

  snapshot.forEach((docSnap) => {
    spieltage.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  spieltage.sort((a, b) => new Date(a.datum) - new Date(b.datum));

  spieltagDropdownFuellen();
});

onSnapshot(zusagenRef, (snapshot) => {
  zusagen = [];

  snapshot.forEach((docSnap) => {
    zusagen.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  if (aktuellerSpieltag) {
    spieltagAuswaehlen();
  }
});

function spieltagDropdownFuellen() {
  const select = document.getElementById("spieltagSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Spieltag wählen</option>`;

  spieltage.forEach(spieltag => {
    const heimAuswaerts =
      spieltag.typ === "heim" ? "Heim" : "Auswärts";

    select.innerHTML += `
      <option value="${spieltag.id}">
        ${spieltag.datum} - ${heimAuswaerts} - ${spieltag.liga}
      </option>
    `;
  });
}

window.spieltagAuswaehlen = function () {
  const select = document.getElementById("spieltagSelect");
  const spieltagId = select.value;

  aktuellerSpieltag =
    spieltage.find(s => s.id === spieltagId);

  if (!aktuellerSpieltag) return;

  verfuegbareSpieler = zusagen.filter(z =>
    z.spieltagId === aktuellerSpieltag.id &&
    (
      z.status === "Dabei" ||
      z.status === "Fahrer" ||
      z.status === "Komme direkt"
    )
  );

  verfuegbareSpielerAnzeigen();
  aufstellungErstellen();
  spielplanAktualisieren();
};

function verfuegbareSpielerAnzeigen() {
  const box = document.getElementById("verfuegbareSpieler");
  if (!box) return;

  if (verfuegbareSpieler.length === 0) {
    box.innerHTML = "<p>Keine Zusagen für diesen Spieltag.</p>";
    return;
  }

  box.innerHTML = verfuegbareSpieler.map(spieler => `
    <div class="spieler-chip">
      ${spieler.name} 
      <small>${spieler.status}</small>
    </div>
  `).join("");
}

function aufstellungErstellen() {
  const grid = document.getElementById("aufstellungGrid");
  const info = document.getElementById("teamRolleInfo");

  if (!grid || !info || !aktuellerSpieltag) return;

  const rolle = aktuellerSpieltag.typ === "heim" ? "H" : "A";

  info.innerHTML = `
    <p>
      Dart11en spielt als:
      <strong>${rolle === "H" ? "Heimteam (H)" : "Auswärtsteam (A)"}</strong>
    </p>
  `;

  grid.innerHTML = "";

  for (let i = 1; i <= 12; i++) {
    const label = `${rolle}${i}`;

    grid.innerHTML += `
      <div class="aufstellung-slot">
        <label>${label}</label>
        <select id="slot_${label}" onchange="spielplanAktualisieren()">
          <option value="">Leer</option>
          ${spielerOptionen()}
        </select>
      </div>
    `;
  }
}

function spielerOptionen() {
  return verfuegbareSpieler.map(spieler => `
    <option value="${spieler.name}">
      ${spieler.name}
    </option>
  `).join("");
}

function getSpieler(position) {
  const feld = document.getElementById(`slot_${position}`);
  return feld && feld.value ? feld.value : position;
}

function zeile(text) {
  return `<div class="spielplan-zeile">${text}</div>`;
}

window.spielplanAktualisieren = function () {
  const system =
  document.getElementById("systemSelect").value;
  if (!aktuellerSpieltag) return;

  const box = document.getElementById("spielplanVorschau");
  if (!box) return;

  const rolle = aktuellerSpieltag.typ === "heim" ? "H" : "A";

  const H = (nr) => rolle === "H" ? getSpieler(`H${nr}`) : `H${nr}`;
  const A = (nr) => rolle === "A" ? getSpieler(`A${nr}`) : `A${nr}`;

  if (system === "rheinruhr") {

  box.innerHTML = `
    <h3>Block 1</h3>
    ${zeile(`${H(1)} : ${A(1)}`)}
    ${zeile(`${H(2)} : ${A(2)}`)}
    ${zeile(`${H(3)} : ${A(3)}`)}
    ${zeile(`${H(4)} : ${A(4)}`)}

    <h3>Block 2</h3>
    ${zeile(`${H(1)} : ${A(2)}`)}
    ${zeile(`${H(2)} : ${A(1)}`)}
    ${zeile(`${H(3)} : ${A(4)}`)}
    ${zeile(`${H(4)} : ${A(3)}`)}

    <h3>Doppel</h3>
    ${zeile(`${H(5)} + ${H(6)} : ${A(5)} + ${A(6)}`)}
    ${zeile(`${H(7)} + ${H(8)} : ${A(7)} + ${A(8)}`)}

    <h3>Block 3</h3>
    ${zeile(`${H(1)} : ${A(3)}`)}
    ${zeile(`${H(2)} : ${A(4)}`)}
    ${zeile(`${H(3)} : ${A(2)}`)}
    ${zeile(`${H(4)} : ${A(1)}`)}

    <h3>Block 4</h3>
    ${zeile(`${H(1)} : ${A(3)}`)}
    ${zeile(`${H(2)} : ${A(4)}`)}
    ${zeile(`${H(3)} : ${A(1)}`)}
    ${zeile(`${H(4)} : ${A(2)}`)}
  `;

} else if (system === "ruhrpott") {

  box.innerHTML = `
    <h3>Block 1</h3>
    ${zeile(`${H(1)} : ${A(1)}`)}
    ${zeile(`${H(2)} : ${A(2)}`)}
    ${zeile(`${H(3)} : ${A(3)}`)}
    ${zeile(`${H(4)} : ${A(4)}`)}

    <h3>Block 2</h3>
    ${zeile(`${H(1)} : ${A(2)}`)}
    ${zeile(`${H(2)} : ${A(1)}`)}
    ${zeile(`${H(3)} : ${A(4)}`)}
    ${zeile(`${H(4)} : ${A(3)}`)}

    <h3>Cricket</h3>
    ${zeile(`${H(5)} : ${A(5)}`)}
    ${zeile(`${H(6)} : ${A(6)}`)}

    <h3>Doppel</h3>
    ${zeile(`${H(7)} + ${H(8)} : ${A(7)} + ${A(8)}`)}
    ${zeile(`${H(9)} + ${H(10)} : ${A(9)} + ${A(10)}`)}

    <h3>Block 3</h3>
    ${zeile(`${H(1)} : ${A(3)}`)}
    ${zeile(`${H(2)} : ${A(4)}`)}
    ${zeile(`${H(3)} : ${A(1)}`)}
    ${zeile(`${H(4)} : ${A(2)}`)}

    <h3>Block 4</h3>
    ${zeile(`${H(1)} : ${A(4)}`)}
    ${zeile(`${H(2)} : ${A(3)}`)}
    ${zeile(`${H(3)} : ${A(2)}`)}
    ${zeile(`${H(4)} : ${A(1)}`)}
  `;

} else if (system === "herner") {

  box.innerHTML = `
    <h3>Block 1</h3>
    ${zeile(`${H(1)} : ${A(1)}`)}
    ${zeile(`${H(2)} : ${A(2)}`)}
    ${zeile(`${H(3)} : ${A(3)}`)}
    ${zeile(`${H(4)} : ${A(4)}`)}

    <h3>Block 2</h3>
    ${zeile(`${H(1)} : ${A(2)}`)}
    ${zeile(`${H(2)} : ${A(1)}`)}
    ${zeile(`${H(3)} : ${A(4)}`)}
    ${zeile(`${H(4)} : ${A(3)}`)}

    <h3>Doppel</h3>
    ${zeile(`${H(5)} + ${H(6)} : ${A(5)} + ${A(6)}`)}
    ${zeile(`${H(7)} + ${H(8)} : ${A(7)} + ${A(8)}`)}

    <h3>Block 3</h3>
    ${zeile(`${H(1)} : ${A(3)}`)}
    ${zeile(`${H(2)} : ${A(4)}`)}
    ${zeile(`${H(3)} : ${A(1)}`)}
    ${zeile(`${H(4)} : ${A(2)}`)}

    <h3>Block 4</h3>
    ${zeile(`${H(1)} : ${A(4)}`)}
    ${zeile(`${H(2)} : ${A(3)}`)}
    ${zeile(`${H(3)} : ${A(2)}`)}
    ${zeile(`${H(4)} : ${A(1)}`)}
  `;

}
};

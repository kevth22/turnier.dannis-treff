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
  onSnapshot,
  setDoc,
  doc
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

const erlaubteRollen = ["admin", "captain", "mitglied"];

if (!erlaubteRollen.includes(aktuellerUser.rolle)) {
  alert("Kein Zugriff.");
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
let aktuellerIndex = 0;
window.aktuellerStatus = "";

onSnapshot(spieltageRef, (snapshot) => {
  spieltage = [];

  snapshot.forEach((docSnap) => {
    spieltage.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  spieltage.sort((a, b) =>
    new Date(a.datum) - new Date(b.datum)
  );

  spieltagAnzeigen();
});

onSnapshot(zusagenRef, (snapshot) => {
  zusagen = [];

  snapshot.forEach((docSnap) => {
    zusagen.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  rueckmeldungenAnzeigenCenter();
});
function spieltagAnzeigen() {
  const box = document.getElementById("spieltagAnzeige");
  const counter = document.getElementById("spieltagCounter");

  if (!box || !counter) return;

  if (spieltage.length === 0) {
    box.innerHTML = "<h2>Keine Spieltage vorhanden</h2>";
    counter.textContent = "Spieltag 0 / 0";
    return;
  }

  if (aktuellerIndex >= spieltage.length) {
    aktuellerIndex = 0;
  }

  const spieltag = spieltage[aktuellerIndex];

  const gegnerText =
    spieltag.typ === "heim"
      ? `Dart11en : ${spieltag.ort}`
      : `${spieltag.ort} : Dart11en`;

  const spieltagKlasse =
    spieltag.typ === "heim"
      ? "heim-center"
      : "auswaerts-center";

  <div class="spieltag-center-content ${spieltagKlasse}"
onclick="toggleTeilnehmerListe()">

      <h2>${spieltag.liga}</h2>

      <div class="spieltag-gegner">
        ${gegnerText}
      </div>

      <div class="spieltag-details">
        <p>📅 ${spieltag.datum}</p>
        <p>🕒 Treffen: ${spieltag.treffen || "-"}</p>
        <p>🎯 Anwurf: ${spieltag.anwurf}</p>
        <p>📍 ${spieltag.ort}</p>

        <a
          class="maps-button"
          target="_blank"
          href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spieltag.ort)}"
        >
          🗺 Navigation starten
        </a>
      </div>

    </div>
  `;

  counter.textContent =
    `Spieltag ${aktuellerIndex + 1} / ${spieltage.length}`;

  rueckmeldungenAnzeigenCenter();
}

window.naechsterSpieltag = function () {
  if (aktuellerIndex < spieltage.length - 1) {
    aktuellerIndex++;
    spieltagAnzeigen();
  }
};

window.vorherigerSpieltag = function () {
  if (aktuellerIndex > 0) {
    aktuellerIndex--;
    spieltagAnzeigen();
  }
};

/* =========================
   SWIPE
========================= */

let touchStartX = 0;
let touchEndX = 0;

const spieltagBox = document.getElementById("spieltagAnzeige");

if (spieltagBox) {
  spieltagBox.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  spieltagBox.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    swipePruefen();
  });
}

function swipePruefen() {
  if (touchEndX < touchStartX - 50) {
    naechsterSpieltag();
  }

  if (touchEndX > touchStartX + 50) {
    vorherigerSpieltag();
  }
}
window.abstimmenAktuell = async function (status) {
  window.aktuellerStatus = status;

  const spieltag = spieltage[aktuellerIndex];

  if (!spieltag) return;

  const zusageId =
    `${spieltag.id}_${aktuellerUser.benutzername}`;

  await setDoc(
    doc(db, "zusagen", zusageId),
    {
      spieltagId: spieltag.id,
      name: aktuellerUser.nickname,
      benutzername: aktuellerUser.benutzername,
      status: status,
      grund: "",
      erstelltAm: new Date()
    }
  );

  rueckmeldungenAnzeigenCenter();

  alert("Rückmeldung gespeichert: " + status);
};

/* =========================
   RÜCKMELDUNGEN ANZEIGEN
========================= */

function rueckmeldungenAnzeigenCenter() {
  const box =
    document.getElementById("spieltagRueckmeldungen");

  if (!box) return;

  const spieltag = spieltage[aktuellerIndex];

  if (!spieltag) return;

  const rueckmeldungen =
    zusagen.filter(z => z.spieltagId === spieltag.id);

  const dabei =
    rueckmeldungen.filter(z => z.status === "Dabei");

  const fahrer =
    rueckmeldungen.filter(z => z.status === "Fahrer");

  const direkt =
    rueckmeldungen.filter(z => z.status === "Komme direkt");

  const nein =
    rueckmeldungen.filter(z => z.status === "Nein");

  if (spieltag.typ === "heim") {
    box.innerHTML = `
      <div class="matchday-statusbar">

        <div class="${window.aktuellerStatus === 'Dabei' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Dabei'); toggleRueckmeldungListe('Dabei')">
          👍<br>
          <strong>${dabei.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Nein' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Nein'); toggleRueckmeldungListe('Nein')">
          👎<br>
          <strong>${nein.length}</strong>
        </div>

      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="matchday-statusbar">

        <div class="${window.aktuellerStatus === 'Dabei' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Dabei'); toggleRueckmeldungListe('Dabei')">
          👍<br>
          <strong>${dabei.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Fahrer' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Fahrer'); toggleRueckmeldungListe('Fahrer')">
          🚗<br>
          <strong>${fahrer.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Komme direkt' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Komme direkt'); toggleRueckmeldungListe('Komme direkt')">
          📍<br>
          <strong>${direkt.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Nein' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Nein'); toggleRueckmeldungListe('Nein')">
          👎<br>
          <strong>${nein.length}</strong>
        </div>

      </div>
    `;
  }
}

/* =========================
   NAMEN ANZEIGEN
========================= */

window.toggleRueckmeldungListe = function (status) {
  const spieltag = spieltage[aktuellerIndex];

  if (!spieltag) return;

  const box =
    document.getElementById("rueckmeldungNamenListe");

  if (!box) return;

  const passendeSpieler =
    zusagen.filter(z =>
      z.spieltagId === spieltag.id &&
      z.status === status
    );

  if (passendeSpieler.length === 0) {
    box.innerHTML = `
      <div class="namen-popup">
        <h4>${status}</h4>
        <p>Keine Spieler</p>
      </div>
    `;

    return;
  }

  box.innerHTML = `
    <div class="namen-popup">

      <h4>${status}</h4>

      ${passendeSpieler.map(spieler => `
        <div class="spieler-name">
          ${spieler.name}
        </div>
      `).join("")}

    </div>
  `;
};
window.toggleTeilnehmerListe = function () {

  const box =
    document.getElementById("rueckmeldungNamenListe");

  if (!box) return;

  if (box.innerHTML.trim() !== "") {
    box.innerHTML = "";
    return;
  }

  const spieltag = spieltage[aktuellerIndex];

  if (!spieltag) return;

  const rueckmeldungen =
    zusagen.filter(z =>
      z.spieltagId === spieltag.id
    );

  if (rueckmeldungen.length === 0) {

    box.innerHTML = `
      <div class="namen-popup">
        Keine Rückmeldungen
      </div>
    `;

    return;
  }

  box.innerHTML = `
    <div class="namen-popup">

      ${rueckmeldungen.map(spieler => `
        <div class="spieler-name">
          ${spieler.name}
          (${spieler.status})
        </div>
      `).join("")}

    </div>
  `;
};

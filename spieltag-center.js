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

let spieltage = [];
let aktuellerIndex = 0;

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

function spieltagAnzeigen() {
  const box = document.getElementById("spieltagAnzeige");
  const counter = document.getElementById("spieltagCounter");

  if (!box || !counter) return;

  if (spieltage.length === 0) {
    box.innerHTML = "<h2>Keine Spieltage vorhanden</h2>";
    return;
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

  box.innerHTML = `
    <div class="spieltag-center-content ${spieltagKlasse}">

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

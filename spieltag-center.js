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
  doc,
  deleteDoc
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
let offeneStatusListe = "";
window.aktuellerStatus = "";

onSnapshot(spieltageRef, (snapshot) => {
  spieltage = [];

  snapshot.forEach((docSnap) => {
    spieltage.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  
const heute = new Date();
heute.setHours(0, 0, 0, 0);

spieltage = spieltage.filter(spieltag => {
  const spieltagDatum = new Date(spieltag.datum);
  spieltagDatum.setHours(0, 0, 0, 0);

  return spieltagDatum >= heute;
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
  const bestehendeZusage = zusagen.find(z =>
  z.spieltagId === spieltag.id &&
  z.benutzername === aktuellerUser.benutzername
);
  const gegnerText =
    spieltag.typ === "heim"
      ? `Dart11en : ${spieltag.ort}`
      : `${spieltag.ort} : Dart11en`;

  const spieltagKlasse =
    spieltag.typ === "heim"
      ? "heim-center"
      : "auswaerts-center";

  box.innerHTML = `
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
    animierterWechsel("links");
  }

  if (touchEndX > touchStartX + 50) {
    animierterWechsel("rechts");
  }
}
function animierterWechsel(richtung) {
  const box = document.getElementById("spieltagAnzeige");

  if (!box) return;

  if (richtung === "links" && aktuellerIndex >= spieltage.length - 1) return;
  if (richtung === "rechts" && aktuellerIndex <= 0) return;

  box.classList.remove(
    "spieltag-slide-in",
    "spieltag-slide-out-left",
    "spieltag-slide-out-right"
  );

  box.classList.add(
    richtung === "links"
      ? "spieltag-slide-out-left"
      : "spieltag-slide-out-right"
  );

  setTimeout(() => {
    if (richtung === "links") {
      aktuellerIndex++;
    } else {
      aktuellerIndex--;
    }

    spieltagAnzeigen();

    box.classList.remove(
      "spieltag-slide-out-left",
      "spieltag-slide-out-right"
    );

    box.classList.add("spieltag-slide-in");
  }, 180);
}

window.abstimmenAktuell = async function (status) {
  const spieltag = spieltage[aktuellerIndex];

  if (!spieltag) return;

  const zusageId =
    `${spieltag.id}_${aktuellerUser.benutzername}`;

  const zusageRef = doc(db, "zusagen", zusageId);

  const bestehendeZusage = zusagen.find(z =>
    z.spieltagId === spieltag.id &&
    z.benutzername === aktuellerUser.benutzername
  );

  // Wenn gleicher Button nochmal geklickt wird: Stimme löschen
  if (
    bestehendeZusage &&
    bestehendeZusage.status === status
  ) {
    await deleteDoc(zusageRef);

    window.aktuellerStatus = "";

    rueckmeldungenAnzeigenCenter();
    updateCountdown(spieltag);
    return;
  }

  // Sonst neue/andere Stimme speichern
  await setDoc(
    zusageRef,
    {
      spieltagId: spieltag.id,
      name: aktuellerUser.nickname,
      benutzername: aktuellerUser.benutzername,
      status: status,
      grund: "",
      erstelltAm: new Date()
    }
  );

  window.aktuellerStatus = status;

  rueckmeldungenAnzeigenCenter();
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
          onclick="abstimmenAktuell('Dabei')">
          👍<br>
          <strong>${dabei.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Nein' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Nein')">
          👎<br>
          <strong>${nein.length}</strong>
        </div>

      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="matchday-statusbar">

        <div class="${window.aktuellerStatus === 'Dabei' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Dabei')">
          👍<br>
          <strong>${dabei.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Fahrer' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Fahrer')">
          🚗<br>
          <strong>${fahrer.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Komme direkt' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Komme direkt')">
          📍<br>
          <strong>${direkt.length}</strong>
        </div>

        <div class="${window.aktuellerStatus === 'Nein' ? 'aktiv-status' : ''}"
          onclick="abstimmenAktuell('Nein')">
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
  const box = document.getElementById("rueckmeldungNamenListe");

  if (!box) return;

  if (offeneStatusListe === status && box.innerHTML.trim() !== "") {
    box.innerHTML = "";
    offeneStatusListe = "";
    return;
  }

  offeneStatusListe = status;
  rueckmeldungListeAnzeigen(status);
};

function rueckmeldungListeAnzeigen(status) {
  const spieltag = spieltage[aktuellerIndex];

  if (!spieltag) return;

  const box = document.getElementById("rueckmeldungNamenListe");

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
}
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
function updateCountdown(spieltag) {

  const countdownBox =
    document.getElementById("spieltagCountdown");

  if (!countdownBox) return;

  if (!spieltag.treffen) {
    countdownBox.innerHTML = "";
    return;
  }

  const zielDatum =
    new Date(`${spieltag.datum}T${spieltag.treffen}`);

  function countdownBerechnen() {

    const jetzt = new Date();

    const diff =
      zielDatum - jetzt;

    if (diff <= 0) {

      countdownBox.innerHTML =
        "🔥 Treffen läuft";

      return;
    }

    const tage =
      Math.floor(diff / (1000 * 60 * 60 * 24));

    const stunden =
      Math.floor(
        (diff / (1000 * 60 * 60)) % 24
      );

    const minuten =
      Math.floor(
        (diff / (1000 * 60)) % 60
      );

    if (tage > 0) {

      countdownBox.innerHTML =
        `⏳ Noch ${tage}T ${stunden}Std`;

    } else {

      countdownBox.innerHTML =
        `⏳ Noch ${stunden}Std ${minuten}Min`;
    }
  }

  countdownBerechnen();

  clearInterval(window.spieltagCountdownInterval);

  window.spieltagCountdownInterval =
    setInterval(countdownBerechnen, 60000);
}

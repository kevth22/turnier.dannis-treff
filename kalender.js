const gespeicherterUser = localStorage.getItem("dart11enLogin");

if (!gespeicherterUser) {
  alert("Du hast keinen Zugriff für diesen Bereich.");
  window.location.href = "index.html";
  throw new Error("Kein Zugriff");
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
  setDoc
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
const urlaubeRef = collection(db, "urlaube");
let zusagen = [];

const erlaubteRollen = ["admin", "captain", "mitglied"];

if (!erlaubteRollen.includes(aktuellerUser.rolle)) {
  alert("Kein Zugriff auf den Kalender.");

  window.location.href = "index.html";

  throw new Error("Keine Berechtigung");
}
let spieltage = [];
let aktuellesDatum = new Date();
let ausgewaehltesDatum = null;
const userInfo = document.getElementById("userInfo");

if (userInfo && aktuellerUser) {
  userInfo.textContent =
    "Eingeloggt als: " +
    (aktuellerUser.nickname || aktuellerUser.benutzername);
}

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
     const rueckmeldungen = zusagen.filter(z => z.spieltagId === spieltag.id);

const dabei = rueckmeldungen.filter(z => z.status === "Dabei").length;
const fahrer = rueckmeldungen.filter(z => z.status === "Fahrer").length;
const direkt = rueckmeldungen.filter(z => z.status === "Komme direkt").length;

const zusagenGesamt = spieltag.typ === "auswaerts"
  ? dabei + fahrer + direkt
  : dabei;
    const card = document.createElement("div");
    card.classList.add("spieltag-card");

    card.innerHTML = `
      <h4>${spieltag.liga}</h4>
      <div class="spieltag-meta">
  📅 ${spieltag.datum} <br>
  ⏰ Anwurf: ${spieltag.anwurf} <br>
  🕒 Treffen: ${spieltag.treffen || "-"} <br>
  ${spieltag.typ === "heim" ? "🏠 Heimspiel" : `🚗 Auswärtsspiel<br>📍 ${spieltag.ort}`} <br>
  ✅ Zusagen: ${zusagenGesamt}

  ${spieltag.typ === "auswaerts" ? `
    <br>Davon:
    <br>✅ Dabei: ${dabei}
    <br>🚗 Fahrer: ${fahrer}
    <br>📍 Direkt: ${direkt}
  ` : ""}
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

  kalenderZeichnen();

  if (window.aktiverSpieltagId) {
    rueckmeldungenAnzeigen(window.aktiverSpieltagId);
  }
  erinnerungenPruefen();
});
onSnapshot(urlaubeRef, (snapshot) => {
  const urlaubListe = document.getElementById("urlaubListe");

  if (!urlaubListe) return;

  const meineUrlaube = [];

  snapshot.forEach((docSnap) => {
    const daten = docSnap.data();

    if (daten.benutzername === aktuellerUser.benutzername) {
      meineUrlaube.push({
        id: docSnap.id,
        ...daten
      });
    }
  });

  if (meineUrlaube.length === 0) {
    urlaubListe.innerHTML = "<p>Keine Urlaube eingetragen.</p>";
    return;
  }

  urlaubListe.innerHTML = meineUrlaube.map(urlaub => `
    <div class="urlaub-item">
      <div>
        🌴 ${urlaub.von} bis ${urlaub.bis}
      </div>

      <button onclick="urlaubLoeschen('${urlaub.id}')">
        ❌
      </button>
    </div>
  `).join("");
});

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
const heute = new Date();

if (
  tag === heute.getDate() &&
  monat === heute.getMonth() &&
  jahr === heute.getFullYear()
) {
  feld.classList.add("heute");
}

const feldDatum = new Date(jahr, monat, tag);

if (feldDatum < new Date().setHours(0,0,0,0)) {
  feld.classList.add("vergangen");
}
    feld.innerHTML = `<strong>${tag}</strong>`;

    feld.onclick = function () {
  tagAuswaehlen(datumString);
};

    const eventsHeute = spieltage.filter((s) => s.datum === datumString);

    eventsHeute.forEach((spieltag) => {
      const event = document.createElement("div");
      event.classList.add("kalender-event");
      if (spieltag.typ === "heim") {
  event.classList.add("heimspiel");
} else {
  event.classList.add("auswaertsspiel");
}
      event.innerHTML = `
  <strong>${spieltag.liga}</strong><br>
  <small>${spieltag.typ === "heim" ? "🏠 Heim" : "🚗 Auswärts"}</small>
`;
      event.onclick = function (e) {
  e.stopPropagation();
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

${aktuellerUser && (
  aktuellerUser.rolle === "admin" ||
  aktuellerUser.rolle === "captain"
) ? `
  <button class="main-button" style="background:#555;" onclick="spieltagLoeschen('${spieltag.id}')">
    ❌ Spieltag löschen
  </button>
` : ""}

   <h3>Deine Rückmeldung</h3>

<div class="abstimmung-buttons">

  <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Dabei')">
    ✅ Dabei
  </button>

  ${spieltag.typ === "auswaerts" ? `
    <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Fahrer')">
      🚗 Fahrer
    </button>

    <button class="main-button" onclick="abstimmen('${spieltag.id}', 'Komme direkt')">
      📍 Direkt
    </button>
  ` : ""}

  <button class="main-button nein-button" onclick="abstimmen('${spieltag.id}', 'Nein')">
    ❌ Nein
  </button>

</div>
    <h3>Rückmeldungen</h3>
    <div id="rueckmeldungen"></div>
  `;

  rueckmeldungenAnzeigen(spieltag.id);
};
function rueckmeldungenAnzeigen(spieltagId) {
    const spieltag = spieltage.find(s => s.id === spieltagId);
  const istAuswaerts = spieltag && spieltag.typ === "auswaerts";
  const box = document.getElementById("rueckmeldungen");
  if (!box) return;

  const rueckmeldungen = zusagen.filter(z => z.spieltagId === spieltagId);

  const fahrer = rueckmeldungen.filter(z => z.status === "Fahrer");
  const direkt = rueckmeldungen.filter(z => z.status === "Komme direkt");
  const dabei = rueckmeldungen.filter(z => z.status === "Dabei");
  const nein = rueckmeldungen.filter(z => z.status === "Nein");

  box.innerHTML = `
    <div class="rueckmeldung-summary ${istAuswaerts ? "" : "heim-summary"}">
  <div>✅<br><strong>${dabei.length}</strong><br>Dabei</div>

  ${istAuswaerts ? `
    <div>🚗<br><strong>${fahrer.length}</strong><br>Fahrer</div>
    <div>📍<br><strong>${direkt.length}</strong><br>Direkt</div>
  ` : ""}

  <div>❌<br><strong>${nein.length}</strong><br>Nein</div>
</div>

    <h4>✅ Dabei</h4>
${gruppeAnzeigen(dabei)}

${istAuswaerts ? `
  <h4>🚗 Fahrer</h4>
  ${gruppeAnzeigen(fahrer)}

  <h4>📍 Kommt direkt</h4>
  ${gruppeAnzeigen(direkt)}
` : ""}

<h4>❌ Nein</h4>
${gruppeAnzeigen(nein)}
  `;
}
function gruppeAnzeigen(gruppe) {
  if (gruppe.length === 0) return "<p>-</p>";

  return gruppe.map(z => {
    const adminButtons = aktuellerUser && aktuellerUser.rolle === "admin"
      ? `
        <div class="admin-actions">
          <button onclick="adminUpdate('${z.id}', 'Dabei')">Dabei</button>
          <button onclick="adminUpdate('${z.id}', 'Fahrer')">Fahrer</button>
          <button onclick="adminUpdate('${z.id}', 'Komme direkt')">Direkt</button>
          <button onclick="adminUpdate('${z.id}', 'Nein')">Nein</button>
          <button onclick="adminDelete('${z.id}')">❌</button>
        </div>
      `
      : "";

    return `
      <div class="rueckmeldung-person">
        <span>
  ${z.name}
  ${z.grund === "Urlaub" ? "<small class='urlaub-label'>🌴 Urlaub</small>" : ""}
</span>
        ${adminButtons}
      </div>
    `;
  }).join("");
}


window.adminUpdate = async function (docId, status) {
  await updateDoc(doc(db, "zusagen", docId), {
    status: status
  });
};

window.adminDelete = async function (docId) {
  if (confirm("Eintrag wirklich löschen?")) {
    await deleteDoc(doc(db, "zusagen", docId));
  }
};
window.spieltagLoeschen = async function (spieltagId) {
  if (!confirm("Diesen Spieltag wirklich löschen?")) return;

  await deleteDoc(doc(db, "spieltage", spieltagId));

  alert("Spieltag gelöscht");

  document.getElementById("spieltagDetails").style.display = "none";
};
window.abstimmen = async function (spieltagId, status) {
  if (!aktuellerUser) {
    alert("Bitte neu einloggen.");
    return;
  }

  const q = query(
    zusagenRef,
    where("spieltagId", "==", spieltagId),
    where("benutzername", "==", aktuellerUser.benutzername)
  );

  const snapshot = await getDocs(q);

  const zusageId = `${spieltagId}_${aktuellerUser.benutzername}`;

await setDoc(doc(db, "zusagen", zusageId), {
  spieltagId: spieltagId,
  name: aktuellerUser.nickname,
  benutzername: aktuellerUser.benutzername,
  status: status,
  grund: "",
  erstelltAm: serverTimestamp()
});

alert("Rückmeldung gespeichert: " + status);
}
window.tagAuswaehlen = function (datumString) {
  const darfBearbeiten =
    aktuellerUser &&
    (
      aktuellerUser.rolle === "admin" ||
      aktuellerUser.rolle === "captain"
    );

  if (!darfBearbeiten) return;

  const adminBox = document.getElementById("adminSpieltagBox");
  const datumInput = document.getElementById("spieltagDatum");

  if (!adminBox || !datumInput) return;

  if (ausgewaehltesDatum === datumString && adminBox.style.display === "block") {
    adminBox.style.display = "none";
    ausgewaehltesDatum = null;
    return;
  }

  ausgewaehltesDatum = datumString;
  datumInput.value = datumString;
  adminBox.style.display = "block";
};
function erinnerungenPruefen() {
  const reminderAktiv = localStorage.getItem("dart11enReminder");

  if (reminderAktiv !== "true") return;
  if (!aktuellerUser || !spieltage.length) return;

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  let meldungen = [];

  spieltage.forEach(spieltag => {
    const spielDatum = new Date(spieltag.datum);
    spielDatum.setHours(0, 0, 0, 0);

    const diffTage =
      Math.round((spielDatum - heute) / (1000 * 60 * 60 * 24));

    const eigeneRueckmeldung = zusagen.find(z =>
      z.spieltagId === spieltag.id &&
      z.benutzername === aktuellerUser.benutzername
    );

    if ((diffTage === 7 || diffTage === 3) && !eigeneRueckmeldung) {
      meldungen.push(
        `⚠️ ${spieltag.liga} am ${spieltag.datum}: Noch keine Rückmeldung abgegeben.`
      );
    }

    if (diffTage === 2 && eigeneRueckmeldung) {
      meldungen.push(
        `📅 Erinnerung: ${spieltag.liga} in 2 Tagen.\nStatus: ${eigeneRueckmeldung.status}`
      );
    }
  });

  if (meldungen.length > 0) {
  const popup = document.getElementById("reminderPopup");
  const textBox = document.getElementById("reminderText");

  if (popup && textBox) {
    textBox.innerHTML = meldungen
      .map(m => `<div class="reminder-item">${m}</div>`)
      .join("");

    popup.style.display = "flex";
  }
}

  localStorage.removeItem("dart11enReminder");
}
window.reminderSchliessen = function () {
  const popup = document.getElementById("reminderPopup");
  if (popup) {
    popup.style.display = "none";
  }
};
window.urlaubSpeichern = async function () {
  const von = document.getElementById("urlaubVon").value;
  const bis = document.getElementById("urlaubBis").value;

  if (!von || !bis) {
    alert("Bitte Von- und Bis-Datum auswählen.");
    return;
  }

  if (bis < von) {
    alert("Das Bis-Datum darf nicht vor dem Von-Datum liegen.");
    return;
  }

  await addDoc(urlaubeRef, {
    benutzername: aktuellerUser.benutzername,
    nickname: aktuellerUser.nickname,
    von: von,
    bis: bis,
    erstelltAm: serverTimestamp()
  });

  const betroffeneSpieltage = spieltage.filter(spieltag =>
    spieltag.datum >= von && spieltag.datum <= bis
  );

  for (const spieltag of betroffeneSpieltage) {
  const zusageId = `${spieltag.id}_${aktuellerUser.benutzername}`;

  await setDoc(doc(db, "zusagen", zusageId), {
    spieltagId: spieltag.id,
    name: aktuellerUser.nickname,
    benutzername: aktuellerUser.benutzername,
    status: "Nein",
    grund: "Urlaub",
    erstelltAm: serverTimestamp()
  });
}

alert(`Urlaub gespeichert. ${betroffeneSpieltage.length} Spieltag(e) wurden auf Nein gesetzt.`);

document.getElementById("urlaubVon").value = "";
document.getElementById("urlaubBis").value = "";
  };
window.urlaubSpeichern = async function () {
  const von = document.getElementById("urlaubVon").value;
  const bis = document.getElementById("urlaubBis").value;

  if (!von || !bis) {
    alert("Bitte Von- und Bis-Datum auswählen.");
    return;
  }

  if (bis < von) {
    alert("Das Bis-Datum darf nicht vor dem Von-Datum liegen.");
    return;
  }

  await addDoc(urlaubeRef, {
    benutzername: aktuellerUser.benutzername,
    nickname: aktuellerUser.nickname,
    von: von,
    bis: bis,
    erstelltAm: serverTimestamp()
  });

  const betroffeneSpieltage = spieltage.filter(spieltag =>
    spieltag.datum >= von && spieltag.datum <= bis
  );

  for (const spieltag of betroffeneSpieltage) {
    const zusageId = `${spieltag.id}_${aktuellerUser.benutzername}`;

    await setDoc(doc(db, "zusagen", zusageId), {
      spieltagId: spieltag.id,
      name: aktuellerUser.nickname,
      benutzername: aktuellerUser.benutzername,
      status: "Nein",
      grund: "Urlaub",
      erstelltAm: serverTimestamp()
    });
  }

  alert(`Urlaub gespeichert. ${betroffeneSpieltage.length} Spieltag(e) wurden auf Nein gesetzt.`);

  document.getElementById("urlaubVon").value = "";
  document.getElementById("urlaubBis").value = "";
};

window.urlaubLoeschen = async function (urlaubId) {
  if (!confirm("Urlaub wirklich löschen?")) return;

  await deleteDoc(doc(db, "urlaube", urlaubId));

  alert("Urlaub gelöscht.");
};

window.urlaubToggle = function () {
  const content = document.getElementById("urlaubContent");
  const icon = document.getElementById("urlaubToggleIcon");

  if (!content || !icon) return;

  const istOffen = content.style.display === "block";

  if (istOffen) {
    content.style.display = "none";
    icon.textContent = "▼";
  } else {
    content.style.display = "block";
    icon.textContent = "▲";
  }
};

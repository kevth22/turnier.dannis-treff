import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",
  authDomain: "dannistreffturnier.firebaseapp.com",
  projectId: "dannistreffturnier",
  storageBucket: "dannistreffturnier.firebasestorage.app",
  messagingSenderId: "829873084116",
  appId: "1:829873084116:web:683bbf1ea3e58f1a4ecd41",
  measurementId: "G-QEL7FSWMLG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const warteschlangeRef = collection(db, "warteschlange");

const istAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

window.anmelden = async function () {
  const nameFeld = document.getElementById("spielerName");
  const name = nameFeld.value.trim();

  if (name === "") {
    alert("Bitte gib deinen Namen ein.");
    return;
  }

 const existiert = await new Promise((resolve) => {
  onSnapshot(warteschlangeRef, (snapshot) => {
    let gefunden = false;

    snapshot.forEach((dokument) => {
      const spieler = dokument.data();

      if (spieler.name.toLowerCase() === name.toLowerCase()) {
        gefunden = true;
      }
    });

    resolve(gefunden);
  });
});

if (existiert) {
  alert("Dieser Name steht bereits in der Warteschlange.");
  return;
}

await addDoc(warteschlangeRef, {
  name: name,
  zeit: Date.now(),
  bezahlt: false
});

  nameFeld.value = "";
};

onSnapshot(warteschlangeRef, (snapshot) => {
  const liste = document.getElementById("warteschlange");
  liste.innerHTML = "";

  const spieler = [];

  snapshot.forEach((dokument) => {
    spieler.push({
      id: dokument.id,
      ...dokument.data()
    });
  });

  spieler.sort((a, b) => a.zeit - b.zeit);
const maxPlaetze = 32;
const bezahlteSpieler = spieler.filter((person) => person.bezahlt === true);
const wartendeSpieler = spieler.filter((person) => person.bezahlt !== true);

const belegte = Math.min(bezahlteSpieler.length, maxPlaetze);
const wartend = wartendeSpieler.length;

document.getElementById("belegt").textContent = belegte + " / " + maxPlaetze;
document.getElementById("wartend").textContent = wartend;

document.getElementById("barBelegt").style.width = (belegte / maxPlaetze * 100) + "%";
document.getElementById("barWartend").style.width = (wartend / maxPlaetze * 100) + "%";
  const anzahlAnzeige = document.getElementById("anzahl");
  if (anzahlAnzeige) {
    anzahlAnzeige.textContent = spieler.length;
  }

  if (istAdmin) {
    spieler.forEach((person) => {
      const eintrag = document.createElement("li");
      eintrag.textContent = person.name;

      const button = document.createElement("button");
      button.textContent = "Löschen";
      button.style.marginLeft = "10px";
      button.style.width = "auto";
      button.style.padding = "6px 10px";
      button.style.fontSize = "14px";

      button.onclick = async function () {
        await deleteDoc(doc(db, "warteschlange", person.id));
      };

      eintrag.appendChild(button);
const bezahltButton = document.createElement("button");
bezahltButton.textContent = person.bezahlt ? "Bezahlt ✓" : "Als bezahlt setzen";
bezahltButton.style.marginLeft = "10px";
bezahltButton.style.width = "auto";
bezahltButton.style.padding = "6px 10px";
bezahltButton.style.fontSize = "14px";

bezahltButton.onclick = async function () {
  await updateDoc(doc(db, "warteschlange", person.id), {
    bezahlt: true
  });
};

eintrag.appendChild(bezahltButton);
      liste.appendChild(eintrag);
    });
  } else {
    liste.innerHTML = "<li>Namen sind nur für die Turnierleitung sichtbar.</li>";
  }
});
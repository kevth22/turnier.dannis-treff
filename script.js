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
  
 let istAdmin = sessionStorage.getItem("admin") === "true"; 
  
let letzteAnmeldung = 0;  
const cooldownSekunden = 25;  
  
window.anmelden = async function () {  
  const nicknameFeld = document.getElementById("nickname");
const vornameFeld = document.getElementById("vorname");
const nachnameFeld = document.getElementById("nachname");

const nickname = nicknameFeld.value.trim();
const vorname = vornameFeld.value.trim();
const nachname = nachnameFeld.value.trim();
  
const jetzt = Date.now();  
  
if (jetzt - letzteAnmeldung < cooldownSekunden * 1000) {  
  const rest = Math.ceil((cooldownSekunden * 1000 - (jetzt - letzteAnmeldung)) / 1000);  
  alert("Bitte warte noch " + rest + " Sekunden bis zur nächsten Anmeldung.");  
  return;  
}  
  
const honeypot = document.getElementById("honeypot").value;  
  
if (honeypot !== "") {  
  alert("Spam erkannt.");  
  return;  
}  
  
if (nickname.length < 2 || vorname.length < 2 || nachname.length < 2) {
  alert("Bitte Spitzname, Vorname und Nachname eintragen.");
  return;
}

if (nickname.length > 30 || vorname.length > 30 || nachname.length > 30) {
  alert("Eine Eingabe ist zu lang.");
  return;
}

const erlaubteZeichen = /^[a-zA-ZäöüÄÖÜß0-9\s\-]+$/;

if (
  !erlaubteZeichen.test(nickname) ||
  !erlaubteZeichen.test(vorname) ||
  !erlaubteZeichen.test(nachname)
) {
  alert("Bitte verwende nur Buchstaben, Zahlen, Leerzeichen oder Bindestriche.");
  return;
}  
  
 const existiert = await new Promise((resolve) => {  
  onSnapshot(warteschlangeRef, (snapshot) => {  
    let gefunden = false;  
  
    snapshot.forEach((dokument) => {  
      const spieler = dokument.data();  
  
      if (
  spieler.nickname &&
  spieler.nickname.toLowerCase() === nickname.toLowerCase()
) {
  gefunden = true;
      }
    });  
  
    resolve(gefunden);  
  });  
});  
  
if (existiert) {  
  alert("Dieser Spitzname steht bereits in der Warteschlange.");  
  return;  
}  
await addDoc(warteschlangeRef, {
  nickname: nickname,
  vorname: vorname,
  nachname: nachname,
  bezahlt: false,
  zeit: Date.now()
});  
const msg = document.getElementById("successMessage");
msg.style.display = "block";

// nur einmal anzeigen + danach verstecken
setTimeout(() => {
  msg.style.display = "none";
}, 6000);  
letzteAnmeldung = Date.now();  
  
const paypalLink = document.getElementById("paypalLink");  
paypalLink.href = "https://paypal.me/DanielaRoth222";  
paypalLink.classList.remove("disabled");  
  
alert("Anmeldung gespeichert. Bitte jetzt 10€ per PayPal zahlen.");  
  
nicknameFeld.value = "";
vornameFeld.value = "";
nachnameFeld.value = "";  
};  
  
onSnapshot(warteschlangeRef, (snapshot) => {  
  const warteschlangeListe = document.getElementById("warteschlange");
const bezahlteListe = document.getElementById("bezahlteListe");

warteschlangeListe.innerHTML = "";
bezahlteListe.innerHTML = "";  
  
  const spieler = [];  
  
  snapshot.forEach((dokument) => {  
    spieler.push({  
      id: dokument.id,  
      ...dokument.data()  
    });  
  });  
  
  spieler.sort((a, b) => a.zeit - b.zeit);  
const bezahlteSpieler = spieler.filter((person) => person.bezahlt === true);  
const wartendeSpieler = spieler.filter((person) => person.bezahlt !== true);  

const belegte = bezahlteSpieler.length;
const wartend = wartendeSpieler.length;

document.getElementById("belegt").innerHTML =
  belegte + ' / <span class="infinity-status">∞</span>';

document.getElementById("wartend").textContent = wartend;

// Bei unbegrenzten Plätzen macht Prozent-Balken keinen Sinn
document.getElementById("barBelegt").style.width = "100%";
document.getElementById("barWartend").style.width = "100%";  
  const anzahlAnzeige = document.getElementById("anzahl");  
  if (anzahlAnzeige) {  
    anzahlAnzeige.textContent = spieler.length;  
  }  
  
  if (istAdmin) {
  spieler.forEach((person) => {
    const eintrag = document.createElement("li");

    eintrag.innerHTML = `
      <div class="spieler-admin">
        <div>
          <strong>${person.nickname || "Kein Spitzname"}</strong><br>
          <small>${person.vorname || ""} ${person.nachname || ""}</small>
        </div>
        <span class="${person.bezahlt ? "status-bezahlt" : "status-wartend"}">
          ${person.bezahlt ? "Bezahlt ✓" : "Warteschlange"}
        </span>
      </div>
    `;

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
    bezahltButton.disabled = person.bezahlt === true;
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

    if (person.bezahlt === true) {
      bezahlteListe.appendChild(eintrag);
    } else {
      warteschlangeListe.appendChild(eintrag);
    }
  });
} else {
  spieler.forEach((person) => {
    const eintrag = document.createElement("li");
    eintrag.classList.add("spieler-zeile");

if (person.bezahlt === true) {
  eintrag.innerHTML = `
    <span>${person.nickname || "Kein Spitzname"}</span>
    <span class="status-bezahlt">Bezahlt ✓</span>
  `;
} else {
  eintrag.innerHTML = `
    <span>${person.nickname || "Kein Spitzname"}</span>
    <span class="status-wartend">Warteschlange</span>
  `;
}

    if (person.bezahlt === true) {
      bezahlteListe.appendChild(eintrag);
    } else {
      warteschlangeListe.appendChild(eintrag);
    }
    });
}
});
window.adminLogin = function () {
  const passwort = prompt("Admin Passwort:");

  if (passwort === "22.08.2002.Kr") {
    sessionStorage.setItem("admin", "true");
    location.reload();
  } else {
    alert("Falsches Passwort");
  }
};

function spielerFreigeben() {
  alert("Hier kannst du später Spieler aus Warteschlange übernehmen");
}

function listeLeeren() {
  localStorage.clear();
  location.reload();
}
function starteCountdown() {
  const zielDatum = new Date("2026-05-24T11:30:00"); // dein Turnierstart

  function updateCountdown() {
    const jetzt = new Date();
    const diff = zielDatum - jetzt;

    if (diff <= 0) {
      document.getElementById("timer").innerHTML = "🚀 Turnier läuft!";
      return;
    }

    const tage = Math.floor(diff / (1000 * 60 * 60 * 24));
    const stunden = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minuten = Math.floor((diff / (1000 * 60)) % 60);
    const sekunden = Math.floor((diff / 1000) % 60);

document.getElementById("timer").innerHTML =
  `${tage} : ${stunden.toString().padStart(2,"0")} : ${minuten.toString().padStart(2,"0")} : ${sekunden.toString().padStart(2,"0")}`;
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

starteCountdown();
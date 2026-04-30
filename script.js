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
  const nameFeld = document.getElementById("spielerName");  
  const name = nameFeld.value.trim();  
  
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
  
if (name.length < 3) {  
  alert("Bitte gib einen gültigen Namen ein.");  
  return;  
}  
  
if (name.length > 30) {  
  alert("Der Name ist zu lang.");  
  return;  
}  
  
const erlaubteZeichen = /^[a-zA-ZäöüÄÖÜß\s\-]+$/;  
  
if (!erlaubteZeichen.test(name)) {  
  alert("Bitte verwende nur Buchstaben, Leerzeichen oder Bindestriche.");  
  return;  
}  
  
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
const maxPlaetze = ∞;  
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

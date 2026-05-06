import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc
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

let aktuellerBenutzer = null;

window.login = async function () {
  const benutzername = document.getElementById("loginUser").value.trim().toLowerCase();
  const passwort = document.getElementById("loginPass").value.trim();

  const fehler = document.getElementById("loginFehler");
  fehler.style.display = "none";

  try {
    if (!benutzername || !passwort) {
      fehler.textContent = "Bitte Benutzername und Passwort eingeben.";
      fehler.style.display = "block";
      return;
    }

    const userRef = doc(db, "mitglieder", benutzername);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      fehler.textContent = "Benutzername nicht gefunden.";
      fehler.style.display = "block";
      return;
    }

    const daten = userSnap.data();

    if (daten.aktiv !== true) {
      fehler.textContent = "Dieser Benutzer ist nicht aktiv.";
      fehler.style.display = "block";
      return;
    }

    if (daten.passwort !== passwort) {
      fehler.textContent = "Passwort falsch.";
      fehler.style.display = "block";
      return;
    }

    aktuellerBenutzer = {
      ...daten,
      benutzername: benutzername
    };

    if (aktuellerBenutzer.mussPasswortAendern === true) {
      document.getElementById("loginBox").style.display = "none";
      document.getElementById("passwortBox").style.display = "block";
      return;
    }

    localStorage.setItem("dart11enLogin", JSON.stringify(aktuellerBenutzer));
    sessionStorage.setItem("user", JSON.stringify(aktuellerBenutzer));

    window.location.replace("index.html");

  } catch (error) {
    fehler.textContent = "Fehler beim Login: " + error.message;
    fehler.style.display = "block";
    console.error(error);
  }
};

window.passwortAendern = async function () {
  const p1 = document.getElementById("neuesPasswort").value.trim();
  const p2 = document.getElementById("neuesPasswort2").value.trim();

  const fehler = document.getElementById("passwortFehler");
  fehler.style.display = "none";

  try {
    if (p1.length < 4) {
      fehler.textContent = "Das Passwort muss mindestens 4 Zeichen haben.";
      fehler.style.display = "block";
      return;
    }

    if (p1 !== p2) {
      fehler.textContent = "Die Passwörter stimmen nicht überein.";
      fehler.style.display = "block";
      return;
    }

    if (!aktuellerBenutzer) {
      fehler.textContent = "Fehler: Kein Benutzer gefunden. Bitte neu einloggen.";
      fehler.style.display = "block";
      return;
    }

    const userRef = doc(db, "mitglieder", aktuellerBenutzer.benutzername);

    await updateDoc(userRef, {
      passwort: p1,
      mussPasswortAendern: false
    });

    aktuellerBenutzer.passwort = p1;
    aktuellerBenutzer.mussPasswortAendern = false;

    localStorage.setItem("dart11enLogin", JSON.stringify(aktuellerBenutzer));
    sessionStorage.setItem("user", JSON.stringify(aktuellerBenutzer));

    window.location.replace("index.html");

  } catch (error) {
    fehler.textContent = "Fehler beim Passwort ändern: " + error.message;
    fehler.style.display = "block";
    console.error(error);
  }
};

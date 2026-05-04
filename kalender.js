import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDocs
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

const kalenderRef = collection(db, "kalender_anmeldungen");

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
    sessionStorage.setItem("user", JSON.stringify(gefunden));
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("kalenderBereich").style.display = "block";
    document.getElementById("loginFehler").style.display = "none";
  } else {
    document.getElementById("loginFehler").style.display = "block";
  }
};

window.eintragen = async function (spieltag, inputId) {
  const input = document.getElementById(inputId);
  const name = input.value.trim();

  if (name.length < 2) {
    alert("Bitte Namen eingeben.");
    return;
  }

  await addDoc(kalenderRef, {
    spieltag: spieltag,
    name: name,
    erstelltAm: serverTimestamp()
  });

  input.value = "";
};

onSnapshot(kalenderRef, (snapshot) => {
  const liste1 = document.getElementById("liste1");
  const liste2 = document.getElementById("liste2");

  if (!liste1 || !liste2) return;

  liste1.innerHTML = "";
  liste2.innerHTML = "";

  snapshot.forEach((doc) => {
    const data = doc.data();
    const li = document.createElement("li");
    li.textContent = data.name;

    if (data.spieltag === "spieltag1") liste1.appendChild(li);
    if (data.spieltag === "spieltag2") liste2.appendChild(li);
  });
});

const gespeicherterUser = sessionStorage.getItem("user");

if (gespeicherterUser) {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("kalenderBereich").style.display = "block";
}
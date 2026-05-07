import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc
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

function closeVotePopup() {
  const popup = document.getElementById("votePopup");
  if (popup) popup.style.display = "none";
}

window.closeVotePopup = closeVotePopup;

async function checkVotePopup() {
  const popup = document.getElementById("votePopup");
  if (!popup) return;

  const gespeicherterUser = localStorage.getItem("dart11enLogin");
  if (!gespeicherterUser) return;

  const user = JSON.parse(gespeicherterUser);

  const erlaubteRollen = ["mitglied", "captain", "admin"];

  if (!erlaubteRollen.includes(user.rolle)) return;

  const spieltageSnap = await getDocs(collection(db, "spieltage"));

  let spieltage = [];

  spieltageSnap.forEach((docSnap) => {
    spieltage.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  spieltage = spieltage
    .filter(spieltag => {
      const datum = new Date(spieltag.datum);
      datum.setHours(0, 0, 0, 0);
      return datum >= heute;
    })
    .sort((a, b) => new Date(a.datum) - new Date(b.datum));

  if (spieltage.length === 0) return;

  const naechsterSpieltag = spieltage[0];
const popupText = document.getElementById("votePopupText");

if (popupText) {
  const gegnerText =
    naechsterSpieltag.typ === "heim"
      ? `Dart11en : ${naechsterSpieltag.ort}`
      : `${naechsterSpieltag.ort} : Dart11en`;

  popupText.innerHTML = `
    Du hast für diesen Spieltag noch keine Verfügbarkeit angegeben:<br><br>
    <strong>${naechsterSpieltag.liga}</strong><br>
    ${gegnerText}<br>
    ${naechsterSpieltag.datum}<br>
Treffen: ${naechsterSpieltag.treffen || "-"}<br>
Anwurf: ${naechsterSpieltag.anwurf}
  `;
}
  const zusageId =
    `${naechsterSpieltag.id}_${user.benutzername}`;

  const zusageRef = doc(db, "zusagen", zusageId);
  const zusageSnap = await getDoc(zusageRef);

  if (!zusageSnap.exists()) {
    popup.style.display = "flex";
  }
}

document.addEventListener("DOMContentLoaded", checkVotePopup);

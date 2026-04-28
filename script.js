import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtQ3pECcZEIloI4QTV5G-7_QcoRvVGHL4",
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

window.anmelden = async function () {
  const nameFeld = document.getElementById("spielerName");
  const name = nameFeld.value.trim();

  if (name === "") {
    alert("Bitte gib deinen Namen ein.");
    return;
  }
const existiert = document.querySelectorAll("#warteschlange li");

for (let i = 0; i < existiert.length; i++) {
  if (existiert[i].textContent.toLowerCase() === name.toLowerCase()) {
    alert("Name bereits in der Liste!");
    return;
  }
}
  await addDoc(warteschlangeRef, {
    name: name,
    zeit: Date.now()
  });

  nameFeld.value = "";
};

onSnapshot(warteschlangeRef, (snapshot) => {
  const liste = document.getElementById("warteschlange");
  liste.innerHTML = "";

  const spieler = [];

  snapshot.forEach((doc) => {
    spieler.push(doc.data());
  });

  spieler.sort((a, b) => a.zeit - b.zeit);

  spieler.forEach((person) => {
    const eintrag = document.createElement("li");
    eintrag.textContent = person.name;
    liste.appendChild(eintrag);
  });
});
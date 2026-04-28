import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAVLhBhm3fDGoU1llgqDosX0klwDPW3Qs",
  authDomain: "warteschlange-bb76f.firebaseapp.com",
  projectId: "warteschlange-bb76f",
  storageBucket: "warteschlange-bb76f.appspot.com",
  messagingSenderId: "1057635637589",
  appId: "1:1057635637589:web:2a91840733d32ed31d77dc"
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
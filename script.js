import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  const istAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

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

  spieler.forEach((person) => {
    const eintrag = document.createElement("li");
    eintrag.textContent = person.name;

    if (istAdmin) {
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
    }

    liste.appendChild(eintrag);
  });
});
  deleteDoc,
  doc
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

  await addDoc(warteschlangeRef, {
    name: name,
    zeit: Date.now()
  });
alert("in Firebase gespeichert!");

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
console.log("Turnier-Center geladen");

// Rolle prüfen
const gespeicherterUser = localStorage.getItem("dart11enLogin");

let aktuellerUser = null;
let istAdmin = false;

if (gespeicherterUser) {
  try {
    aktuellerUser = JSON.parse(gespeicherterUser);
    istAdmin = aktuellerUser?.rolle === "admin";
  } catch (e) {
    aktuellerUser = null;
    istAdmin = false;
  }
}

// Adminbereiche anzeigen/verstecken
const adminElemente = document.querySelectorAll(".admin-only");

adminElemente.forEach((element) => {
  element.style.display = istAdmin ? "block" : "none";
});

console.log("Aktueller User:", aktuellerUser);
console.log("Ist Admin:", istAdmin);

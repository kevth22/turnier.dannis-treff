let warteschlange = JSON.parse(localStorage.getItem("warteschlange")) || [];

anzeigen();

function anmelden() {
  const nameFeld = document.getElementById("spielerName");
  const name = nameFeld.value.trim();

  if (name === "") {
    alert("Bitte gib deinen Namen ein.");
    return;
  }

  warteschlange.push(name);
  speichern();
  nameFeld.value = "";

  anzeigen();
}

function anzeigen() {
  const liste = document.getElementById("warteschlange");
  liste.innerHTML = "";

  warteschlange.forEach(function(name) {
    const eintrag = document.createElement("li");
    eintrag.textContent = name;
    liste.appendChild(eintrag);
  });
}

function speichern() {
  localStorage.setItem("warteschlange", JSON.stringify(warteschlange));
}
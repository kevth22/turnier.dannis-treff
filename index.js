function closeVotePopup() {
  const popup = document.getElementById("votePopup");

  if (popup) {
    popup.style.display = "none";
  }
}

function checkVotePopup() {
  const popup = document.getElementById("votePopup");

  if (!popup) return;

  const rolle = sessionStorage.getItem("rolle");

  const darfPopupSehen =
    rolle === "mitglied" ||
    rolle === "captain" ||
    rolle === "admin";

  // Später ersetzen wir das durch echte Firebase-Prüfung
  const hatAbgestimmt = false;

  if (darfPopupSehen && !hatAbgestimmt) {
    popup.style.display = "flex";
  }
}

window.closeVotePopup = closeVotePopup;

document.addEventListener("DOMContentLoaded", checkVotePopup);

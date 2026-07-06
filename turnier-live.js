console.log("Turnier-Center geladen");

document.addEventListener("DOMContentLoaded", () => {
  const gespeicherterUser = localStorage.getItem("dart11enLogin");

  let aktuellerUser = null;
  let istAdmin = false;

  if (gespeicherterUser) {
    try {
      aktuellerUser = JSON.parse(gespeicherterUser);
      const rolle = (aktuellerUser?.rolle || "").toLowerCase().trim();
      istAdmin = rolle === "admin";
    } catch (e) {
      localStorage.removeItem("dart11enLogin");
      istAdmin = false;
    }
  }

  if (istAdmin) {
    document.body.classList.add("is-admin");
  } else {
    document.body.classList.remove("is-admin");

    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = "none";
    });
  }

  console.log("User:", aktuellerUser);
  console.log("Admin:", istAdmin);
});

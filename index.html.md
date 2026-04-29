<!DOCTYPE html>  
<html lang="de">  
<head>  
  <meta charset="UTF-8">  
  <title>Dannis Treff Dart Turnier</title>  
  <link rel="stylesheet" href="style.css">  
</head>  
<body>  
  
<header class="navbar">  
    <div class="logo-box">  
        <img src="dart11enlogo.png" class="logo">  
        <span class="logo-text">Dannis Treff</span>  
    </div>  
  
    <nav class="menu">  
        <a href="#">Turniere</a>  
        <a href="#">Regeln</a>  
        <a href="#">Kontakt</a>  
    </nav>  
</header>  
  
<main class="hero">  
  
  <section class="info">  
    <p class="red">DART TURNIER</p>  
    <h1>DANNIS TREFF<br>Turnier 2026</h1>  
    <h2>Melde dich an und sei dabei!</h2>  
  
    <p>📅 Spieltag 1: 24.05.2026</p>  
    <p>📍 Dannis Treff Emil-Zimmermann Allee 10 45897 Gelsenkirchen</p>  
    <p>👥 Max. 64 Teilnehmer</p>  
    <p>💶 Startgeld: 10,00 €</p>  
  </section>  
  
  <section class="anmeldung">  
    <h2>👥 Jetzt anmelden</h2>  
  
    <input type="text" id="spielerName" placeholder="Dein Name">  
  
<input type="text" id="honeypot" style="display:none" autocomplete="off">  
  
<div class="datenschutz-box">  
  <p>  
    Bitte lies vor der Anmeldung unsere   
    <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a>.  
  </p>  
  
  <label>  
    <input type="checkbox" id="datenschutzCheck">  
    Ich habe die Datenschutzerklärung gelesen und akzeptiere die Verarbeitung meiner Daten zur Turnieranmeldung.  
  </label>  
</div>  
  
<div class="regelwerk-box">  
  <p>  
    Bitte lies vor der Anmeldung unser   
    <a href="regeln.html" target="_blank">Regelwerk</a>.  
  </p>  
  
  <label>  
    <input type="checkbox" id="regelCheck">  
    Ich habe das Regelwerk gelesen und akzeptiere es.  
  </label>  
</div>  
  
<button id="anmeldeButton" onclick="anmelden()" disabled>  
  Anmeldung absenden  
</button>  
  
    <p class="hinweis">Dein Platz wird live in der Warteschlange angezeigt.</p>  
  </section>  
  
</main>  
  
  
  
<section class="status">  
  
  <div class="box">  
    <div class="icon">👥</div>  
    <div id="belegt">0 / 64</div>  
    <small>BELEGTE PLÄTZE</small>  
    <div class="bar">  
      <div id="barBelegt"></div>  
    </div>  
  </div>  
  
  <div class="box">  
    <div class="icon">⏳</div>  
    <div id="wartend">0</div>  
    <small>WARTESCHLANGE</small>  
    <div class="bar">  
      <div id="barWartend"></div>  
    </div>  
  </div>  
  
  <div class="box">  
    <div class="icon">€</div>  
    <div>10,00 €</div>  
    <small>STARTGELD</small>  
  </div>  
  
</section>  
  
<section class="liste">  
  <h2>Aktuelle Warteschlange</h2>  
  <ol id="warteschlange"></ol>  
</section>  
  
<section class="info-zahlung">  
  
  <!-- LINKS: Ablauf -->  
  <div class="ablauf">  
    <h2>So funktioniert's</h2>  
  
    <div class="steps">  
      <div class="step">  
        <div class="nummer">1</div>  
        <div>  
          <h3>Anmeldung</h3>  
          <p>Fülle das Formular aus und sende deine Anmeldung ab.</p>  
        </div>  
      </div>  
  
      <div class="step">  
        <div class="nummer">2</div>  
        <div>  
          <h3>Zahlung</h3>  
          <p>Überweise das Startgeld per PayPal.</p>  
        </div>  
      </div>  
  
      <div class="step">  
        <div class="nummer">3</div>  
        <div>  
          <h3>Platz sichern</h3>  
          <p>Nach Zahlungseingang rutschst du in die Teilnehmerliste.</p>  
        </div>  
      </div>  
  
      <div class="step">  
        <div class="nummer">4</div>  
        <div>  
          <h3>Turnier spielen</h3>  
          <p>Komm am Spieltag vorbei und spiel dein Turnier!</p>  
        </div>  
      </div>  
    </div>  
  </div>  
  
  <!-- RECHTS: PayPal -->  
  <div class="zahlung-box">  
    <h2>💳 Zahlung per PayPal</h2>  
  
    <p>Bitte sende das Startgeld in Höhe von <strong>10,00 €</strong> an:</p>  
  
    <a href="#" id="paypalLink" class="paypal-btn disabled" target="_blank">  
  👉 paypal.me/DannisTreff  
</a>  
  
    <div class="hinweis-zahlung">  
      <p><strong>Wichtig:</strong></p>  
      <ul>  
        <li>Bitte Name + Turniertag angeben</li>  
        <li>Anmeldung erst nach Zahlung gültig</li>  
        <li>Keine Rückerstattung bei Nichterscheinen</li>  
      </ul>  
    </div>  
  </div>  
  
</section>  
  
<footer>  
  Dannis Treff Dart Turnier 2026<br>  
  <a href="impressum.html">Impressum</a> |   
  <a href="datenschutz.html">Datenschutz</a>  
</footer>  
  
<script type="module" src="script.js"></script>  
  
<script>  
  const checkboxDatenschutz = document.getElementById("datenschutzCheck");  
  const checkboxRegel = document.getElementById("regelCheck");  
  const button = document.getElementById("anmeldeButton");  
  const nameInput = document.getElementById("spielerName");  
  
  function checkForm() {  
    const nameOk = nameInput.value.trim().length > 0;  
    const datenschutzOk = checkboxDatenschutz.checked;  
    const regelOk = checkboxRegel.checked;  
  
    button.disabled = !(nameOk && datenschutzOk && regelOk);  
  }  
  
  checkboxDatenschutz.addEventListener("change", checkForm);  
  checkboxRegel.addEventListener("change", checkForm);  
  nameInput.addEventListener("input", checkForm);  
</script>  
  
</body>  
</html>  
  

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
  
<footer>  
  Dannis Treff Dart Turnier 2026<br>  
  <a href="impressum.html">Impressum</a> |   
  <a href="datenschutz.html">Datenschutz</a>  
</footer>  
  
<script type="module" src="script.js"></script>  
  
<script>  
  const checkbox = document.getElementById("datenschutzCheck");  
  const button = document.getElementById("anmeldeButton");  
  
  checkbox.addEventListener("change", function () {  
    button.disabled = !checkbox.checked;  
  });  
</script>  
</body>  
</html>  
  

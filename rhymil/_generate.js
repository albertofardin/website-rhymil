// generate.js
// Usage: node _generate.js
// Genera un index.html in ciascuna delle cartelle target

const fs = require('fs');
const path = require('path');

// Cartelle target
const TARGET = [
  'nuova-fratellanza-dei-pirati',
  'ordine-dei-cavalieri',
  'ordine-dei-paladini',
  'ordine-dei-maghi',
  'ordine-clericale',
  'terre-barbariche',
  'stato-del-popolo-libero'
];

// --- Helpers ---
function readJsonTolerant(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8').trim();
  raw = raw.replace(/^\uFEFF/, '');           // rimuove BOM
  raw = raw.replace(/,\s*([}\]])/g, '$1');    // rimuove trailing comma
  return JSON.parse(raw);
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function articleHTML(dir,{ name, owner, image, text }) {
  const imgFile = `./${dir}/${image || ''}`;
  const ownerHTML = owner ? `<span>- ${escapeHtml(owner)}</span>` : ""
  return `
    <article>
      <a class="thumbnail" href="${imgFile}.png"><img src="${imgFile}.jpg" alt="" /></a>
      <h2>${escapeHtml(name)} ${ownerHTML}</h2>
      <p>
        ${escapeHtml(text || '')}
      </p>
    </article>
  `;
}

function buildHtml({ title, intro, playersHTML, mastersHTML }) {
  return `<!DOCTYPE HTML>
<html>
  <head>
    <title>Rhymil | ${escapeHtml(title)}</title>
    <link rel="manifest" href="../icons/manifest.webmanifest">
    <link rel="icon" href="../icons/favicon.ico" type="image/x-icon">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="./assets/main.css" />
  </head>
  <body class="is-preload-0 is-preload-1 is-preload-2">
    <!-- Main -->
    <div id="main">
      <!-- Header -->
      <header id="header">
        <a href="../index.html" class="home-button" title="Torna alla home">
          <svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
          Home
        </a>
        <h1>${escapeHtml(title)}</h1>
        <p>
          ${escapeHtml(intro)}
        </p>
      </header>

      <!-- Thumbnail -->
      <section id="thumbnails">
        ${playersHTML}
        ${mastersHTML}
      </section>

      <!-- Footer -->
      <footer id="footer">
        <ul class="icons">
          <li><a
            href="https://www.instagram.com/rhymil_/"
            class="icon brands fa-instagram"><span class="label">
            Instagram</span></a></li>
          <li><a
            href="https://www.facebook.com/profile.php?id=100063593580176"
            class="icon brands fa-facebook-square"><span class="label">
            Facebook</span></a></li>
          <li><a
            href="https://wa.me/3453293560"
            class="icon brands fa-whatsapp"><span class="label">
            Whatsapp</span></a></li>
          <li><a
            href="https://rhymil.arcanadomine.it/dashboard.php"
            class="icon solid fa-globe-americas"><span class="label">
            website</span></a></li>
          <li><a
            href="mailto:rhymil.info@gmail.com"
            class="icon solid fa-envelope"><span class="label">
            Email</span></a></li>
        </ul>
        <ul class="copyright">
          <li>&copy; <a href="https://www.arcanadomine.it/">Arcana Domine</a></li>
          <li>design by <a href="https://www.mandragora.ws/">Mandragora Web Studio</a></li>
        </ul>
    </div>

    <!-- Scripts -->
    <script src="./assets/js/jquery.min.js"></script>
    <script src="./assets/js/browser.min.js"></script>
    <script src="./assets/js/breakpoints.min.js"></script>
    <script src="./assets/js/main.js"></script>
  </body>
</html>
`;
}

// --- Main ---
(function main() {
  let ok = 0, warn = 0;

  for (const dir of TARGET) {
    const dirPath = path.resolve(process.cwd());
    const docPath = path.join(dirPath, dir+'.json');
    const outPath = path.join(dirPath, dir+'.html');

    if (!fs.existsSync(docPath)) {
      console.warn(`⚠️  ${dir}.json non trovato`);
      warn++;
      continue;
    }

    try {
      const data = readJsonTolerant(docPath);
      const title = data.name || 'Titolo';
      const intro = data.text || '';
      const players = Array.isArray(data.players) ? data.players : [];
      const masters = Array.isArray(data.masters) ? data.masters : [];

      const playersHTML = players.map((a)=>articleHTML(dir,a)).join('\n');
      const mastersHTML = masters.map((a)=>articleHTML(dir,a)).join('\n');

      const html = buildHtml({
        title,
        intro,
        playersHTML,
        mastersHTML
      });

      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`✅ Generato: ${path.relative(process.cwd(), outPath)}`);
      ok++;
    } catch (err) {
      console.error(`❌ Errore in ${dir}: ${err.message}`);
      warn++;
    }
  }

  console.log(`\nFinito. Successi: ${ok}, Avvisi/Errori: ${warn}`);
})();

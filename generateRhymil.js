#!/usr/bin/env node
/**
 * Genera/aggiorna più <section id="section-..."> in index.html
 * leggendo i vari JSON dentro la cartella specificata (default: ./rhymil).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---- Config/Target ---------------------------------------------------------
const TARGET = [
  "ordine-dei-paladini",
  "ordine-dei-cavalieri",
  "ordine-clericale",
  "ordine-dei-maghi",
  "fratellanza-dei-pirati",
  "stato-del-popolo-libero",
  "terre-barbariche",
];

// ---- Utils -----------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleFromSlug(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Permette JSON un po' "lasco": commenti/trailing commas/BOM
function loadJsonLoose(p) {
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/^\uFEFF/, ""); // BOM
  s = s.replace(/\/\/.*$/gm, ""); // // comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, ""); // /* */ comments
  s = s.replace(/,(\s*[}\]])/g, "$1"); // trailing comma
  return JSON.parse(s);
}

// Hash breve del contenuto del file: l'URL cambia solo se cambia l'immagine,
// così un bump di versione del sito non invalida la cache delle immagini.
const hashCache = new Map();
function fileHash(relPath) {
  if (hashCache.has(relPath)) return hashCache.get(relPath);
  let h = "missing";
  try {
    h = crypto
      .createHash("md5")
      .update(fs.readFileSync(relPath))
      .digest("hex")
      .slice(0, 8);
  } catch {
    console.warn(`⚠️  Immagine mancante: ${relPath}`);
  }
  hashCache.set(relPath, h);
  return h;
}

// ---- Markup builders -------------------------------------------------------
// `shortName`: nei thumb dei giocatori mostra solo la prima parola del nome
function anchorFor(item, shortName = false) {
  const imgName = (item.image || "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
  const largePath = `./rhymil_images/_large/${imgName}.webp`;
  const thumbPath = `./rhymil_images/_thumb/${imgName}.webp`;
  const hrefImage = `/rhymil_images/_large/${imgName}.webp?v=${fileHash(largePath)}`;
  const hrefThumb = `/rhymil_images/_thumb/${imgName}.webp?v=${fileHash(thumbPath)}`;
  const name = escapeHtml(item.name || "");
  const owner = escapeHtml(item.owner || "");
  const text = escapeHtml(item.text || "");
  const quote = escapeHtml(item.quote || "");

  const attrs = [
    `href="${hrefImage}"`,
    `title="${name}"`,
    `data-name="${name}"`,
    owner ? `data-owner="${owner}"` : "",
    quote ? `data-quote="${quote}"` : "",
    text ? `data-desc="${text}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const thumbName = shortName
    ? escapeHtml((item.name || "").trim().split(/\s+/)[0] || "")
    : name;

  return `
  <a ${attrs}>
    <span class="thumb-name">${thumbName}</span>
    <img src="${hrefThumb}" width="110" alt="${name}" loading="lazy" />
  </a>`;
}

function buildSection(slug, data) {
  const players = [].concat(data.players || []);
  const masters = [].concat(data.masters || []);
  return `
  <section id="section-${slug}" class="panel-section">
    <h3 class="panel-title">
      ${escapeHtml(data.icon) + " " + escapeHtml(data.name)}
    </h3>
    <header>
      <p>${escapeHtml(data.text)}</p>
    </header>
    <div class="char-gallery" id="gallery--${slug}" data-faction-icon="${escapeHtml(data.icon)}" data-faction-name="${escapeHtml(data.name)}">
      <h4 class="gallery-title">Giocatori</h4>
      ${players.map((p) => anchorFor(p, true)).join("\n")}
  <a class="thumb-add" href="https://forms.gle/bpCPzV4x4QBi88eN8" target="_blank" rel="noopener" aria-label="Aggiungi il tuo PG">
    <span class="icon solid fa-user-plus"></span>
    <span>Modifica<br/>personaggi</span>
  </a>
      ${masters.length === 0 ? "" : `<h4 class="gallery-title">Master</h4>`}
      ${masters.map((p) => anchorFor(p)).join("\n")}
    </div>
  </section>`;
}

// ===== Builders & upsert per <article> in .factions ====================
function buildArticle(slug) {
  // Rispetta la struttura richiesta
  return `
        <article>
          <a
            href="#"
            data-panel-open
            data-panel-target="#section-${slug}"
          >
            <img src="./rhymil/${slug}.png" />
          </a>
        </article>`;
}

function upsertArticle(html, slug, articleHtml) {
  // 1) trova l'apertura esatta di <div class="factions">
  const openRe = /<div\s+class=["']factions["'][^>]*>/i;
  const openMatch = openRe.exec(html);

  // Se non esiste, crea il blocco prima di </body>
  if (!openMatch) {
    const newBlock = `\n<div class="factions">\n${articleHtml.trim()}\n</div>\n`;
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${newBlock}</body>`);
    }
    return html + newBlock; // fallback estremo
  }

  const openIdx = openMatch.index;
  const afterOpenIdx = openIdx + openMatch[0].length;

  // 2) trova la </div> che chiude proprio questa .factions usando un contatore
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = afterOpenIdx;
  let depth = 1;
  let closeStart = -1;
  let closeEnd = -1;

  for (let m; (m = tagRe.exec(html)); ) {
    if (m[0][1] === "/") depth--;
    else depth++;
    if (depth === 0) {
      // chiusura della .factions
      closeStart = m.index;
      closeEnd = m.index + m[0].length;
      break;
    }
  }

  if (closeStart === -1) {
    console.warn(
      "⚠️ Chiusura </div> di .factions non trovata, nessuna modifica.",
    );
    return html;
  }

  // 3) contenuto interno corrente
  let inner = html.slice(afterOpenIdx, closeStart).replace(/\r\n/g, "\n");

  // 4) elimina TUTTI gli <article> già presenti per lo slug, per evitare duplicati
  const itemRe = new RegExp(
    `<article[\\s\\S]*?data-panel-target="#section-${slug}"[\\s\\S]*?<\\/article>`,
    "ig",
  );
  inner = inner.replace(itemRe, "").trimEnd();

  // 4b) collassa le righe vuote accumulate dalle rimozioni precedenti
  inner = inner.replace(/(\n[ \t]*)+\n/g, "\n");

  // 5) calcola l'indentazione da usare per il nuovo article
  const indentMatch = /\n([ \t]*)<article\b/.exec(inner);
  const indent = indentMatch ? indentMatch[1] : "        "; // 8 spazi default

  // 6) normalizza e indenta l'article da inserire
  const articleIndented =
    articleHtml
      .trim()
      .split("\n")
      .map((line) => indent + line)
      .join("\n") + "\n";

  if (!inner.endsWith("\n")) inner += "\n";
  inner += articleIndented;

  // 7) ricompone l'HTML senza toccare nulla fuori da .factions
  return html.slice(0, afterOpenIdx) + inner + html.slice(closeStart);
}

// Inserisce o sostituisce una section con id specifico
function upsertSection(html, slug, newSection) {
  const sectionRegex = new RegExp(
    `<section\\s+id="section-${slug}"[\\s\\S]*?<\\/section>`,
    "i",
  );

  if (sectionRegex.test(html)) {
    return html.replace(sectionRegex, newSection);
  }

  // Prova ad inserirla subito dopo #section-docs se esiste
  const hookRegex = /<section\s+id="section-docs"[\s\S]*?<\/section>/i;
  if (hookRegex.test(html)) {
    return html.replace(hookRegex, (m) => `${m}\n\n${newSection}`);
  }

  // Fallback: all'inizio di .panel-content
  const panelContentOpen = /(<div\s+class="panel-content"[^>]*>)/i;
  if (panelContentOpen.test(html)) {
    return html.replace(panelContentOpen, (m) => `${m}\n${newSection}\n`);
  }

  // Ultimo fallback: prima di </body>
  const bodyClose = /<\/body>/i;
  if (bodyClose.test(html)) {
    return html.replace(bodyClose, `${newSection}\n</body>`);
  }

  // Se proprio non trova nulla, appende in coda
  return `${html}\n${newSection}\n`;
}

// ---- Main ------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  const dir = args.dir || "./rhymil";
  const htmlPath = args.html || "./index.html";
  const outPath = args.out || htmlPath;

  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ HTML non trovato: ${htmlPath}`);
    process.exit(1);
  }

  let html = fs.readFileSync(htmlPath, "utf8");

  for (const slug of TARGET) {
    const jsonPath = path.join(dir, `${slug}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.warn(`⚠️  JSON mancante per "${slug}": ${jsonPath} (salto)`);
      continue;
    }

    let data;
    try {
      data = loadJsonLoose(jsonPath);
    } catch (err) {
      console.error(`❌ Errore parsing JSON "${slug}": ${err.message}`);
      continue;
    }

    const sectionHtml = buildSection(slug, data);
    const articleHtml = buildArticle(slug);

    html = upsertSection(html, slug, sectionHtml);
    html = upsertArticle(html, slug, articleHtml);

    console.log(`✅ Update: ${slug}`);
  }

  fs.writeFileSync(outPath, html, "utf8");
  console.log(`🏁 File scritto: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});

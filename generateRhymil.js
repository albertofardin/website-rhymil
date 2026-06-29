#!/usr/bin/env node
/**
 * Genera/aggiorna più <section id="section-..."> in index.html
 * leggendo i vari JSON dentro la cartella specificata (default: ./rhymil).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---- Config/Target ---------------------------------------------------------
// Ordine delle sezioni. "_hr" inserisce un divisore: tutto ciò che viene DOPO
// è una sezione "speciale" (vetrina) — senza giocatori né pulsante "aggiungi
// PG". Ogni sezione speciale mostra uno o più gruppi di schede, ciascuno con
// un titolo opzionale, letti da chiavi diverse del JSON.
const HR = "_hr";
const TARGET = [
  "ordine-dei-paladini",
  "ordine-dei-cavalieri",
  "ordine-clericale",
  "ordine-dei-maghi",
  "fratellanza-dei-pirati",
  "stato-del-popolo-libero",
  "terre-barbariche",
  HR,
  "_divinity-demon",
  "_recurring-characters",
];

// Per ogni sezione speciale: i gruppi di schede da mostrare, in ordine.
// `key` è la chiave dell'array nel JSON, `title` l'intestazione (vuota = nessuna),
// `extraClass` eventuali classi sugli anchor (es. "is-dead" per i caduti).
const SPECIAL_GROUPS = {
  "_divinity-demon": [
    { key: "divinity", title: "Divinità" },
    { key: "guardian", title: "Guardiani dell'Equilibrio" },
    { key: "demon", title: "Demoni" },
  ],
  "_recurring-characters": [
    { key: "other", title: "" },
    { key: "dead", title: "☠️ Caduti", extraClass: "is-dead" },
  ],
};

const hrAt = TARGET.indexOf(HR);
const SHOWCASE = new Set(hrAt >= 0 ? TARGET.slice(hrAt + 1) : []);

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
// `extraClass`: classi aggiuntive sull'anchor (es. "is-dead" per i caduti)
function anchorFor(item, shortName = false, extraClass = "") {
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
    extraClass ? `class="${extraClass}"` : "",
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

function thumbs(items, shortName = false, extraClass = "") {
  return []
    .concat(items || [])
    .map((p) => anchorFor(p, shortName, extraClass))
    .join("\n");
}

function deadHeading(dead) {
  return dead.length === 0 ? "" : `<h4 class="gallery-title">☠️ Caduti</h4>`;
}

// Sezioni "speciali" (vetrina): niente giocatori né pulsante "aggiungi PG".
// Mostrano i gruppi di schede definiti in SPECIAL_GROUPS, ciascuno con il
// proprio titolo opzionale, leggendo le chiavi indicate dal JSON.
function buildShowcaseSection(slug, data) {
  const groups = SPECIAL_GROUPS[slug] || [];
  const body = groups
    .map((g) => {
      const items = [].concat(data[g.key] || []);
      if (items.length === 0) return "";
      const heading = g.title
        ? `<h4 class="gallery-title">${g.title}</h4>`
        : "";
      return `${heading}\n${thumbs(items, false, g.extraClass || "")}`;
    })
    .filter(Boolean)
    .join("\n");

  return `
  <section id="section-${slug}" class="panel-section">
    <h3 class="panel-title">
      ${escapeHtml(data.icon) + " " + escapeHtml(data.name)}
    </h3>
    <header>
      <p>${escapeHtml(data.text)}</p>
    </header>
    <div class="char-gallery" id="gallery--${slug}" data-faction-icon="${escapeHtml(data.icon)}" data-faction-name="${escapeHtml(data.name)}">
      ${body}
    </div>
  </section>`;
}

function buildSection(slug, data) {
  if (SHOWCASE.has(slug)) return buildShowcaseSection(slug, data);

  const masters = [].concat(data.masters || []);
  const dead = [].concat(data.dead || []);
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
      ${thumbs(data.players, true)}
  <a class="thumb-add" href="https://forms.gle/bpCPzV4x4QBi88eN8" target="_blank" rel="noopener" aria-label="Aggiungi il tuo PG">
    <span class="icon solid fa-user-plus"></span>
    <span>Modifica<br/>personaggi</span>
  </a>
      ${masters.length === 0 ? "" : `<h4 class="gallery-title">Master</h4>`}
      ${thumbs(masters)}
      ${deadHeading(dead)}
      ${thumbs(dead, false, "is-dead")}
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
            <img src="./rhymil/${slug}.webp" />
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

// Inserisce/riposiziona l'<hr/> divisorio dentro .factions.
// Rimuove eventuali divisori già presenti e lo riaccoda nella posizione
// corrente del ciclo (così l'ordine rispetta TARGET).
function upsertFactionsDivider(html) {
  const openRe = /<div\s+class=["']factions["'][^>]*>/i;
  const openMatch = openRe.exec(html);
  if (!openMatch) {
    console.warn("⚠️ .factions non trovata, <hr/> non inserito.");
    return html;
  }

  const afterOpenIdx = openMatch.index + openMatch[0].length;

  // Trova la </div> che chiude proprio questa .factions usando un contatore
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = afterOpenIdx;
  let depth = 1;
  let closeStart = -1;
  for (let m; (m = tagRe.exec(html)); ) {
    if (m[0][1] === "/") depth--;
    else depth++;
    if (depth === 0) {
      closeStart = m.index;
      break;
    }
  }
  if (closeStart === -1) {
    console.warn("⚠️ Chiusura </div> di .factions non trovata, <hr/> saltato.");
    return html;
  }

  let inner = html.slice(afterOpenIdx, closeStart).replace(/\r\n/g, "\n");

  // Rimuove eventuali divisori già presenti per evitare duplicati
  inner = inner.replace(
    /[ \t]*<hr\b[^>]*class="factions-divider"[^>]*>\n?/gi,
    "",
  );
  inner = inner.replace(/(\n[ \t]*)+\n/g, "\n").trimEnd();

  // Riusa l'indentazione degli <article> esistenti
  const indentMatch = /\n([ \t]*)<article\b/.exec(inner);
  const indent = indentMatch ? indentMatch[1] : "        ";

  if (!inner.endsWith("\n")) inner += "\n";
  inner += `${indent}<hr class="factions-divider" />\n`;

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

// ---- Cleanup immagini orfane ------------------------------------------------
// Elimina da rhymil_images (originali, _large, _thumb) i file non associati
// a nessun personaggio dei JSON.
function cleanupOrphanImages(imagesDir, usedNames) {
  if (!fs.existsSync(imagesDir)) {
    console.warn(
      `⚠️  Cartella immagini non trovata: ${imagesDir} (salto pulizia)`,
    );
    return;
  }

  const dirs = [
    imagesDir,
    path.join(imagesDir, "_large"),
    path.join(imagesDir, "_thumb"),
  ];
  let removed = 0;

  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const base = entry.name.replace(/\.(jpg|jpeg|png|webp)$/i, "");
      if (base === entry.name) continue; // non è un'immagine
      if (usedNames.has(base)) continue;
      const filePath = path.join(d, entry.name);
      fs.unlinkSync(filePath);
      removed++;
      console.log(`🗑️  Rimossa immagine orfana: ${filePath}`);
    }
  }

  if (removed === 0) console.log("✨ Nessuna immagine orfana da rimuovere.");
  else console.log(`🧹 Pulizia completata: ${removed} file rimossi.`);
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
  const usedImages = new Set();
  let parseErrors = 0;

  for (const slug of TARGET) {
    if (slug === HR) {
      html = upsertFactionsDivider(html);
      continue;
    }
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
      parseErrors++;
      continue;
    }

    // Raccoglie le immagini da TUTTI gli array di schede del JSON, così
    // l'aggiunta di nuovi gruppi (es. "guardian") non richiede di toccare
    // questo elenco e non causa cancellazioni di immagini ancora referenziate.
    for (const value of Object.values(data)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        const img = item && typeof item === "object" ? item.image : null;
        const imgName = (img || "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
        if (imgName) usedImages.add(imgName);
      }
    }

    const sectionHtml = buildSection(slug, data);
    const articleHtml = buildArticle(slug);

    html = upsertSection(html, slug, sectionHtml);
    html = upsertArticle(html, slug, articleHtml);

    console.log(`✅ Update: ${slug}`);
  }

  fs.writeFileSync(outPath, html, "utf8");
  console.log(`🏁 File scritto: ${outPath}`);

  // Ultima fase: rimuove le immagini non associate a nessun personaggio.
  // Se un JSON non è stato parsato, salta la pulizia per non cancellare
  // immagini di personaggi che esistono ma non sono stati letti.
  if (parseErrors > 0) {
    console.warn("⚠️  Pulizia immagini saltata: errori di parsing nei JSON.");
  } else {
    cleanupOrphanImages("./rhymil_images", usedImages);
  }
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});

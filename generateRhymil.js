#!/usr/bin/env node
/**
 * Genera/aggiorna più <section id="section-..."> in index.html
 * leggendo i vari JSON dentro la cartella specificata (default: ./rhymil).
 *
 * USO:
 *   node generateRhymil.js
 *   node generateRhymil.js --dir ./rhymil --html ./index.html --out ./index.html --baseRoot rhymil --width 1200 --height 750 --thumb 150
 */

const fs = require('fs');
const path = require('path');

// ---- Config/Target ---------------------------------------------------------
const TARGET = [
  'fratellanza-dei-pirati',
  'stato-del-popolo-libero',
  'ordine-clericale',
  'ordine-dei-maghi',
  'ordine-dei-paladini',
  'ordine-dei-cavalieri',
  'terre-barbariche'
];

// ---- Utils -----------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleFromSlug(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, m => m.toUpperCase());
}

// Permette JSON un po' "lasco": commenti/trailing commas/BOM
function loadJsonLoose(p) {
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/^\uFEFF/, '');                // BOM
  s = s.replace(/\/\/.*$/mg, '');              // // comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');      // /* */ comments
  s = s.replace(/,(\s*[}\]])/g, '$1');         // trailing comma
  return JSON.parse(s);
}

// ---- Version bump ----------------------------------------------------------
function bumpVersionInHtml(html) {
  const re = /(<p\s+class=["']version["'][^>]*>[\s\S]*?\b[vV])(\d+(?:[.,]\d+)?)([\s\S]*?<\/p>)/i;
  const m = html.match(re);
  if (!m) { console.warn('⚠️  Nessun <p class="version">…</p> trovato. Salto incremento.'); return html; }
  const raw = m[2].trim().replace(',', '.');
  const curr = parseFloat(raw);
  if (Number.isNaN(curr)) { console.warn('⚠️  Valore versione non numerico:', raw); return html; }
  const next = Math.round((curr + 0.1) * 10) / 10;
  const nextStr = next.toFixed(1);
  console.log(`🔢 Versione: ${curr.toFixed(1)} → ${nextStr}`);
  return html.replace(re, `$1${nextStr}$3`);
}

// ---- Markup builders -------------------------------------------------------
function anchorFor(item, baseHref) {
  const imgName = (item.image || '').replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const hrefLarge = path.posix.join(baseHref, `${imgName}.png`);
  const hrefThumb = path.posix.join(baseHref, `thumb/${imgName}.png`);
  const name = escapeHtml(item.name || '');
  const owner = escapeHtml(item.owner || '');
  const text = escapeHtml(item.text || '');

  return `
  <a href="${hrefLarge}" data-pswp-width="1080" data-pswp-height="1350" title="${name}">
    <img src="${hrefThumb}" width="110" alt="${name}" loading="lazy" />
    <span class="pswp-caption-content">
      <span class="myimage-name">${name}</span>
      ${owner && `<span class="myimage-owner">- ${owner}</span><br />`}
      <span class="myimage-desc">${text}</span>
    </span>
  </a>`;
}

function buildSection(data, slug, baseHref) {
  const sectionId = `section-${slug}`;
  const galleryId = `gallery--${slug}`;
  const players = (data.players || []).map(p => anchorFor(p, baseHref)).join('\n');
  const masters = (data.masters || []).map(m => anchorFor(m, baseHref)).join('\n');
  return `
  <section id="${sectionId}" class="panel-section">
    <h3 class="panel-title">
      ${escapeHtml(data.icon) + " " + escapeHtml(data.name)}
    </h3>
    <header>
      <p>${escapeHtml(data.text)}</p>
    </header>
    <div class="pswp-gallery" id="${galleryId}">
      ${players}
      ${masters}
    </div>
  </section>`;
}

// ===== Builders & upsert per <article> in .factions ====================
function buildArticle(data, slug) {
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
    if (m[0][1] === '/') depth--; else depth++;
    if (depth === 0) { // chiusura della .factions
      closeStart = m.index;
      closeEnd = m.index + m[0].length;
      break;
    }
  }

  if (closeStart === -1) {
    console.warn('⚠️ Chiusura </div> di .factions non trovata, nessuna modifica.');
    return html;
  }

  // 3) contenuto interno corrente
  let inner = html.slice(afterOpenIdx, closeStart).replace(/\r\n/g, '\n');

  // 4) elimina TUTTI gli <article> già presenti per lo slug, per evitare duplicati
  const itemRe = new RegExp(
    `<article[\\s\\S]*?data-panel-target="#section-${slug}"[\\s\\S]*?<\\/article>`,
    'ig'
  );
  inner = inner.replace(itemRe, '').trimEnd();

  // 5) calcola l'indentazione da usare per il nuovo article
  const indentMatch = /\n([ \t]*)<article\b/.exec(inner);
  const indent = indentMatch ? indentMatch[1] : '        '; // 8 spazi default

  // 6) normalizza e indenta l'article da inserire
  const articleIndented =
    articleHtml
      .trim()
      .split('\n')
      .map(line => indent + line)
      .join('\n') + '\n';

  if (!inner.endsWith('\n')) inner += '\n';
  inner += articleIndented;

  // 7) ricompone l'HTML senza toccare nulla fuori da .factions
  return html.slice(0, afterOpenIdx) + inner + html.slice(closeStart);
}


// Inserisce o sostituisce una section con id specifico
function upsertSection(html, slug, newSection) {
  const sectionRegex = new RegExp(`<section\\s+id="section-${slug}"[\\s\\S]*?<\\/section>`, 'i');

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

  const dir       = args.dir || './rhymil';
  const htmlPath  = args.html || './index.html';
  const outPath   = args.out  || htmlPath;

  // Opzioni immagini/base
  const baseRoot  = (args.baseRoot ? String(args.baseRoot) : 'rhymil').replace(/^\/+|\/+$/g, '');
  const imgWidth  = Number(args.width  || 1200);
  const imgHeight = Number(args.height || 750);
  const thumbW    = Number(args.thumb  || 150);

  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ HTML non trovato: ${htmlPath}`);
    process.exit(1);
  }

  let html = fs.readFileSync(htmlPath, 'utf8');

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

    const baseHref = `/${baseRoot}/${slug}`.replace(/\/{2,}/g, '/');
    const sectionHtml = buildSection(data, slug, baseHref);
    const articleHtml = buildArticle(data, slug);

    html = upsertSection(html, slug, sectionHtml);
    html = upsertArticle(html, slug, articleHtml);

    console.log(`✅ Update: ${slug}`);
  }

  html = bumpVersionInHtml(html);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`🏁 File scritto: ${outPath}`);
}

main().catch(err => {
  console.error('❌ Errore:', err);
  process.exit(1);
});

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
  'ordine-dei-cavalieri',
  'ordine-dei-paladini',
  'ordine-dei-maghi',
  'ordine-clericale',
  'terre-barbariche',
  'stato-del-popolo-libero'
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

function buildSection(data, opts) {
  const { slug, baseHref, width, height, thumbWidth } = opts;
  const sectionId = `section-${slug}`;
  const galleryId = `gallery--${slug}`;
  const lead = data.text ? `<p>${escapeHtml(data.text)}</p>` : '';
  const players = (data.players || []).map(p =>anchorFor(p, baseHref)).join('\n');
  const masters = (data.masters || []).map(m =>anchorFor(m, baseHref)).join('\n');
  return `
  <section id="${sectionId}" class="panel-section">
    <header class="major">
      ${lead}
    </header>
    <div class="pswp-gallery" id="${galleryId}">
      ${players}
      ${masters}
    </div>
  </section>`;
}

// Inserisce o sostituisce una section con id specifico
function upsertSection(html, sectionId, newSection) {
  const sectionRegex = new RegExp(`<section\\s+id="${sectionId}"[\\s\\S]*?<\\/section>`, 'i');

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
    const sectionHtml = buildSection(data, {
      slug,
      baseHref,
      width: imgWidth,
      height: imgHeight,
      thumbWidth: thumbW,
    });

    const sectionId = `section-${slug}`;
    html = upsertSection(html, sectionId, sectionHtml);
    console.log(`✅ Sezione aggiornata: ${sectionId}`);
  }

  html = bumpVersionInHtml(html);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`🏁 File scritto: ${outPath}`);
}

main().catch(err => {
  console.error('❌ Errore:', err);
  process.exit(1);
});

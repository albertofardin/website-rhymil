#!/usr/bin/env node
/**
 * Genera le versioni web delle illustrazioni partendo dagli originali
 * in ./rhymil_images:
 *
 *   rhymil_images/<nome>.png  →  rhymil_images/large/<nome>.webp  (max 1080px)
 *                             →  rhymil_images/thumb/<nome>.webp  (360px, per la griglia)
 *
 * È incrementale: rigenera solo i file mancanti o più vecchi dell'originale.
 * Uso: node generateImages.js [--dir ./rhymil_images] [--force]
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const LARGE_WIDTH = 1080;
const THUMB_WIDTH = 360;
const WEBP_OPTS = { quality: 82 };

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

function isStale(src, out) {
  if (!fs.existsSync(out)) return true;
  return fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs;
}

async function main() {
  const args = parseArgs(process.argv);
  const dir = args.dir || "./rhymil_images";
  const force = Boolean(args.force);

  const largeDir = path.join(dir, "large");
  const thumbDir = path.join(dir, "thumb");
  fs.mkdirSync(largeDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });

  const sources = fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();

  if (sources.length === 0) {
    console.warn(`⚠️  Nessuna immagine trovata in ${dir}`);
    return;
  }

  let done = 0;
  let skipped = 0;

  for (const file of sources) {
    const src = path.join(dir, file);
    const name = file.replace(/\.(png|jpe?g|webp)$/i, "");
    const outLarge = path.join(largeDir, `${name}.webp`);
    const outThumb = path.join(thumbDir, `${name}.webp`);

    const jobs = [];
    if (force || isStale(src, outLarge)) {
      jobs.push(
        sharp(src)
          .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
          .webp(WEBP_OPTS)
          .toFile(outLarge),
      );
    }
    if (force || isStale(src, outThumb)) {
      jobs.push(
        sharp(src)
          .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .webp(WEBP_OPTS)
          .toFile(outThumb),
      );
    }

    if (jobs.length === 0) {
      skipped++;
      continue;
    }
    await Promise.all(jobs);
    done++;
    console.log(`✅ ${name}`);
  }

  console.log(
    `🏁 Convertite ${done} immagini, ${skipped} già aggiornate (large: ${LARGE_WIDTH}px, thumb: ${THUMB_WIDTH}px).`,
  );
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});

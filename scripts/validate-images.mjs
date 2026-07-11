#!/usr/bin/env node
/**
 * Varre o projeto e valida referências a imagens.
 *
 * Regras:
 *  1. Nenhum caminho pode apontar para locais temporários / do editor
 *     (lovable-uploads, blob:, /tmp/, C:/Users, localhost, file://).
 *  2. Todo caminho absoluto interno (ex.: /images/foo.png) deve existir
 *     em `public/`.
 *  3. Todo import relativo/alias (@/assets/...) deve resolver para um
 *     arquivo real no repositório (aceita `.asset.json` como pointer CDN).
 *  4. URLs http(s) externas são apenas listadas (aviso), não falham.
 *
 * Uso:  node scripts/validate-images.mjs
 * Saída: 0 se OK, 1 se houver erros.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(process.cwd());
const PUBLIC_DIR = join(ROOT, "public");

const IMG_EXT = /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp)(\.asset\.json)?$/i;
const SCAN_EXT = /\.(tsx?|jsx?|css|scss|html|json|md)$/i;

const FORBIDDEN = [
  /lovable-uploads\//i,
  /^blob:/i,
  /^file:\/\//i,
  /^\/tmp\//,
  /^[A-Z]:[\\/]Users[\\/]/i,
  /localhost:\d+/i,
];

// Regex para detectar referências a imagens em código-fonte
const PATTERNS = [
  // src="...", href="...", poster="..."
  /(?:src|href|poster)\s*=\s*["'`]([^"'`]+?\.(?:png|jpe?g|webp|gif|svg|ico|avif|bmp))["'`]/gi,
  // import x from "..."
  /import\s+[^"'`]+?\s+from\s+["'`]([^"'`]+?\.(?:png|jpe?g|webp|gif|svg|ico|avif|bmp)(?:\.asset\.json)?)["'`]/gi,
  // url(...) em CSS/JS
  /url\(\s*["'`]?([^"'`)]+?\.(?:png|jpe?g|webp|gif|svg|ico|avif|bmp))["'`]?\s*\)/gi,
  // strings literais "/images/..." "/assets/..."
  /["'`](\/(?:images|assets)\/[^"'`\s]+?\.(?:png|jpe?g|webp|gif|svg|ico|avif|bmp))["'`]/gi,
];

function listFiles() {
  const out = execSync("git ls-files", { cwd: ROOT }).toString().trim().split("\n");
  return out.filter((f) => SCAN_EXT.test(f));
}

function resolveAlias(p) {
  if (p.startsWith("@/")) return join(ROOT, "src", p.slice(2));
  return p;
}

function exists(abs) {
  try {
    statSync(abs);
    return true;
  } catch {
    // Aceita pointer CDN correspondente
    if (!abs.endsWith(".asset.json")) {
      try {
        statSync(abs + ".asset.json");
        return true;
      } catch { /* noop */ }
    }
    return false;
  }
}

const errors = [];
const warnings = [];
const externals = new Set();

for (const file of listFiles()) {
  const abs = join(ROOT, file);
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    continue;
  }

  for (const rx of PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(content))) {
      const ref = m[1];
      const lineNo = content.slice(0, m.index).split("\n").length;
      const loc = `${file}:${lineNo}`;

      // Forbidden
      const bad = FORBIDDEN.find((r) => r.test(ref));
      if (bad) {
        errors.push(`[FORBIDDEN] ${loc} → ${ref}`);
        continue;
      }

      // External URLs
      if (/^https?:\/\//i.test(ref)) {
        externals.add(`${loc} → ${ref}`);
        continue;
      }
      // Data URIs
      if (ref.startsWith("data:")) continue;

      // Absolute paths → public/
      if (ref.startsWith("/")) {
        const target = join(PUBLIC_DIR, ref);
        if (!exists(target)) errors.push(`[MISSING public] ${loc} → ${ref}`);
        continue;
      }

      // Alias or relative
      let target;
      if (ref.startsWith("@/")) {
        target = resolveAlias(ref);
      } else if (ref.startsWith(".")) {
        target = resolve(dirname(abs), ref);
      } else {
        // bare path — provavelmente pacote npm, ignora
        continue;
      }
      if (!exists(target)) errors.push(`[MISSING] ${loc} → ${ref}`);
    }
  }
}

console.log("── Validação de imagens ──");
console.log(`Arquivos varridos: ${listFiles().length}`);
console.log(`Externas (info):   ${externals.size}`);
console.log(`Avisos:            ${warnings.length}`);
console.log(`Erros:             ${errors.length}\n`);

if (externals.size) {
  console.log("URLs externas encontradas:");
  externals.forEach((e) => console.log("  · " + e));
  console.log();
}
if (errors.length) {
  console.log("❌ Problemas:");
  errors.forEach((e) => console.log("  " + e));
  process.exit(1);
}
console.log("✅ Todas as referências de imagem estão válidas.");

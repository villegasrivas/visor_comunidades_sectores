const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const css = fs.readFileSync(path.join(__dirname, "..", "css", "styles.css"), "utf8");
const mobileStart = css.indexOf("@media (max-width: 700px)");
const mobileCss = css.slice(mobileStart);

assert.ok(mobileStart >= 0, "No se encontró el bloque responsivo para teléfonos.");
assert.match(mobileCss, /\.brand-text\s*\{\s*display:\s*none/);
assert.match(mobileCss, /\.viewer-title\s*\{[\s\S]*?display:\s*-webkit-box/);
assert.match(mobileCss, /-webkit-line-clamp:\s*2/);

console.log("Encabezado móvil: logo y título del visor visibles sin desbordamiento OK.");

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "styles.css"), "utf8");
const config = fs.readFileSync(path.join(root, "config", "config.js"), "utf8");

assert.match(html, /id="legend-toggle"/);
assert.match(html, /class="map-legend-body"/);
assert.match(ui, /function setLegendCollapsed\(collapsed\)/);
assert.match(ui, /aria-expanded/);
assert.match(css, /\.map-legend-collapsed\s*\{/);
assert.match(css, /translateX\(calc\(-100% - var\(--legend-left-offset\)\)\)/);
assert.match(config, /leyenda:\s*\{\s*plegable:\s*true/);

console.log("Leyenda plegable: estructura, estado y pestaña lateral OK.");

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const config = fs.readFileSync(path.join(root, "config", "config.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "styles.css"), "utf8");
const script = fs.readFileSync(path.join(root, "js", "mobile-tools.js"), "utf8");

assert.match(config, /menuHerramientasMovil\s*:\s*\{[\s\S]*?enabled:\s*true[\s\S]*?breakpoint:\s*700/);
assert.match(html, /id="mobile-tools-toggle"/);
assert.match(html, /class="mobile-tools-glyph"[^>]*>🛠</);
assert.match(html, /id="open-layers-panel"/);
assert.doesNotMatch(html, /id="mobile-layers-button"/);
assert.match(html, /js\/mobile-tools\.js/);
assert.match(css, /\.map-container\.mobile-tools-mode \.map-tools/);
assert.doesNotMatch(css, /\.mobile-tools-mode \.layers-toggle\s*\{\s*display:\s*none/);
assert.match(script, /window\.matchMedia/);
assert.match(script, /closeToolsExcept/);
assert.match(script, /mobileToolsConfig\.enabled === true/);

console.log("Menú móvil: herramientas agrupadas y control Capas independiente OK.");

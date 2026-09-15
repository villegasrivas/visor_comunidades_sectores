const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const layersSource = fs.readFileSync(path.join(__dirname, "..", "js", "layers.js"), "utf8");
const start = layersSource.indexOf("function normalizeCategoryInfoValue");
const end = layersSource.indexOf("function getCategoryFeatures", start);

assert.ok(start >= 0 && end > start, "No se encontraron las funciones de resumen por categoría.");

const context = {};
vm.createContext(context);
vm.runInContext(layersSource.slice(start, end), context);

const field = { campo: "dato" };
const common = context.summarizeCategoryField([
    { properties: { dato: "Empresa A" } },
    { properties: { dato: " empresa   a " } }
], field);
assert.equal(common.length, 1);
assert.equal(common[0].value, "Empresa A");
assert.equal(common[0].count, 2);

const multiple = context.summarizeCategoryField([
    { properties: { dato: "Pavimento" } },
    { properties: { dato: "Ripio" } },
    { properties: { dato: "Pavimento" } },
    { properties: { dato: "" } },
    { properties: {} }
], field);
assert.equal(multiple.length, 2);
assert.deepEqual(Array.from(multiple, item => item.count), [2, 1]);

const uiSource = fs.readFileSync(path.join(__dirname, "..", "js", "ui.js"), "utf8");
assert.match(uiSource, /layer-category-info-button/);
assert.match(uiSource, /openCategoryInfoPanel\(layerConfig, category\)/);

console.log("Pruebas de información por categorías superadas.");

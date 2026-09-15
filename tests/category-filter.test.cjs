/* Regresión del filtro por categorías: node tests/category-filter.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "layers.js"), "utf8");
const start = source.indexOf("function normalizeUniqueValue");
const end = source.indexOf("function shouldUseCirclePointSymbol", start);
assert.ok(start >= 0 && end > start, "Funciones del filtro encontradas");

const context = vm.createContext({
    Map,
    loadedLayers: {},
    document: { getElementById() { return null; } },
    clearMapSelection() {},
    updateLegend() {},
    updateLayerLabels() {},
    clearSearchResults() {}
});
vm.runInContext(
    "const layerCategoryVisibility = {}; const layerFeatureLayers = {};\n" +
    source.slice(start, end) +
    "\nglobalThis.setFeatureLayers = function (id, layers) { layerFeatureLayers[id] = layers; };",
    context
);

const layerConfig = {
    id: "vias",
    simbologia: {
        tipo: "valoresUnicos",
        campo: "TIPO",
        filtroCategorias: { enabled: true },
        categorias: [
            { valor: "A", visibleInicial: true },
            { valor: "B", visibleInicial: false }
        ],
        visibleDefaultInicial: false
    }
};

const featureA = { properties: { TIPO: "A" } };
const featureB = { properties: { TIPO: "B" } };
assert.equal(context.isFeatureCategoryVisible(featureA, layerConfig), true);
assert.equal(context.isFeatureCategoryVisible(featureB, layerConfig), false);
assert.equal(context.isFeatureCategoryVisible({ properties: { TIPO: "C" } }, layerConfig), false);
context.setLayerCategoryVisibility(layerConfig, "B", true);
assert.equal(context.isFeatureCategoryVisible(featureB, layerConfig), true);
context.setAllLayerCategoriesVisibility(layerConfig, false);
assert.equal(context.isFeatureCategoryVisible(featureA, layerConfig), false);

const layerA = { feature: featureA };
const layerB = { feature: featureB };
const visibleLayers = new Set([layerA, layerB]);
context.loadedLayers.vias = {
    hasLayer(layer) { return visibleLayers.has(layer); },
    addLayer(layer) { visibleLayers.add(layer); },
    removeLayer(layer) { visibleLayers.delete(layer); }
};
context.setFeatureLayers("vias", [layerA, layerB]);
context.applyLayerCategoryFilter(layerConfig);
assert.equal(visibleLayers.size, 0, "Ninguna retira las entidades del mapa");
context.setLayerCategoryVisibility(layerConfig, "A", true);
assert.equal(visibleLayers.has(layerA), true, "Reactivar una categoría recupera sus entidades");
assert.equal(visibleLayers.has(layerB), false);

console.log("Filtro de categorías: estados, retiro y recuperación de entidades OK.");

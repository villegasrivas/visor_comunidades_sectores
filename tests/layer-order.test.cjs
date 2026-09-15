/* Prueba del orden visual configurable: node tests/layer-order.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const panes = new Map();
const map = {
    createPane(name) {
        const pane = { style: {} };
        panes.set(name, pane);
        return pane;
    },
    getPane(name) {
        return panes.get(name);
    }
};
const appConfig = {
    gruposCapas: [
        { id: "referencia", enabled: true, ordenVisual: 410 },
        { id: "tematicas", enabled: true, ordenVisual: 430 },
        { id: "apagado", enabled: false, ordenVisual: 500 }
    ]
};
const source = fs.readFileSync(path.join(__dirname, "..", "js", "map.js"), "utf8");
const first = source.indexOf("function getLayerGroupPaneName");
const last = source.indexOf("/* El límite estructural", first);

assert.ok(first >= 0 && last > first, "Funciones de paneles encontradas");
const context = vm.createContext({ appConfig, map, Number, String });
vm.runInContext(source.slice(first, last), context);

assert.equal(panes.get("layerGroupPane-referencia").style.zIndex, 410);
assert.equal(panes.get("layerGroupPane-tematicas").style.zIndex, 430);
assert.equal(panes.has("layerGroupPane-apagado"), false);
assert.equal(context.getLayerPaneName({ grupo: "referencia" }), "layerGroupPane-referencia");
assert.equal(context.getLayerPaneName({ grupo: "tematicas" }), "layerGroupPane-tematicas");
assert.equal(context.getLayerPaneName({ grupo: "tematicas", estructural: true }), "structuralPane");
assert.equal(context.getLayerPaneName({ grupo: "inexistente" }), "overlayPane");
console.log("Orden: temáticas sobre referencias y límite estructural en nivel superior OK.");

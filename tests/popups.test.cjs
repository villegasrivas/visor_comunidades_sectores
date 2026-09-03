/* Regresión del orden de clic al suspender/restaurar popups: node tests/popups.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FeatureLayer {
    constructor(isMarker, selectable, initiallyBound = true) {
        this.handlers = [];
        this.open = false;
        this._visorPopupContent = "Información de prueba";
        this.popupClick = () => { this.open = isMarker ? !this.open : true; };
        if (initiallyBound) this.bindPopup(this._visorPopupContent);
        if (selectable) {
            this._visorSelectionHandler = () => { if (this.popup) this.open = true; };
            this.on("click", this._visorSelectionHandler);
        }
    }
    getPopup() { return this.popup; }
    bindPopup(content) {
        this.popup = content;
        this.on("click", this.popupClick);
    }
    unbindPopup() {
        this.popup = null;
        this.open = false;
        this.off("click", this.popupClick);
    }
    on(event, callback) { this.handlers.push(callback); }
    off(event, callback) { this.handlers = this.handlers.filter((handler) => handler !== callback); }
    click() {
        this.open = false;
        this.handlers.slice().forEach((callback) => callback());
    }
}

const marker = new FeatureLayer(true, true);
const polygon = new FeatureLayer(false, true);
const popupOnly = new FeatureLayer(true, false);
const loadedWhileSuspended = new FeatureLayer(true, true, false);
const withoutPopup = { handlers: [] };
const layers = [marker, polygon, popupOnly, loadedWhileSuspended, withoutPopup];
const context = vm.createContext({ loadedLayers: { capa: { eachLayer: (callback) => layers.forEach(callback) } } });
const source = fs.readFileSync(path.join(__dirname, "..", "js", "layers.js"), "utf8");
const start = source.indexOf("function setFeaturePopupsEnabled");
const end = source.indexOf("function normalizeUniqueValue", start);
assert.ok(start >= 0 && end > start);
vm.runInContext(source.slice(start, end), context);

for (let cycle = 0; cycle < 10; cycle += 1) {
    context.setFeaturePopupsEnabled(false);
    context.setFeaturePopupsEnabled(false);
    assert.equal(marker.getPopup(), null);
    context.setFeaturePopupsEnabled(true);
    context.setFeaturePopupsEnabled(true);
    for (const layer of [marker, polygon, popupOnly, loadedWhileSuspended]) {
        layer.click();
        assert.equal(layer.open, true, "El popup debe permanecer abierto después del clic");
        assert.equal(layer.handlers.length, layer._visorSelectionHandler ? 2 : 1);
        assert.equal(layer.handlers[0], layer.popupClick, "Leaflet debe procesar el popup antes de la selección");
    }
}
console.log("Popups: marcadores, polígonos y restauración repetida sin duplicar eventos OK.");

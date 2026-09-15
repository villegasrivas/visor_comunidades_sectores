/* Regresión de selección y búsqueda por geometría: node tests/interactions.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class PathLayer {
    constructor(value, color) {
        this.feature = {
            geometry: { type: "LineString" },
            properties: { TIPO: value }
        };
        this.baseColor = color;
        this.style = {};
    }
    setStyle(style) { this.style = Object.assign({}, style); }
    isPopupOpen() { return false; }
}

class MarkerLayer {
    constructor() {
        this.feature = { geometry: { type: "Point" }, properties: { TIPO: "P" } };
        this.opacity = 1;
    }
    getLatLng() { return { lat: -38.7, lng: -72.9 }; }
    setOpacity(value) { this.opacity = value; }
    isPopupOpen() { return false; }
}

class Group {
    constructor(layers) { this.layers = layers.slice(); }
    eachLayer(callback) { this.layers.slice().forEach(callback); }
    removeLayer(layer) { this.layers = this.layers.filter((item) => item !== layer); }
    addLayer(layer) { if (!this.layers.includes(layer)) this.layers.push(layer); }
}

const map = {
    removed: [],
    removeLayer(layer) { this.removed.push(layer); },
    fitBounds() {},
    setView() {},
    getZoom() { return 12; }
};
const L = {
    circleMarker(latlng, style) {
        return {
            latlng,
            style,
            addTo(targetMap) {
                targetMap.highlight = this;
                return this;
            }
        };
    }
};
const context = vm.createContext({
    console,
    L,
    map,
    loadedLayers: {},
    layerOpacityValues: {},
    selectedFeature: null,
    selectedFeatureConfig: null,
    selectedPointHighlight: null,
    searchResultState: null,
    closeFeatureInfoPanel() {},
    isFeatureInteractionSuspended() { return false; },
    getLayerPaneName() { return "layerGroupPane-tematicas"; },
    setTimeout(callback) { callback(); }
});
const source = fs.readFileSync(path.join(__dirname, "..", "js", "layers.js"), "utf8");

function loadRange(startText, endText) {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start);
    assert.ok(start >= 0 && end > start, "Funciones encontradas: " + startText);
    vm.runInContext(source.slice(start, end), context);
}

loadRange("function normalizeUniqueValue", "function updateLayerOpacity");
loadRange("function restoreSearchResultMode", "function validateLayerConfigs");

function lineConfig(mode) {
    return {
        id: "lineas",
        cluster: false,
        seleccion: { enabled: true },
        resaltado: {
            enabled: true,
            estilo: {
                color: "white",
                fillColor: "orange",
                weight: 6,
                opacity: 1,
                fillOpacity: 0.45
            }
        },
        popup: { enabled: false },
        infoPanel: { enabled: false },
        busqueda: {
            modoResultado: mode,
            estiloContrasteInverso: {
                seleccionado: { color: "white", fillColor: "orange", weight: 5, opacity: 1 },
                resto: { fillOpacity: 0.2 }
            }
        },
        simbologia: {
            tipo: "valoresUnicos",
            campo: "TIPO",
            categorias: [
                { valor: "A", estilo: { color: "red" } },
                { valor: "B", estilo: { color: "blue" } }
            ]
        }
    };
}

const first = new PathLayer("A", "red");
const second = new PathLayer("B", "blue");
context.loadedLayers.lineas = new Group([first, second]);
context.layerOpacityValues.lineas = 1;

context.selectMapFeature(first, lineConfig("aislar"), {
    highlight: true,
    resultMode: "aislar"
});
assert.equal(first.style.color, "orange");
assert.equal(first.style.weight, 6);
assert.deepEqual(context.loadedLayers.lineas.layers, [first]);
context.clearMapSelection();
assert.equal(context.loadedLayers.lineas.layers.length, 2);
assert.equal(first.style.color, "red");

const inverseConfig = lineConfig("contrasteInverso");
context.selectMapFeature(first, inverseConfig, {
    highlight: true,
    resultMode: "contrasteInverso"
});
assert.equal(first.style.color, "orange");
assert.equal(first.style.opacity, 1);
assert.equal(second.style.opacity, 0.2);
context.clearMapSelection();
assert.equal(first.style.color, "red");
assert.equal(second.style.color, "blue");

const marker = new MarkerLayer();
context.loadedLayers.puntos = new Group([marker]);
context.layerOpacityValues.puntos = 0.8;
const markerConfig = {
    id: "puntos",
    seleccion: { enabled: true },
    resaltado: {
        enabled: true,
        estilo: { color: "white", fillColor: "orange", weight: 4, radius: 11 }
    },
    popup: { enabled: false },
    infoPanel: { enabled: false },
    simbologia: { tipo: "simple", simboloPunto: "marcador", estilo: {} }
};
context.selectMapFeature(marker, markerConfig, { highlight: true });
assert.equal(map.highlight.style.color, "orange");
assert.equal(map.highlight.style.radius, 11);
context.clearMapSelection();
assert.equal(map.removed.includes(map.highlight), true);
assert.equal(marker.opacity, 0.8);

console.log("Interacciones: resaltado, aislamiento, contraste y halo de puntos OK.");

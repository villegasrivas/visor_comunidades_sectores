/* Prueba de regresión sin dependencias: node tests/legend.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
    constructor(tag) {
        this.tagName = tag;
        this.attributes = {};
        this.children = [];
        this.style = { setProperty: (key, value) => { this.style[key] = value; } };
        this.classList = { add: (name) => { this.className += " " + name; } };
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    removeAttribute(key) { delete this.attributes[key]; }
    appendChild(child) { this.children.push(child); }
}

class Marker {
    getIcon() { return { createIcon: () => new Element("img") }; }
}
class CircleMarker {}
class Polyline {}
class Polygon extends Polyline {}
class Group {
    constructor(layers) { this.layers = layers; }
    eachLayer(callback) { this.layers.forEach(callback); }
}

const context = vm.createContext({
    document: {
        createElement: (tag) => new Element(tag),
        createElementNS: (namespace, tag) => new Element(tag)
    },
    L: { Marker, CircleMarker, Polyline, Polygon }
});

function loadFunctions(file, start, end) {
    const source = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, "Funciones de prueba encontradas");
    vm.runInContext(source.slice(first, last), context);
}

loadFunctions("layers.js", "function getLayerLegendSymbols", "function isLabelVisibleAtCurrentZoom");
loadFunctions("ui.js", "function createLegendSymbol", "function updateLegend");

const { getLayerLegendSymbols, getLegendEntries, createLegendSymbol, createLegendItem } = context;
const types = getLayerLegendSymbols(new Group([
    new Marker(), new Group([new Marker(), new CircleMarker(), new Polyline(), new Polygon()])
]));
assert.equal(types.map((item) => item.tipo).join(","), "marcador,punto,linea,poligono");
assert.equal(getLayerLegendSymbols(new Group([])).length, 0);
const marker = createLegendSymbol({}, types[0]);
assert.equal(marker.children[0].tagName, "img");
assert.equal(marker.children[0].className, "legend-marker-icon");

function shape(style, type) {
    return createLegendSymbol({ estilo: style }, { tipo: type }).children[0].children[0];
}
const line = shape({ color: "#ab1234", weight: 2, dashArray: "5 3", opacity: 0.4 }, "linea");
assert.equal(line.attributes.stroke, "#ab1234");
assert.equal(line.attributes.fill, "none");
assert.equal(line.attributes["stroke-dasharray"], "5 3");
assert.equal(line.attributes["stroke-opacity"], "0.4");
assert.equal(shape({}, "linea").attributes["stroke-dasharray"], undefined);
assert.equal(shape({ fillOpacity: 0 }, "poligono").attributes["fill-opacity"], "0");
assert.equal(shape({ fill: false }, "poligono").attributes.fill, "none");
assert.equal(shape({ stroke: false }, "poligono").attributes.stroke, "none");
assert.equal(shape({ weight: 0 }, "linea").attributes["stroke-width"], "0");
assert.equal(shape({}, "punto").tagName, "circle");
const halo = createLegendSymbol({ halo: { color: "white" }, estilo: { color: "navy" } }, { tipo: "linea" });
assert.ok(halo.className.includes("legend-symbol-structural"));
assert.equal(halo.style["--legend-line-color"], "navy");

const unique = getLegendEntries({ simbologia: {
    tipo: "valoresUnicos", estiloBase: { weight: 2 },
    categorias: [{ valor: "A", estilo: { color: "red" } }, { valor: "B", estilo: { color: "blue" } }],
    estiloDefault: { color: "gray" }
} });
assert.equal(unique.length, 3);
assert.equal(shape(unique[1].estilo, "linea").attributes.stroke, "blue");
assert.equal(shape(unique[1].estilo, "linea").attributes["stroke-width"], "2");
const graduated = getLegendEntries({ simbologia: {
    tipo: "graduados", estiloBase: { fillOpacity: 0.6 },
    clases: [{ etiqueta: "0–10", estilo: { fillColor: "green" } }],
    mostrarDefaultEnLeyenda: false
} });
assert.equal(graduated.length, 1);
assert.equal(shape(graduated[0].estilo, "poligono").attributes.fill, "green");
const mixed = createLegendItem({ etiqueta: "Mixta" }, types);
assert.equal(mixed.children[0].children.length, 4);
assert.equal(mixed.children[1].textContent, "Mixta");
console.log("Leyenda: geometrías, marcadores, líneas, transparencia, halo y categorías OK.");

/* Regresión de etiquetas orientadas: node tests/labels.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "layers.js"), "utf8");
const start = source.indexOf("function getLineLabelPlacement");
const end = source.indexOf("function updateLayerLabels", start);
assert.ok(start >= 0 && end > start, "Funciones de etiquetado encontradas");

const context = vm.createContext({
    Math,
    map: {
        latLngToLayerPoint(latLng) {
            return { x: latLng.lng * 100, y: -latLng.lat * 100 };
        }
    },
    escapeHtml(value) {
        return String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }
});
vm.runInContext(source.slice(start, end), context);

function lineLayer(latLngs, type = "LineString") {
    return {
        feature: { geometry: { type } },
        getLatLngs() { return latLngs; }
    };
}

assert.equal(context.getLineLabelAngle(lineLayer([
    { lat: 0, lng: 0 },
    { lat: 0, lng: 4 }
])), 0);

assert.equal(context.getLineLabelAngle(lineLayer([
    { lat: 0, lng: 4 },
    { lat: 0, lng: 0 }
])), 0, "El texto no queda invertido en líneas dibujadas al oeste");

assert.equal(context.getLineLabelAngle(lineLayer([
    [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }],
    [{ lat: 0, lng: 0 }, { lat: -3, lng: 3 }]
], "MultiLineString")), 45, "Usa el tramo más largo de una multilínea");

const orientedLayer = lineLayer([{ lat: 0, lng: 0 }, { lat: -1, lng: 1 }]);
const placement = context.getLineLabelPlacement(orientedLayer);
assert.equal(placement.angle, 45);
assert.deepEqual(
    { lat: placement.latLng.lat, lng: placement.latLng.lng },
    { lat: -0.5, lng: 0.5 },
    "La posición y el ángulo pertenecen al mismo tramo"
);
assert.equal(context.shouldOrientLabelAlongLine(orientedLayer, { orientacion: "linea" }), true);
assert.equal(context.shouldOrientLabelAlongLine(orientedLayer, { orientacion: "horizontal" }), false);
assert.match(
    context.buildFeatureLabel("Ruta <S-40>", orientedLayer, { orientacion: "linea" }),
    /--label-angle:45deg.*Ruta &lt;S-40&gt;/
);

console.log("Etiquetas: posición y orientación recta coherentes, sentido y contenido seguro OK.");

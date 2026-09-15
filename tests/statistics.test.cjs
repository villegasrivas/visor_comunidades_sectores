const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "layers.js"), "utf8");
const formatStart = source.indexOf("function formatPopupValue");
const formatEnd = source.indexOf("function buildPopupContent", formatStart);
const statisticStart = source.indexOf("function calculateConfiguredStatistic");
const statisticEnd = source.indexOf("function getLayerDataFeatures", statisticStart);
const context = {};

assert.ok(formatStart >= 0 && formatEnd > formatStart);
assert.ok(statisticStart >= 0 && statisticEnd > statisticStart);
vm.createContext(context);
vm.runInContext(source.slice(formatStart, formatEnd), context);
vm.runInContext(source.slice(statisticStart, statisticEnd), context);

const features = [
    { properties: { long_km: 1.234 } },
    { properties: { long_km: 2.345 } },
    { properties: { long_km: null } }
];

assert.equal(context.calculateConfiguredStatistic(features, {
    operacion: "suma",
    campo: "long_km",
    factor: 1,
    decimales: 2,
    sufijo: " km"
}), "3,58 km");

assert.equal(context.calculateConfiguredStatistic([
    { properties: { longitud_m: 1500 } },
    { properties: { longitud_m: 500 } }
], {
    operacion: "suma",
    campo: "longitud_m",
    factor: 0.001,
    decimales: 1,
    sufijo: " km"
}), "2,0 km");

assert.equal(context.formatPopupValue(12.3456, {
    formato: "decimal",
    factor: 1,
    decimales: 2,
    sufijo: " km"
}), "12,35 km");

console.log("Estadísticas, conversión y redondeo OK.");

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/layers.js'), 'utf8');
const context = vm.createContext({ layerOpacityValues: { test: 0 } });
vm.runInContext(source.slice(source.indexOf('function applyLayerOpacity('), source.indexOf('function getFeatureStyle(')), context);
const style = { opacity: 0.8, fillOpacity: 0.4 };
for (const value of [0, 0.5, 1]) {
    context.layerOpacityValues.test = value;
    const fill = context.applyLayerOpacity(style, {id:'test', opacityTarget:'fill'}, 'poligono');
    assert.equal(fill.opacity, 0.8);
    assert.equal(fill.fillOpacity, 0.4 * value);
    for (const mode of ['all', undefined]) {
        const all = context.applyLayerOpacity(style, {id:'test', opacityTarget:mode}, 'poligono');
        assert.equal(all.opacity, 0.8 * value);
        assert.equal(all.fillOpacity, 0.4 * value);
    }
    for (const kind of ['linea', 'punto']) {
        assert.equal(context.applyLayerOpacity(style, {id:'test', opacityTarget:'fill'}, kind).opacity, 0.8 * value);
    }
}
assert.deepEqual(style, {opacity:0.8, fillOpacity:0.4});
console.log('Opacidad: fill conserva perímetros; all y modo omitido escalan ambos; puntos/líneas sin cambios.');

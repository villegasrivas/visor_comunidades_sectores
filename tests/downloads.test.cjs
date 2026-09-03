/* Pruebas locales del catálogo: node tests/downloads.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "downloads.js"), "utf8");
const baseUri = "https://visor.example/municipio/index.html";

function setup(config) {
    const nodes = new Map();
    const state = { clicked: [], fetches: 0, fail: false, html: false, empty: false, revoked: false };
    function createElement(tag) {
        return {
            tagName: tag, children: [], attributes: {}, events: {}, disabled: false,
            classList: { add() {}, remove() {} },
            appendChild(child) { this.children.push(child); },
            setAttribute(key, value) { this.attributes[key] = value; },
            removeAttribute(key) { delete this.attributes[key]; },
            addEventListener(name, fn) { this.events[name] = fn; },
            click() { state.clicked.push(this); }, remove() {}, focus() {}
        };
    }
    function getElement(id) {
        if (!nodes.has(id)) nodes.set(id, createElement("div"));
        return nodes.get(id);
    }
    class TestURL extends URL {}
    TestURL.createObjectURL = () => "blob:test-file";
    TestURL.revokeObjectURL = () => { state.revoked = true; };
    const context = vm.createContext({
        appConfig: { herramientas: { descargas: config } },
        URL: TestURL,
        document: {
            baseURI: baseUri, createElement, getElementById: getElement, querySelector: getElement,
            body: createElement("body"), addEventListener() {}
        },
        L: { DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} } },
        closeFeatureInfoPanel() {},
        setTimeout: (fn) => { fn(); },
        fetch: async () => {
            state.fetches += 1;
            return { ok: !state.fail, headers: { get: () => state.html ? "text/html" : "application/pdf" },
                blob: async () => ({ size: state.empty ? 0 : 20 }) };
        }
    });
    vm.runInContext(source, context);
    return { context, getElement, createElement, state };
}

async function run() {
    const test = setup({ enabled: true, archivos: [] });
    const { context, getElement, state, createElement } = test;
    assert.equal(getElement("downloads-list").children[0].className, "downloads-empty");
    context.openDownloadsPanel();
    assert.equal(getElement("downloads-button").attributes["aria-expanded"], "true");
    context.closeDownloadsPanel();
    assert.equal(getElement("downloads-button").attributes["aria-expanded"], "false");
    for (const config of [undefined, { enabled: false, archivos: [] }]) {
        const disabled = setup(config);
        assert.equal(disabled.getElement("downloads-button").hidden, true);
        assert.equal(disabled.getElement("map").children.length, 0);
    }
    const resolve = (archivo) => context.resolveDownloadFile({ archivo }, baseUri);
    assert.equal(resolve("descargas/mapas/mapa.pdf").formato, "PDF");
    assert.equal(resolve("descargas/capas/capa.KML").formato, "KML");
    assert.equal(resolve("descargas/mapas/Mi mapa.pdf").nombre, "Mi mapa.pdf");
    assert.ok(resolve("descargas\\capas\\capa.kml"));
    for (const invalid of ["", null, "javascript:alert(1)", "https://otro.example/file.pdf", "data/capa.kml",
        "descargas/../privado.pdf", "descargas/%2e%2e/privado.pdf", "descargas/%2e%2e%2fprivado.pdf",
        "descargas/mapa.html", "descargas/mapa.pdf?secret=1", "descargas/mapa.pdf#fragmento", "descargas/%zz.pdf"]) {
        assert.equal(resolve(invalid), null, "Debe rechazar " + invalid);
    }
    const populated = setup({ enabled: true, archivos: [
        { titulo: "Mapa", archivo: "descargas/mapas/mapa.pdf" },
        { titulo: "Capa", archivo: "descargas/capas/capa.kml", enabled: true },
        { titulo: "Oculto", archivo: "descargas/capas/oculto.kml", enabled: false }
    ] });
    assert.equal(populated.getElement("downloads-list").children.length, 2);
    const invalidCard = context.createDownloadCard({ titulo: "Inválido", archivo: "otro.kml" });
    assert.equal(invalidCard.children.find((child) => child.tagName === "button").disabled, true);
    const button = createElement("button");
    const status = createElement("p");
    const pdf = resolve("descargas/mapas/mapa.pdf");
    await context.downloadPreparedFile(pdf, button, status);
    assert.equal(state.clicked[0].download, "mapa.pdf");
    assert.equal(state.clicked[0].href, "blob:test-file");
    assert.equal(state.revoked, true);
    assert.equal(button.disabled, false);
    assert.match(status.textContent, /Descarga iniciada/);
    for (const kind of ["fail", "html", "empty"]) {
        state[kind] = true;
        const count = state.clicked.length;
        await context.downloadPreparedFile(pdf, button, status);
        assert.equal(state.clicked.length, count);
        assert.match(status.textContent, /No se pudo/);
        assert.equal(button.disabled, false);
        state[kind] = false;
    }
    await context.downloadPreparedFile(resolve("descargas/capas/capa.kml"), button, status);
    assert.equal(state.clicked.at(-1).download, "capa.kml");
    button.disabled = true;
    const count = state.fetches;
    await context.downloadPreparedFile(pdf, button, status);
    assert.equal(state.fetches, count);
    console.log("Descargas: configuración, rutas, PDF/KML, errores y reintentos OK.");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

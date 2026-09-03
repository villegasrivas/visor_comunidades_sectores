/* Pruebas locales sin conectarse a Google: node tests/google-maps.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "google-maps.js"), "utf8");

function setup(config) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set();
            elements.set(id, {
                hidden: false, children: [], attributes: {}, events: {},
                classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
                setAttribute(key, value) { this.attributes[key] = value; },
                removeAttribute(key) { delete this.attributes[key]; delete this[key]; },
                appendChild(child) { this.children.push(child); },
                addEventListener(name, callback) { this.events[name] = callback; },
                focus() {}
            });
        }
        return elements.get(id);
    }
    const state = { doubleClick: true, measuring: false, popups: true, marker: null };
    const map = {
        events: {},
        createPane: () => ({ style: {} }),
        closePopup() {},
        removeLayer(marker) { if (state.marker === marker) state.marker = null; },
        on(name, callback) { this.events[name] = callback; },
        doubleClickZoom: {
            enabled: () => state.doubleClick,
            enable: () => { state.doubleClick = true; },
            disable: () => { state.doubleClick = false; }
        }
    };
    const context = vm.createContext({
        appConfig: { herramientas: { googleMaps: config } }, URL, map,
        document: {
            getElementById: element,
            querySelector: element,
            createElement: (tag) => element(tag),
            addEventListener: (name, callback) => { element("document").events[name] = callback; }
        },
        L: {
            DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
            circleMarker: (latlng) => {
                const marker = { latlng, addTo() { state.marker = marker; return marker; } };
                return marker;
            }
        },
        isMeasurementActive: () => state.measuring,
        cancelMeasurement: () => { state.measuring = false; },
        closeCoordinateSearchTool() {}, clearSearchResults() {}, clearMapSelection() {},
        setFeaturePopupsEnabled: (enabled) => { state.popups = enabled; },
        isFeatureInteractionSuspended: () => state.measuring || context.isGoogleMapsPicking()
    });
    vm.runInContext(source, context);
    return { context, element, state, map };
}

for (const config of [undefined, { enabled: false }]) {
    const disabled = setup(config);
    assert.equal(disabled.element("google-maps-button").hidden, true);
    assert.equal(Object.keys(disabled.map.events).length, 0);
}
const { context, element, state, map } = setup({ enabled: true, modoViaje: "walking" });
const latlng = { lat: -38.74, lng: -72.95 };
const url = new URL(context.buildGoogleMapsUrl(latlng, "walking"));
assert.equal(url.origin, "https://www.google.com");
assert.equal(url.pathname, "/maps/dir/");
assert.equal(url.searchParams.get("api"), "1");
assert.equal(url.searchParams.get("destination"), "-38.740000,-72.950000");
assert.equal(url.searchParams.get("travelmode"), "walking");
assert.equal(url.searchParams.has("origin"), false);
for (const mode of ["driving", "walking", "bicycling", "transit"]) {
    assert.equal(new URL(context.buildGoogleMapsUrl(latlng, mode)).searchParams.get("travelmode"), mode);
}
assert.equal(new URL(context.buildGoogleMapsUrl(latlng, "invalid")).searchParams.get("travelmode"), "driving");
for (const point of [null, { lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: "", lng: 0 }]) {
    assert.equal(context.buildGoogleMapsUrl(point), null);
}
assert.ok(context.buildGoogleMapsUrl({ lat: 0, lng: 0 }));
state.measuring = true;
context.startGoogleMapsPicking();
assert.equal(state.measuring, false);
assert.equal(context.isGoogleMapsPicking(), true);
assert.equal(state.popups, false);
assert.equal(state.doubleClick, false);
assert.equal(element("map").classList.contains("google-maps-picking"), true);
assert.equal(element("google-maps-link").hidden, true);
map.events.click({ latlng: { wrap: () => latlng } });
assert.equal(context.isGoogleMapsPicking(), false);
assert.equal(element("google-maps-link").hidden, false);
assert.equal(element("google-maps-link").href, url.href);
assert.equal(state.popups, true);
assert.equal(state.doubleClick, true);
assert.deepEqual(state.marker.latlng, latlng);
map.events.click({ latlng: { wrap: () => ({ lat: 0, lng: 0 }) } });
assert.equal(element("google-maps-link").href, url.href);
context.startGoogleMapsPicking();
assert.equal(state.marker, null);
assert.equal(element("google-maps-link").href, undefined);
context.closeGoogleMapsTool();
assert.equal(context.isGoogleMapsPicking(), false);
assert.equal(element("google-maps-button").attributes["aria-expanded"], "false");
assert.equal(element("map").classList.contains("google-maps-picking"), false);
state.doubleClick = false;
context.startGoogleMapsPicking();
element("document").events.keydown({ key: "Escape" });
assert.equal(context.isGoogleMapsPicking(), false);
assert.equal(state.doubleClick, false);
context.startGoogleMapsPicking();
element(".map-tools").events.click({ target: { closest: () => element("measurement-button") } });
assert.equal(context.isGoogleMapsPicking(), false);
assert.equal(state.popups, true);
console.log("Google Maps: configuración, URL, destino, cancelación y cambio de herramienta OK.");

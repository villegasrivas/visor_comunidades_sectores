/* Inicialización y controles generales del mapa. */
/* La vista, mapas base y orden de grupos se configuran en config.js. */
const initialViewConfig = appConfig.mapa.vistaInicial;

const map = L.map("map", {
    zoomControl: false,
    minZoom: appConfig.mapa.zoomMin,
    maxZoom: appConfig.mapa.zoomMax
});

map.setView(initialViewConfig.centro, initialViewConfig.zoom);

/* Cada grupo ocupa un nivel configurable; un número mayor se dibuja encima. */
function getLayerGroupPaneName(groupId) {
    return "layerGroupPane-" + String(groupId).replace(/[^a-zA-Z0-9_-]/g, "-");
}

appConfig.gruposCapas
    .filter(function (groupConfig) { return groupConfig.enabled !== false; })
    .forEach(function (groupConfig, index) {
        const pane = map.createPane(getLayerGroupPaneName(groupConfig.id));
        const configuredOrder = Number(groupConfig.ordenVisual);

        pane.style.zIndex = Number.isFinite(configuredOrder) ? configuredOrder : 410 + index * 20;
    });

function getLayerPaneName(layerConfig) {
    if (layerConfig.estructural === true) {
        return "structuralPane";
    }

    const paneName = getLayerGroupPaneName(layerConfig.grupo);
    return map.getPane(paneName) ? paneName : "overlayPane";
}

/* El límite estructural conserva su halo por encima de todos los grupos. */
map.createPane("structuralHaloPane");
map.getPane("structuralHaloPane").style.zIndex = 610;
map.getPane("structuralHaloPane").style.pointerEvents = "none";
map.createPane("structuralPane");
map.getPane("structuralPane").style.zIndex = 620;
map.getPane("structuralPane").style.pointerEvents = "none";

const loadedBasemaps = {};
let activeBasemapId = null;

function setActiveBasemap(basemapId) {
    Object.keys(loadedBasemaps).forEach(function (id) {
        const basemap = loadedBasemaps[id];

        if (id === basemapId) {
            if (!map.hasLayer(basemap)) {
                basemap.addTo(map);
            }
        } else if (map.hasLayer(basemap)) {
            map.removeLayer(basemap);
        }
    });

    activeBasemapId = basemapId;
}

const enabledBasemaps = appConfig.mapasBase.filter(function (basemapConfig) {
    return basemapConfig.enabled !== false;
});

enabledBasemaps.forEach(function (basemapConfig) {
    loadedBasemaps[basemapConfig.id] = L.tileLayer(
        basemapConfig.url,
        basemapConfig.opciones || {}
    );
});

const initialBasemap =
    enabledBasemaps.find(function (basemapConfig) {
        return basemapConfig.visibleInicial === true;
    }) || enabledBasemaps[0];

if (initialBasemap) {
    setActiveBasemap(initialBasemap.id);
}

function applyConfiguredView() {
    if (
        initialViewConfig.tipo === "capa" &&
        typeof loadedLayers !== "undefined" &&
        loadedLayers[initialViewConfig.capaId]
    ) {
        const layerBounds = loadedLayers[initialViewConfig.capaId].getBounds();

        if (layerBounds.isValid()) {
            map.fitBounds(layerBounds, {
                padding: initialViewConfig.padding || [20, 20]
            });
            return;
        }
    }

    map.setView(initialViewConfig.centro, initialViewConfig.zoom);
}

document.getElementById("zoom-in").addEventListener("click", function () {
    map.zoomIn();
});

document.getElementById("zoom-out").addEventListener("click", function () {
    map.zoomOut();
});

document.getElementById("home-view").addEventListener("click", function () {
    if (typeof clearMapSelection === "function") {
        clearMapSelection();
    }

    applyConfiguredView();
});

L.control.scale({
    metric: true,
    imperial: false,
    position: "bottomleft"
}).addTo(map);

const layersPanel = document.getElementById("layers-panel");

/* Evita que los controles flotantes activen clics o zoom en el mapa. */
[
    layersPanel,
    document.getElementById("open-layers-panel"),
    document.querySelector(".search-container"),
    document.getElementById("search-results"),
    document.querySelector(".map-navigation"),
    document.querySelector(".map-tools"),
    document.getElementById("legend-content"),
    document.getElementById("layer-metadata-panel"),
    document.getElementById("feature-info-panel")
].forEach(function (control) {
    if (control) {
        L.DomEvent.disableClickPropagation(control);
        L.DomEvent.disableScrollPropagation(control);
    }
});

document.getElementById("open-layers-panel").addEventListener("click", function () {
    if (typeof closeGoogleMapsTool === "function") {
        closeGoogleMapsTool();
    }
    layersPanel.classList.add("layers-panel-open");
    this.setAttribute("aria-expanded", "true");
});

document.getElementById("close-layers-panel").addEventListener("click", function () {
    layersPanel.classList.remove("layers-panel-open");
    document.getElementById("open-layers-panel").setAttribute("aria-expanded", "false");
});

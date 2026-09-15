/* Menú móvil: reúne automáticamente las herramientas habilitadas. */
const mobileToolsConfig = appConfig.herramientas.menuHerramientasMovil || {};
const mobileToolsMap = document.getElementById("map");
const mobileToolsMenu = document.getElementById("map-tools");
const mobileToolsToggle = document.getElementById("mobile-tools-toggle");
const mobileToolsBreakpoint = Number(mobileToolsConfig.breakpoint) || 700;
const mobileToolsMedia = window.matchMedia("(max-width: " + mobileToolsBreakpoint + "px)");

/* Evita que pulsar el selector se interprete como un clic sobre el mapa. */
L.DomEvent.disableClickPropagation(mobileToolsToggle);
L.DomEvent.disableScrollPropagation(mobileToolsToggle);

function isMobileToolsMode() {
    return mobileToolsConfig.enabled === true && mobileToolsMedia.matches;
}

function setMobileToolsOpen(open) {
    if (!isMobileToolsMode()) {
        mobileToolsMenu.hidden = false;
        mobileToolsToggle.hidden = true;
        return;
    }

    mobileToolsMenu.hidden = !open;
    mobileToolsToggle.hidden = false;
    mobileToolsToggle.classList.toggle("mobile-tools-toggle-active", open);
    mobileToolsToggle.setAttribute("aria-expanded", String(open));
    mobileToolsToggle.setAttribute("aria-label", open ? "Cerrar herramientas" : "Abrir herramientas");
}

function closeToolsExcept(selectedId) {
    if (selectedId !== "measurement-button" && typeof cancelMeasurement === "function") {
        cancelMeasurement();
    }

    if (selectedId !== "coordinate-search-button" && typeof closeCoordinateSearchTool === "function") {
        closeCoordinateSearchTool();
    }

    if (selectedId !== "google-maps-button" && typeof closeGoogleMapsTool === "function") {
        closeGoogleMapsTool();
    }

    if (selectedId !== "downloads-button" && typeof closeDownloadsPanel === "function") {
        closeDownloadsPanel();
    }

    if (selectedId !== "open-layers-panel") {
        document.getElementById("layers-panel").classList.remove("layers-panel-open");
        document.getElementById("open-layers-panel").setAttribute("aria-expanded", "false");
    }

    document.getElementById("layer-metadata-panel").hidden = true;
    if (typeof closeCurrentInfoPanel === "function") {
        closeCurrentInfoPanel();
    }
}

function updateMobileToolsMode() {
    const mobileMode = isMobileToolsMode();
    mobileToolsMap.classList.toggle("mobile-tools-mode", mobileMode);
    setMobileToolsOpen(false);
}

mobileToolsToggle.addEventListener("click", function () {
    setMobileToolsOpen(mobileToolsMenu.hidden);
});

mobileToolsMenu.addEventListener("click", function (event) {
    const selectedButton = event.target.closest("button");

    if (!selectedButton || !isMobileToolsMode()) {
        return;
    }

    closeToolsExcept(selectedButton.id);
    setMobileToolsOpen(false);
});

document.addEventListener("click", function (event) {
    if (
        isMobileToolsMode() &&
        !mobileToolsMenu.hidden &&
        !event.target.closest("#map-tools") &&
        !event.target.closest("#mobile-tools-toggle")
    ) {
        setMobileToolsOpen(false);
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isMobileToolsMode()) {
        setMobileToolsOpen(false);
    }
});

if (typeof mobileToolsMedia.addEventListener === "function") {
    mobileToolsMedia.addEventListener("change", updateMobileToolsMode);
} else {
    mobileToolsMedia.addListener(updateMobileToolsMode);
}

updateMobileToolsMode();

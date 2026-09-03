/* Selección local de destino; el enlace externo solo se abre por acción del usuario. */
const googleMapsConfig = appConfig.herramientas.googleMaps;
const googleMapsButton = document.getElementById("google-maps-button");
let googleMapsMenu = null;
let googleMapsPicking = false;
let googleMapsMarker = null;
let googleMapsRestoreDoubleClick = false;

function isGoogleMapsPicking() {
    return googleMapsPicking;
}

function buildGoogleMapsUrl(latlng, travelMode) {
    if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng) ||
        Math.abs(latlng.lat) > 90 || Math.abs(latlng.lng) > 180) {
        return null;
    }

    const modes = ["driving", "walking", "bicycling", "transit"];
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("destination", latlng.lat.toFixed(6) + "," + latlng.lng.toFixed(6));
    url.searchParams.set("travelmode", modes.includes(travelMode) ? travelMode : "driving");
    return url.href;
}

function stopGoogleMapsPicking() {
    if (!googleMapsPicking) {
        return;
    }

    googleMapsPicking = false;
    document.getElementById("map").classList.remove("google-maps-picking");
    setFeaturePopupsEnabled(!isFeatureInteractionSuspended());
    if (googleMapsRestoreDoubleClick) {
        map.doubleClickZoom.enable();
    }
    googleMapsRestoreDoubleClick = false;
}

function clearGoogleMapsDestination() {
    if (googleMapsMarker) {
        map.removeLayer(googleMapsMarker);
        googleMapsMarker = null;
    }
    const link = document.getElementById("google-maps-link");
    link.removeAttribute("href");
    link.hidden = true;
    document.getElementById("google-maps-destination").hidden = true;
    document.getElementById("google-maps-change").hidden = true;
}

function closeGoogleMapsTool() {
    if (!googleMapsMenu) {
        return;
    }
    stopGoogleMapsPicking();
    clearGoogleMapsDestination();
    googleMapsMenu.hidden = true;
    googleMapsButton.classList.remove("tool-button-active");
    googleMapsButton.setAttribute("aria-expanded", "false");
}

function startGoogleMapsPicking() {
    if (typeof isMeasurementActive === "function" && isMeasurementActive()) {
        cancelMeasurement();
    }
    const measurementPanel = document.getElementById("measurement-menu");
    if (measurementPanel) {
        measurementPanel.hidden = true;
        document.getElementById("measurement-button").setAttribute("aria-expanded", "false");
    }
    if (typeof closeCoordinateSearchTool === "function") {
        closeCoordinateSearchTool();
    }
    document.getElementById("layers-panel").classList.remove("layers-panel-open");
    document.getElementById("open-layers-panel").setAttribute("aria-expanded", "false");
    document.getElementById("layer-metadata-panel").hidden = true;
    clearSearchResults();
    clearMapSelection();
    map.closePopup();
    clearGoogleMapsDestination();

    if (!googleMapsPicking) {
        googleMapsRestoreDoubleClick = map.doubleClickZoom.enabled();
    }
    googleMapsPicking = true;
    map.doubleClickZoom.disable();
    setFeaturePopupsEnabled(false);
    document.getElementById("map").classList.add("google-maps-picking");
    googleMapsMenu.hidden = false;
    googleMapsButton.classList.add("tool-button-active");
    googleMapsButton.setAttribute("aria-expanded", "true");
    document.getElementById("google-maps-status").textContent =
        "Haz clic o toca el mapa para elegir el destino. Puedes acercarte antes de marcarlo.";
}

function chooseGoogleMapsDestination(event) {
    if (!googleMapsPicking) {
        return;
    }
    const latlng = event.latlng.wrap();
    const url = buildGoogleMapsUrl(latlng, googleMapsConfig.modoViaje);
    if (!url) {
        document.getElementById("google-maps-status").textContent = "Elige una coordenada válida.";
        return;
    }

    clearGoogleMapsDestination();
    googleMapsMarker = L.circleMarker(latlng, {
        radius: 8, color: "#ffffff", weight: 3,
        fillColor: "#e47b25", fillOpacity: 1,
        interactive: false, pane: "googleMapsDestinationPane"
    }).addTo(map);
    stopGoogleMapsPicking();

    const destination = document.getElementById("google-maps-destination");
    destination.textContent = "WGS84 · Lat " + latlng.lat.toFixed(6) + " · Lon " + latlng.lng.toFixed(6);
    destination.hidden = false;
    const link = document.getElementById("google-maps-link");
    link.href = url;
    link.hidden = false;
    document.getElementById("google-maps-change").hidden = false;
    document.getElementById("google-maps-status").textContent =
        "Destino marcado. Revisa el punto antes de abrir Google Maps.";
}

function initializeGoogleMapsTool() {
    if (!googleMapsConfig || googleMapsConfig.enabled === false) {
        googleMapsButton.hidden = true;
        return;
    }

    const destinationPane = map.createPane("googleMapsDestinationPane");
    destinationPane.style.zIndex = 640;
    destinationPane.style.pointerEvents = "none";

    googleMapsMenu = document.createElement("section");
    googleMapsMenu.id = "google-maps-menu";
    googleMapsMenu.className = "google-maps-menu";
    googleMapsMenu.setAttribute("aria-label", "Cómo llegar");
    googleMapsMenu.hidden = true;
    googleMapsMenu.innerHTML =
        '<div class="google-maps-header"><span>Cómo llegar</span>' +
            '<button id="google-maps-close" type="button" aria-label="Cerrar Cómo llegar">×</button></div>' +
        '<div class="google-maps-content">' +
            '<p id="google-maps-status" role="status"></p>' +
            '<p id="google-maps-destination" class="google-maps-destination" hidden></p>' +
            '<p class="google-maps-note">Elige un acceso real al lugar. Al abrir Google Maps se enviará el destino elegido; allí podrás indicar el origen y revisar la ruta.</p>' +
            '<div class="google-maps-actions">' +
                '<a id="google-maps-link" class="google-maps-link" target="_blank" rel="noopener noreferrer" hidden>Abrir Google Maps ↗</a>' +
                '<button id="google-maps-change" type="button" hidden>Cambiar destino</button>' +
                '<button id="google-maps-cancel" type="button">Cancelar</button>' +
            '</div>' +
        '</div>';
    document.getElementById("map").appendChild(googleMapsMenu);
    L.DomEvent.disableClickPropagation(googleMapsMenu);
    L.DomEvent.disableScrollPropagation(googleMapsMenu);

    googleMapsButton.addEventListener("click", function () {
        if (googleMapsMenu.hidden) {
            startGoogleMapsPicking();
        } else {
            closeGoogleMapsTool();
        }
    });
    ["google-maps-close", "google-maps-cancel"].forEach(function (id) {
        document.getElementById(id).addEventListener("click", function () {
            closeGoogleMapsTool();
            googleMapsButton.focus();
        });
    });
    document.getElementById("google-maps-change").addEventListener("click", startGoogleMapsPicking);
    map.on("click", chooseGoogleMapsDestination);

    /* Detiene la selección antes de iniciar otra herramienta. */
    document.querySelector(".map-tools").addEventListener("click", function (event) {
        const button = event.target.closest("button");
        if (button && button !== googleMapsButton) {
            closeGoogleMapsTool();
        }
    }, true);
    document.getElementById("search-input").addEventListener("focus", closeGoogleMapsTool);
    document.getElementById("home-view").addEventListener("click", closeGoogleMapsTool);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !googleMapsMenu.hidden) {
            closeGoogleMapsTool();
            googleMapsButton.focus();
        }
    });
}

initializeGoogleMapsTool();

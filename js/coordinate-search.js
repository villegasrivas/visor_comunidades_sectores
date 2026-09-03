/* Herramienta configurable para localizar coordenadas. */
const coordinateSearchConfig = appConfig.herramientas.buscarCoordenadas;
const coordinateSearchButton = document.getElementById("coordinate-search-button");
let coordinateSearchMenu = null;
let coordinateSearchMarker = null;

function parseCoordinateInput(value) {
    return Number(String(value).trim().replace(",", "."));
}

function parseUtmInput(value) {
    let normalizedValue = String(value).trim().replace(/\s/g, "");

    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalizedValue)) {
        normalizedValue = normalizedValue.replace(/\./g, "");
    }

    return Number(normalizedValue.replace(",", "."));
}

function closeCoordinateSearchTool() {
    if (coordinateSearchMenu) {
        coordinateSearchMenu.hidden = true;
        coordinateSearchButton.setAttribute("aria-expanded", "false");
    }
}

function clearCoordinateSearchMarker() {
    if (coordinateSearchMarker) {
        map.removeLayer(coordinateSearchMarker);
        coordinateSearchMarker = null;
    }
}

function showCoordinateSearchMessage(message, isError) {
    const messageElement = document.getElementById("coordinate-search-message");
    messageElement.textContent = message;
    messageElement.classList.toggle("coordinate-search-error", isError === true);
}

function locateCoordinate(latlng) {
    if (
        !Number.isFinite(latlng.lat) ||
        !Number.isFinite(latlng.lng) ||
        latlng.lat < -90 || latlng.lat > 90 ||
        latlng.lng < -180 || latlng.lng > 180
    ) {
        showCoordinateSearchMessage("La coordenada está fuera de rango.", true);
        return;
    }

    if (typeof clearMapSelection === "function") {
        clearMapSelection();
    }

    map.setView([latlng.lat, latlng.lng], coordinateSearchConfig.zoom || 17);
    clearCoordinateSearchMarker();

    if (coordinateSearchConfig.mostrarMarcador !== false) {
        coordinateSearchMarker = L.circleMarker(
            [latlng.lat, latlng.lng],
            coordinateSearchConfig.estiloMarcador || {}
        ).addTo(map);
    }

    updateCoordinatesDisplay(L.latLng(latlng.lat, latlng.lng));
    showCoordinateSearchMessage("Coordenada localizada.", false);
}

function updateCoordinateSearchMode() {
    const mode = document.getElementById("coordinate-search-system").value;
    document.getElementById("coordinate-fields-geographic").hidden = mode !== "geograficas";
    document.getElementById("coordinate-fields-utm").hidden = mode !== "utm";
    showCoordinateSearchMessage("", false);
}

function submitCoordinateSearch(event) {
    event.preventDefault();
    const mode = document.getElementById("coordinate-search-system").value;

    if (mode === "geograficas") {
        const latitude = parseCoordinateInput(document.getElementById("coordinate-latitude").value);
        const longitude = parseCoordinateInput(document.getElementById("coordinate-longitude").value);

        locateCoordinate({ lat: latitude, lng: longitude });
        return;
    }

    const easting = parseUtmInput(document.getElementById("coordinate-easting").value);
    const northing = parseUtmInput(document.getElementById("coordinate-northing").value);
    const zone = Number(coordinateSearchConfig.zonaUtm);

    if (
        !Number.isFinite(easting) || easting < 100000 || easting > 900000 ||
        !Number.isFinite(northing) || northing < 0 || northing > 10000000 ||
        !Number.isInteger(zone) || zone < 1 || zone > 60
    ) {
        showCoordinateSearchMessage("Revisa los valores UTM ingresados.", true);
        return;
    }

    locateCoordinate(utmToLatLng(
        easting,
        northing,
        zone,
        coordinateSearchConfig.hemisferioUtm || "S"
    ));
}

function initializeCoordinateSearchTool() {
    if (
        !coordinateSearchConfig ||
        coordinateSearchConfig.enabled === false ||
        (!coordinateSearchConfig.geograficas && !coordinateSearchConfig.utm)
    ) {
        coordinateSearchButton.style.display = "none";
        return;
    }

    coordinateSearchMenu = document.createElement("div");
    coordinateSearchMenu.id = "coordinate-search-menu";
    coordinateSearchMenu.className = "coordinate-search-menu";
    coordinateSearchMenu.hidden = true;
    coordinateSearchMenu.innerHTML =
        '<div class="coordinate-search-header">' +
            '<span>Ir a coordenada</span>' +
            '<button id="coordinate-search-close" type="button" aria-label="Cerrar búsqueda de coordenadas">×</button>' +
        '</div>' +
        '<form id="coordinate-search-form" class="coordinate-search-form">' +
            '<label>Sistema' +
                '<select id="coordinate-search-system"></select>' +
            '</label>' +
            '<div id="coordinate-fields-geographic" class="coordinate-search-fields">' +
                '<label>Latitud<input id="coordinate-latitude" inputmode="decimal" placeholder="-38,740000"></label>' +
                '<label>Longitud<input id="coordinate-longitude" inputmode="decimal" placeholder="-72,950000"></label>' +
            '</div>' +
            '<div id="coordinate-fields-utm" class="coordinate-search-fields" hidden>' +
                '<div class="coordinate-search-reference"></div>' +
                '<label>Este<input id="coordinate-easting" inputmode="decimal" placeholder="678169"></label>' +
                '<label>Norte<input id="coordinate-northing" inputmode="decimal" placeholder="5710080"></label>' +
            '</div>' +
            '<div id="coordinate-search-message" class="coordinate-search-message" aria-live="polite"></div>' +
            '<div class="coordinate-search-actions">' +
                '<button class="coordinate-search-submit" type="submit">Localizar</button>' +
                '<button id="coordinate-search-clear" type="button">Limpiar</button>' +
            '</div>' +
        '</form>';

    document.getElementById("map").appendChild(coordinateSearchMenu);
    const systemSelect = document.getElementById("coordinate-search-system");

    if (coordinateSearchConfig.geograficas) {
        systemSelect.add(new Option("Geográficas WGS84", "geograficas"));
    }

    if (coordinateSearchConfig.utm) {
        systemSelect.add(new Option("UTM WGS84", "utm"));
    }

    document.querySelector(".coordinate-search-reference").textContent =
        "Zona " + coordinateSearchConfig.zonaUtm +
        String(coordinateSearchConfig.hemisferioUtm || "S").toUpperCase();

    L.DomEvent.disableClickPropagation(coordinateSearchMenu);
    L.DomEvent.disableScrollPropagation(coordinateSearchMenu);
    coordinateSearchButton.setAttribute("aria-expanded", "false");
    systemSelect.addEventListener("change", updateCoordinateSearchMode);
    document.getElementById("coordinate-search-form").addEventListener("submit", submitCoordinateSearch);
    document.getElementById("coordinate-search-close").addEventListener("click", closeCoordinateSearchTool);
    document.getElementById("coordinate-search-clear").addEventListener("click", function () {
        clearCoordinateSearchMarker();
        showCoordinateSearchMessage("", false);
    });

    coordinateSearchButton.addEventListener("click", function () {
        if (typeof isMeasurementActive === "function" && isMeasurementActive()) {
            cancelMeasurement();
        }

        const measurementMenuElement = document.getElementById("measurement-menu");

        if (measurementMenuElement) {
            measurementMenuElement.hidden = true;
        }

        coordinateSearchMenu.hidden = !coordinateSearchMenu.hidden;
        coordinateSearchButton.setAttribute("aria-expanded", String(!coordinateSearchMenu.hidden));
    });

    updateCoordinateSearchMode();
}

initializeCoordinateSearchTool();

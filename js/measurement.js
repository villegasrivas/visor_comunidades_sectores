/* Medición configurable de distancias y superficies. */
const measurementToolConfig = appConfig.herramientas.medicion;
const measurementToolButton = document.getElementById("measurement-button");
let measurementMode = null;
let measurementPoints = [];
let measurementDraftLayer = null;
let measurementVertexLayers = [];
let measurementCompletedCount = 0;
let measurementLayerGroup = null;
let measurementMenu = null;
let measurementModeOptions = null;
let measurementActiveControls = null;
let measurementStatus = null;
let measurementFinishButton = null;
let measurementClearButton = null;
let restoreDoubleClickZoom = false;

function isMeasurementActive() {
    return measurementMode !== null;
}

function formatMeasurementNumber(value, decimals) {
    return value.toLocaleString("es-CL", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDistance(meters) {
    if (meters < 1000) {
        return formatMeasurementNumber(meters, 0) + " m";
    }

    return formatMeasurementNumber(meters / 1000, 2) + " km";
}

function formatArea(squareMeters) {
    if (squareMeters < 10000) {
        return formatMeasurementNumber(squareMeters, 0) + " m²";
    }

    if (squareMeters < 1000000) {
        return formatMeasurementNumber(squareMeters / 10000, 2) + " ha";
    }

    return formatMeasurementNumber(squareMeters / 1000000, 2) + " km²";
}

function calculateDistance(points) {
    let total = 0;

    for (let index = 1; index < points.length; index += 1) {
        total += points[index - 1].distanceTo(points[index]);
    }

    return total;
}

function calculateArea(points) {
    if (points.length < 3) {
        return 0;
    }

    const earthRadius = 6378137;
    const radians = Math.PI / 180;
    let area = 0;

    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];

        area +=
            (next.lng - current.lng) *
            radians *
            (2 + Math.sin(current.lat * radians) + Math.sin(next.lat * radians));
    }

    return Math.abs(area * earthRadius * earthRadius / 2);
}

function getCurrentMeasurementText() {
    if (measurementMode === "distancia" && measurementPoints.length >= 2) {
        return "Distancia: " + formatDistance(calculateDistance(measurementPoints));
    }

    if (measurementMode === "superficie" && measurementPoints.length >= 3) {
        return "Superficie: " + formatArea(calculateArea(measurementPoints));
    }

    return measurementMode === "distancia"
        ? "Agrega al menos dos puntos."
        : "Agrega al menos tres puntos.";
}

function updateMeasurementControls() {
    const minimumPoints = measurementMode === "distancia" ? 2 : 3;
    measurementFinishButton.disabled = measurementPoints.length < minimumPoints;
    measurementStatus.textContent = getCurrentMeasurementText();
}

function updateMeasurementGeometry(previewPoint) {
    if (!measurementDraftLayer) {
        return;
    }

    const displayPoints = previewPoint
        ? measurementPoints.concat([previewPoint])
        : measurementPoints;

    measurementDraftLayer.setLatLngs(displayPoints);
}

function removeMeasurementVertices() {
    measurementVertexLayers.forEach(function (vertexLayer) {
        measurementLayerGroup.removeLayer(vertexLayer);
    });
    measurementVertexLayers = [];
}

function finishMeasurementMode() {
    measurementMode = null;
    measurementPoints = [];
    measurementDraftLayer = null;
    removeMeasurementVertices();
    measurementModeOptions.hidden = false;
    measurementActiveControls.hidden = true;
    measurementToolButton.classList.remove("tool-button-active");
    measurementToolButton.setAttribute("aria-pressed", "false");
    document.getElementById("map").classList.remove("measurement-active");

    if (typeof setFeaturePopupsEnabled === "function") {
        setFeaturePopupsEnabled(true);
    }

    if (restoreDoubleClickZoom) {
        map.doubleClickZoom.enable();
    }

    restoreDoubleClickZoom = false;
}

function cancelMeasurement() {
    if (measurementDraftLayer) {
        measurementLayerGroup.removeLayer(measurementDraftLayer);
    }

    finishMeasurementMode();
}

function addMeasurementResultLabel(content, latlng) {
    const tooltip = L.tooltip({
        permanent: true,
        direction: "top",
        className: "measurement-result-label",
        offset: [0, -6]
    })
        .setLatLng(latlng)
        .setContent(content);

    measurementLayerGroup.addLayer(tooltip);
}

function finishMeasurement() {
    const minimumPoints = measurementMode === "distancia" ? 2 : 3;

    if (!isMeasurementActive() || measurementPoints.length < minimumPoints) {
        updateMeasurementControls();
        return;
    }

    updateMeasurementGeometry();

    const resultText = measurementMode === "distancia"
        ? formatDistance(calculateDistance(measurementPoints))
        : formatArea(calculateArea(measurementPoints));
    const labelPosition = measurementMode === "distancia"
        ? measurementPoints[measurementPoints.length - 1]
        : measurementDraftLayer.getBounds().getCenter();

    addMeasurementResultLabel(resultText, labelPosition);
    measurementCompletedCount += 1;
    measurementClearButton.disabled = false;
    finishMeasurementMode();
}

function startMeasurement(mode) {
    if (isMeasurementActive()) {
        cancelMeasurement();
    }

    if (typeof clearMapSelection === "function") {
        clearMapSelection();
    }

    map.closePopup();

    if (typeof setFeaturePopupsEnabled === "function") {
        setFeaturePopupsEnabled(false);
    }

    document.getElementById("layers-panel").classList.remove("layers-panel-open");
    document.getElementById("open-layers-panel").setAttribute("aria-expanded", "false");
    measurementMode = mode;
    measurementPoints = [];
    measurementModeOptions.hidden = true;
    measurementActiveControls.hidden = false;
    measurementMenu.hidden = false;
    measurementToolButton.classList.add("tool-button-active");
    measurementToolButton.setAttribute("aria-pressed", "true");
    document.getElementById("map").classList.add("measurement-active");

    restoreDoubleClickZoom = map.doubleClickZoom.enabled();
    map.doubleClickZoom.disable();

    const style = Object.assign({}, measurementToolConfig.estilo || {}, {
        interactive: false
    });

    measurementDraftLayer = mode === "distancia"
        ? L.polyline([], style)
        : L.polygon([], style);
    measurementLayerGroup.addLayer(measurementDraftLayer);
    updateMeasurementControls();
}

function addMeasurementPoint(latlng) {
    const previousPoint = measurementPoints[measurementPoints.length - 1];

    if (previousPoint && previousPoint.distanceTo(latlng) < 0.5) {
        return;
    }

    measurementPoints.push(latlng);
    const vertex = L.circleMarker(latlng, {
        radius: 4,
        color: measurementToolConfig.estilo.color,
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1,
        interactive: false
    });

    measurementVertexLayers.push(vertex);
    measurementLayerGroup.addLayer(vertex);
    updateMeasurementGeometry();
    updateMeasurementControls();
}

function createMeasurementButton(label, className, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
}

function initializeMeasurementTool() {
    if (
        !measurementToolConfig ||
        measurementToolConfig.enabled === false ||
        (!measurementToolConfig.distancia && !measurementToolConfig.superficie)
    ) {
        measurementToolButton.style.display = "none";
        return;
    }

    measurementLayerGroup = L.layerGroup().addTo(map);
    measurementMenu = document.createElement("div");
    measurementMenu.id = "measurement-menu";
    measurementMenu.className = "measurement-menu";
    measurementMenu.hidden = true;
    measurementMenu.innerHTML =
        '<div class="measurement-menu-header">' +
            '<span>Medición</span>' +
            '<button id="measurement-close" type="button" aria-label="Cerrar medición">×</button>' +
        "</div>";

    measurementModeOptions = document.createElement("div");
    measurementModeOptions.className = "measurement-mode-options";

    if (measurementToolConfig.distancia) {
        measurementModeOptions.appendChild(
            createMeasurementButton("Medir distancia", "measurement-option", function () {
                startMeasurement("distancia");
            })
        );
    }

    if (measurementToolConfig.superficie) {
        measurementModeOptions.appendChild(
            createMeasurementButton("Medir superficie", "measurement-option", function () {
                startMeasurement("superficie");
            })
        );
    }

    measurementClearButton = createMeasurementButton(
        "Limpiar mediciones",
        "measurement-option measurement-clear",
        function () {
            if (isMeasurementActive()) {
                cancelMeasurement();
            }
            measurementLayerGroup.clearLayers();
            measurementCompletedCount = 0;
            measurementClearButton.disabled = true;
        }
    );
    measurementClearButton.disabled = true;
    measurementModeOptions.appendChild(measurementClearButton);

    measurementActiveControls = document.createElement("div");
    measurementActiveControls.className = "measurement-active-controls";
    measurementActiveControls.hidden = true;
    measurementStatus = document.createElement("div");
    measurementStatus.className = "measurement-status";
    measurementFinishButton = createMeasurementButton(
        "Finalizar",
        "measurement-action measurement-finish",
        finishMeasurement
    );
    const cancelButton = createMeasurementButton(
        "Cancelar",
        "measurement-action",
        cancelMeasurement
    );

    measurementActiveControls.appendChild(measurementStatus);
    measurementActiveControls.appendChild(measurementFinishButton);
    measurementActiveControls.appendChild(cancelButton);
    measurementMenu.appendChild(measurementModeOptions);
    measurementMenu.appendChild(measurementActiveControls);
    document.getElementById("map").appendChild(measurementMenu);

    L.DomEvent.disableClickPropagation(measurementMenu);
    L.DomEvent.disableScrollPropagation(measurementMenu);
    L.DomEvent.disableClickPropagation(measurementToolButton);

    measurementToolButton.setAttribute("aria-expanded", "false");
    measurementToolButton.setAttribute("aria-pressed", "false");
    measurementToolButton.addEventListener("click", function () {
        if (typeof closeCoordinateSearchTool === "function") {
            closeCoordinateSearchTool();
        }

        if (isMeasurementActive()) {
            measurementMenu.hidden = false;
        } else {
            measurementMenu.hidden = !measurementMenu.hidden;
        }

        measurementToolButton.setAttribute(
            "aria-expanded",
            String(!measurementMenu.hidden)
        );
    });

    document.getElementById("measurement-close").addEventListener("click", function () {
        if (isMeasurementActive()) {
            cancelMeasurement();
        }
        measurementMenu.hidden = true;
        measurementToolButton.setAttribute("aria-expanded", "false");
    });

    map.on("click", function (event) {
        if (isMeasurementActive()) {
            addMeasurementPoint(event.latlng);
        }
    });

    map.on("mousemove", function (event) {
        if (isMeasurementActive() && measurementPoints.length > 0) {
            updateMeasurementGeometry(event.latlng);
        }
    });

    map.on("dblclick", function (event) {
        if (isMeasurementActive()) {
            L.DomEvent.preventDefault(event.originalEvent);
            finishMeasurement();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && isMeasurementActive()) {
            cancelMeasurement();
        }
    });
}

initializeMeasurementTool();

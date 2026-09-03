/* Carga, simbología e interacción de las capas GeoJSON. */
const loadedLayers = {};
const layerLegendSymbols = {};
const structuralHaloLayers = {};
const layerOpacityValues = {};
let selectedFeature = null;
let selectedFeatureConfig = null;
let searchResultState = null;
const featureInfoPanel = document.getElementById("feature-info-panel");
const featureInfoLayer = document.getElementById("feature-info-layer");
const featureInfoTitle = document.getElementById("feature-info-title");
const featureInfoContent = document.getElementById("feature-info-content");
const configValidationEnabled =
    appConfig.desarrollo && appConfig.desarrollo.validarConfiguracion === true;
const configValidationIssues = new Set();

function reportConfigIssue(message) {
    if (!configValidationEnabled || configValidationIssues.has(message)) {
        return;
    }

    configValidationIssues.add(message);
    console.warn("Configuración:", message);

    let diagnostics = document.getElementById("config-diagnostics");

    if (!diagnostics) {
        diagnostics = document.createElement("div");
        diagnostics.id = "config-diagnostics";
        diagnostics.className = "config-diagnostics";
        diagnostics.innerHTML =
            '<strong>Revisar config.js</strong>' +
            '<ul id="config-diagnostics-list"></ul>';
        document.getElementById("map").appendChild(diagnostics);
        L.DomEvent.disableClickPropagation(diagnostics);
        L.DomEvent.disableScrollPropagation(diagnostics);
    }

    const item = document.createElement("li");
    item.textContent = message;
    document.getElementById("config-diagnostics-list").appendChild(item);
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value);
    return element.innerHTML;
}

function formatPopupValue(value, fieldConfig) {
    if (fieldConfig.formato !== "decimal") {
        return value;
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        return value;
    }

    const decimals = fieldConfig.decimales !== undefined ? fieldConfig.decimales : 2;
    let formattedValue = numericValue.toLocaleString("es-CL", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });

    if (fieldConfig.prefijo) {
        formattedValue = fieldConfig.prefijo + formattedValue;
    }

    if (fieldConfig.sufijo) {
        formattedValue += fieldConfig.sufijo;
    }

    return formattedValue;
}

function buildPopupContent(feature, popupConfig) {
    if (!popupConfig || popupConfig.enabled === false) {
        return "";
    }

    const properties = feature.properties || {};
    let html = "";
    const titleValue = popupConfig.titulo ? properties[popupConfig.titulo] : null;

    if (titleValue !== null && titleValue !== undefined && String(titleValue).trim() !== "") {
        const titleText =
            (popupConfig.prefijo || "") +
            titleValue +
            (popupConfig.sufijo || "");

        html += '<div class="popup-title">' + escapeHtml(titleText) + "</div>";
    }

    (popupConfig.campos || []).forEach(function (fieldConfig) {
        const value = properties[fieldConfig.campo];

        if (value === null || value === undefined || String(value).trim() === "") {
            return;
        }

        html +=
            '<div class="popup-row">' +
                '<span class="popup-label">' + escapeHtml(fieldConfig.etiqueta) + ":</span>" +
                '<span class="popup-value">' +
                    escapeHtml(formatPopupValue(value, fieldConfig)) +
                "</span>" +
            "</div>";
    });

    return html;
}

function isFeatureInteractionSuspended() {
    return (typeof isMeasurementActive === "function" && isMeasurementActive()) ||
        (typeof isGoogleMapsPicking === "function" && isGoogleMapsPicking());
}

function openFeaturePopup(featureLayer) {
    if (isFeatureInteractionSuspended()) {
        return;
    }
    const popup = typeof featureLayer.getPopup === "function" ? featureLayer.getPopup() : null;

    if (popup && typeof featureLayer.getLatLng === "function") {
        popup.setLatLng(featureLayer.getLatLng()).openOn(map);
    } else if (typeof featureLayer.openPopup === "function") {
        featureLayer.openPopup();
    }
}

function closeFeatureInfoPanel() {
    featureInfoPanel.hidden = true;
    featureInfoLayer.textContent = "";
    featureInfoTitle.textContent = "";
    featureInfoContent.innerHTML = "";
}

function openFeatureInfoPanel(feature, layerConfig) {
    const panelConfig = layerConfig.infoPanel || {};
    const properties = feature.properties || {};
    const titleValue = panelConfig.titulo ? properties[panelConfig.titulo] : null;

    featureInfoLayer.textContent = layerConfig.nombre;
    featureInfoTitle.textContent =
        titleValue !== null && titleValue !== undefined && String(titleValue).trim() !== ""
            ? (panelConfig.prefijo || "") + titleValue + (panelConfig.sufijo || "")
            : "Información de la entidad";
    featureInfoContent.innerHTML = "";

    (panelConfig.campos || []).forEach(function (fieldConfig) {
        const value = properties[fieldConfig.campo];

        if (value === null || value === undefined || String(value).trim() === "") {
            return;
        }

        const row = document.createElement("div");
        const label = document.createElement("span");
        const content = document.createElement("div");

        row.className = "feature-info-row";
        label.className = "feature-info-label";
        content.className = "feature-info-value";
        label.textContent = fieldConfig.etiqueta || fieldConfig.campo;
        content.textContent = formatPopupValue(value, fieldConfig);
        row.appendChild(label);
        row.appendChild(content);
        featureInfoContent.appendChild(row);
    });

    if (featureInfoContent.children.length === 0) {
        featureInfoContent.textContent = "No hay información configurada para mostrar.";
    }

    featureInfoPanel.hidden = false;
}

function setFeaturePopupsEnabled(enabled) {
    Object.values(loadedLayers).forEach(function (leafletLayer) {
        leafletLayer.eachLayer(function (featureLayer) {
            if (!featureLayer._visorPopupContent) {
                return;
            }

            if (enabled && !featureLayer.getPopup()) {
                featureLayer.bindPopup(featureLayer._visorPopupContent);
                // Conserva la selección después del manejador de popup de Leaflet.
                if (featureLayer._visorSelectionHandler) {
                    featureLayer.off("click", featureLayer._visorSelectionHandler);
                    featureLayer.on("click", featureLayer._visorSelectionHandler);
                }
            } else if (!enabled && featureLayer.getPopup()) {
                featureLayer.unbindPopup();
            }
        });
    });
}

function normalizeUniqueValue(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function isNoDataValue(value, symbology) {
    return (symbology.valoresSinDatos || []).some(function (noDataValue) {
        return normalizeUniqueValue(noDataValue) === normalizeUniqueValue(value);
    });
}

function applyLayerOpacity(style, layerConfig) {
    const opacity = layerOpacityValues[layerConfig.id] ?? 1;
    const adjustedStyle = Object.assign({}, style || {});

    adjustedStyle.opacity = (adjustedStyle.opacity ?? 1) * opacity;

    if (adjustedStyle.fill !== false) {
        adjustedStyle.fillOpacity = (adjustedStyle.fillOpacity ?? 0.2) * opacity;
    }

    return adjustedStyle;
}

function getFeatureStyle(feature, layerConfig) {
    const symbology = layerConfig.simbologia || {};

    if (symbology.tipo === "simple") {
        return applyLayerOpacity(symbology.estilo || {}, layerConfig);
    }

    if (symbology.tipo === "valoresUnicos") {
        const properties = feature && feature.properties ? feature.properties : {};
        const featureValue = normalizeUniqueValue(properties[symbology.campo]);
        const category = (symbology.categorias || []).find(function (item) {
            return normalizeUniqueValue(item.valor) === featureValue;
        });

        return applyLayerOpacity(
            Object.assign(
                {},
                symbology.estiloBase || {},
                category ? category.estilo : symbology.estiloDefault || {}
            ),
            layerConfig
        );
    }

    if (symbology.tipo === "graduados") {
        const properties = feature && feature.properties ? feature.properties : {};
        const rawValue = properties[symbology.campo];
        const numericValue = Number(rawValue);
        let selectedClass = null;

        if (!isNoDataValue(rawValue, symbology) && !Number.isNaN(numericValue)) {
            selectedClass = (symbology.clases || []).find(function (classConfig) {
                const meetsMinimum =
                    classConfig.min === null ||
                    classConfig.min === undefined ||
                    numericValue > Number(classConfig.min);
                const meetsMaximum =
                    classConfig.max === null ||
                    classConfig.max === undefined ||
                    numericValue <= Number(classConfig.max);

                return meetsMinimum && meetsMaximum;
            });
        }

        return applyLayerOpacity(
            Object.assign(
                {},
                symbology.estiloBase || {},
                selectedClass ? selectedClass.estilo : symbology.estiloDefault || {}
            ),
            layerConfig
        );
    }

    console.warn("Tipo de simbología no implementado:", layerConfig.nombre, symbology.tipo);
    return {};
}

function updateLayerOpacity(layerConfig, leafletLayer, opacity) {
    layerOpacityValues[layerConfig.id] = opacity;

    leafletLayer.eachLayer(function (featureLayer) {
        if (typeof featureLayer.setStyle === "function") {
            featureLayer.setStyle(getFeatureStyle(featureLayer.feature, layerConfig));
        } else if (typeof featureLayer.setOpacity === "function") {
            featureLayer.setOpacity(opacity);
        }
    });
}

function isLayerWithinZoomRange(layerConfig) {
    const zoom = map.getZoom();
    const minimum = layerConfig.minZoom;
    const maximum = layerConfig.maxZoom;

    return (minimum === null || minimum === undefined || zoom >= Number(minimum)) &&
        (maximum === null || maximum === undefined || zoom <= Number(maximum));
}

function updateLayerScaleVisibility(layerConfig) {
    const leafletLayer = loadedLayers[layerConfig.id];

    if (!leafletLayer) {
        return;
    }

    const checkbox = document.getElementById("layer-" + layerConfig.id);
    const opacityInput = document.getElementById("opacity-" + layerConfig.id);
    const layerControl = document.getElementById("layer-control-" + layerConfig.id);
    const requestedVisible = layerConfig.estructural === true ||
        (checkbox ? checkbox.checked : layerConfig.visibleInicial === true);
    const withinRange = isLayerWithinZoomRange(layerConfig);
    const shouldShow = requestedVisible && withinRange;
    const haloLayer = structuralHaloLayers[layerConfig.id];

    if (shouldShow && !map.hasLayer(leafletLayer)) {
        leafletLayer.addTo(map);
    } else if (!shouldShow && map.hasLayer(leafletLayer)) {
        if (selectedFeatureConfig === layerConfig) {
            clearMapSelection();
        }
        map.removeLayer(leafletLayer);
    }

    if (haloLayer) {
        if (shouldShow && !map.hasLayer(haloLayer)) {
            haloLayer.addTo(map);
        } else if (!shouldShow && map.hasLayer(haloLayer)) {
            map.removeLayer(haloLayer);
        }
    }

    if (opacityInput && checkbox) {
        opacityInput.disabled = !checkbox.checked || !withinRange;
    }

    if (layerControl) {
        layerControl.classList.toggle("layer-control-out-of-scale", !withinRange);
    }
}

function updateAllLayerScaleVisibility() {
    appConfig.capas.forEach(updateLayerScaleVisibility);
    updateLegend();
    updateLayerLabels();
}

/* Detecta las geometrías dibujadas, incluso dentro de grupos y geometrías múltiples. */
function getLayerLegendSymbols(leafletLayer) {
    const symbols = new Map();

    function inspectLayer(layer) {
        if (typeof layer.eachLayer === "function") {
            layer.eachLayer(inspectLayer);
        } else if (layer instanceof L.Marker) {
            symbols.set("marcador", { tipo: "marcador", icono: layer.getIcon() });
        } else if (layer instanceof L.CircleMarker) {
            symbols.set("punto", { tipo: "punto" });
        } else if (layer instanceof L.Polygon) {
            symbols.set("poligono", { tipo: "poligono" });
        } else if (layer instanceof L.Polyline) {
            symbols.set("linea", { tipo: "linea" });
        }
    }

    inspectLayer(leafletLayer);
    return Array.from(symbols.values());
}

function getLegendEntries(layerConfig) {
    const symbology = layerConfig.simbologia || {};
    const legendConfig = layerConfig.leyenda || {};

    if (symbology.tipo === "valoresUnicos") {
        const entries = (symbology.categorias || []).map(function (category) {
            return {
                etiqueta: category.etiqueta || String(category.valor),
                estilo: Object.assign({}, symbology.estiloBase || {}, category.estilo || {})
            };
        });

        if (symbology.mostrarDefaultEnLeyenda !== false) {
            entries.push({
                etiqueta: symbology.etiquetaDefault || "Otros valores",
                estilo: Object.assign({}, symbology.estiloBase || {}, symbology.estiloDefault || {})
            });
        }

        return entries;
    }

    if (symbology.tipo === "graduados") {
        const entries = (symbology.clases || []).map(function (classConfig) {
            return {
                etiqueta: classConfig.etiqueta,
                estilo: Object.assign({}, symbology.estiloBase || {}, classConfig.estilo || {})
            };
        });

        if (symbology.mostrarDefaultEnLeyenda !== false) {
            entries.push({
                etiqueta: symbology.etiquetaDefault || "Sin datos",
                estilo: Object.assign({}, symbology.estiloBase || {}, symbology.estiloDefault || {})
            });
        }

        return entries;
    }

    return [{
        etiqueta: legendConfig.titulo || layerConfig.nombre,
        estilo: symbology.estilo || {},
        halo: layerConfig.estructural === true && symbology.halo && symbology.halo.enabled !== false
            ? symbology.halo
            : null
    }];
}

function isLabelVisibleAtCurrentZoom(labelConfig) {
    const zoom = map.getZoom();
    const minimumZoom = labelConfig.zoomMin ?? 0;
    const maximumZoom = labelConfig.zoomMax;

    return zoom >= minimumZoom &&
        (maximumZoom === null || maximumZoom === undefined || zoom <= maximumZoom);
}

function updateLayerLabels() {
    appConfig.capas.forEach(function (layerConfig) {
        const leafletLayer = loadedLayers[layerConfig.id];
        const labelConfig = layerConfig.etiquetado;
        const shouldShow =
            leafletLayer &&
            labelConfig &&
            labelConfig.enabled !== false &&
            map.hasLayer(leafletLayer) &&
            isLabelVisibleAtCurrentZoom(labelConfig);

        if (!leafletLayer) {
            return;
        }

        leafletLayer.eachLayer(function (featureLayer) {
            const properties = featureLayer.feature && featureLayer.feature.properties;
            const value = properties && labelConfig ? properties[labelConfig.campo] : null;
            const hasValue = value !== null && value !== undefined && String(value).trim() !== "";

            if (shouldShow && hasValue && !featureLayer.getTooltip()) {
                featureLayer.bindTooltip(escapeHtml(value), {
                    permanent: labelConfig.permanente !== false,
                    direction: labelConfig.direccion || "center",
                    interactive: false,
                    className: "feature-label " + (labelConfig.claseCss || "")
                });

                if (labelConfig.permanente !== false) {
                    featureLayer.openTooltip();
                }
            } else if ((!shouldShow || !hasValue) && featureLayer.getTooltip()) {
                featureLayer.unbindTooltip();
            }
        });
    });
}

function restoreSearchResultMode() {
    if (!searchResultState) {
        return;
    }

    const state = searchResultState;
    searchResultState = null;

    if (state.mode === "aislar") {
        state.hiddenFeatures.forEach(function (featureLayer) {
            state.parentLayer.addLayer(featureLayer);
        });
        return;
    }

    state.parentLayer.eachLayer(function (featureLayer) {
        if (typeof featureLayer.setStyle === "function") {
            featureLayer.setStyle(getFeatureStyle(featureLayer.feature, state.layerConfig));
        }
    });
}

function isolateFeature(featureLayer, layerConfig) {
    const parentLayer = loadedLayers[layerConfig.id];

    if (!parentLayer) {
        return;
    }

    const hiddenFeatures = [];

    parentLayer.eachLayer(function (candidateLayer) {
        if (candidateLayer !== featureLayer) {
            hiddenFeatures.push(candidateLayer);
        }
    });

    hiddenFeatures.forEach(function (candidateLayer) {
        parentLayer.removeLayer(candidateLayer);
    });

    searchResultState = {
        mode: "aislar",
        parentLayer: parentLayer,
        hiddenFeatures: hiddenFeatures
    };
}

function applyInverseContrast(featureLayer, layerConfig) {
    const parentLayer = loadedLayers[layerConfig.id];
    const inverseStyle = layerConfig.busqueda.estiloContrasteInverso || {};

    if (!parentLayer) {
        return;
    }

    parentLayer.eachLayer(function (candidateLayer) {
        if (typeof candidateLayer.setStyle !== "function") {
            return;
        }

        const configuredStyle = candidateLayer === featureLayer
            ? inverseStyle.seleccionado
            : inverseStyle.resto;

        candidateLayer.setStyle(Object.assign(
            {},
            getFeatureStyle(candidateLayer.feature, layerConfig),
            configuredStyle || {}
        ));
    });

    searchResultState = {
        mode: "contrasteInverso",
        parentLayer: parentLayer,
        layerConfig: layerConfig
    };
}

function clearMapSelection() {
    const featureToReset = selectedFeature;
    const configToReset = selectedFeatureConfig;

    selectedFeature = null;
    selectedFeatureConfig = null;
    closeFeatureInfoPanel();

    if (
        featureToReset &&
        configToReset &&
        typeof featureToReset.setStyle === "function"
    ) {
        featureToReset.setStyle(getFeatureStyle(featureToReset.feature, configToReset));
    }

    restoreSearchResultMode();

    if (
        featureToReset &&
        typeof featureToReset.isPopupOpen === "function" &&
        featureToReset.isPopupOpen()
    ) {
        featureToReset.closePopup();
    }
}

function selectMapFeature(featureLayer, layerConfig, options = {}) {
    if (isFeatureInteractionSuspended()) {
        return false;
    }
    const selectionConfig = layerConfig.seleccion || {};
    const highlightConfig = layerConfig.resaltado || {};
    const popupConfig = layerConfig.popup || {};
    const infoPanelConfig = layerConfig.infoPanel || {};
    const shouldCenter = options.center === true;
    const shouldHighlight =
        options.highlight === true &&
        selectionConfig.enabled !== false &&
        highlightConfig.enabled !== false;
    const shouldOpenInfoPanel =
        options.popup === true &&
        infoPanelConfig.enabled === true;
    const shouldOpenPopup =
        options.popup === true &&
        popupConfig.enabled !== false &&
        !shouldOpenInfoPanel;
    const resultMode = options.resultMode || "resaltar";
    const shouldIsolate = resultMode === "aislar";
    const shouldApplyInverseContrast = resultMode === "contrasteInverso";
    const parentLayer = loadedLayers[layerConfig.id];
    let clusterWillRevealFeature = false;

    clearMapSelection();

    if (shouldCenter) {
        if (
            layerConfig.cluster === true &&
            parentLayer &&
            typeof parentLayer.zoomToShowLayer === "function" &&
            typeof featureLayer.getLatLng === "function"
        ) {
            clusterWillRevealFeature = true;
            parentLayer.zoomToShowLayer(featureLayer, function () {
                if (shouldOpenPopup) {
                    openFeaturePopup(featureLayer);
                }
            });
        } else if (typeof featureLayer.getBounds === "function") {
            map.fitBounds(featureLayer.getBounds(), {
                padding: [30, 30],
                maxZoom: 16,
                animate: false
            });
        } else if (typeof featureLayer.getLatLng === "function") {
            map.setView(featureLayer.getLatLng(), Math.max(map.getZoom(), 16), {
                animate: false
            });
        }
    }

    if (
        shouldHighlight &&
        !shouldApplyInverseContrast &&
        typeof featureLayer.setStyle === "function"
    ) {
        featureLayer.setStyle(highlightConfig.estilo || {});
    }

    if (
        shouldHighlight || shouldIsolate || shouldApplyInverseContrast ||
        shouldOpenPopup || shouldOpenInfoPanel
    ) {
        selectedFeature = featureLayer;
        selectedFeatureConfig = layerConfig;
    }

    if (shouldIsolate) {
        isolateFeature(featureLayer, layerConfig);
    }

    if (shouldApplyInverseContrast) {
        applyInverseContrast(featureLayer, layerConfig);
    }

    if (
        shouldOpenPopup &&
        !clusterWillRevealFeature &&
        typeof featureLayer.openPopup === "function"
    ) {
        if (shouldCenter) {
            setTimeout(function () {
                openFeaturePopup(featureLayer);
            }, 50);
        } else {
            openFeaturePopup(featureLayer);
        }
    }

    if (shouldOpenInfoPanel) {
        openFeatureInfoPanel(featureLayer.feature, layerConfig);
    }

    return selectionConfig.enabled !== false;
}

function validateLayerConfigs() {
    const layerIds = new Set();
    const groupIds = new Set(
        appConfig.gruposCapas
            .filter(function (groupConfig) {
                return groupConfig.enabled !== false;
            })
            .map(function (groupConfig) {
                return groupConfig.id;
            })
    );
    const validSymbologyTypes = ["simple", "valoresUnicos", "graduados"];
    const validSearchModes = ["resaltar", "aislar", "contrasteInverso"];
    const cursorUtmConfig =
        appConfig.herramientas.coordenadasCursor && appConfig.herramientas.coordenadasCursor.utm;
    const coordinateSearchConfig = appConfig.herramientas.buscarCoordenadas;

    if (
        cursorUtmConfig && cursorUtmConfig.enabled === true &&
        (!Number.isInteger(Number(cursorUtmConfig.zona)) || Number(cursorUtmConfig.zona) < 1 || Number(cursorUtmConfig.zona) > 60)
    ) {
        reportConfigIssue("La zona UTM de coordenadasCursor debe estar entre 1 y 60.");
    }

    if (
        coordinateSearchConfig && coordinateSearchConfig.enabled !== false && coordinateSearchConfig.utm &&
        (!Number.isInteger(Number(coordinateSearchConfig.zonaUtm)) || Number(coordinateSearchConfig.zonaUtm) < 1 || Number(coordinateSearchConfig.zonaUtm) > 60)
    ) {
        reportConfigIssue("La zona UTM de buscarCoordenadas debe estar entre 1 y 60.");
    }

    appConfig.capas.forEach(function (layerConfig) {
        if (layerIds.has(layerConfig.id)) {
            reportConfigIssue("ID de capa duplicado: " + layerConfig.id + ".");
        }

        layerIds.add(layerConfig.id);

        if (!layerConfig.archivo || !layerConfig.simbologia) {
            reportConfigIssue("Configuración incompleta en la capa " + layerConfig.nombre + ".");
        }

        if (!groupIds.has(layerConfig.grupo)) {
            reportConfigIssue(
                "El grupo '" + layerConfig.grupo + "' de " + layerConfig.nombre + " no existe o está desactivado."
            );
        }

        ["minZoom", "maxZoom"].forEach(function (propertyName) {
            const value = layerConfig[propertyName];

            if (value !== null && value !== undefined && !Number.isFinite(Number(value))) {
                reportConfigIssue(
                    propertyName + " debe ser un número o null en " + layerConfig.nombre + "."
                );
            }
        });

        if (
            layerConfig.minZoom !== null && layerConfig.minZoom !== undefined &&
            layerConfig.maxZoom !== null && layerConfig.maxZoom !== undefined &&
            Number(layerConfig.minZoom) > Number(layerConfig.maxZoom)
        ) {
            reportConfigIssue("minZoom no puede ser mayor que maxZoom en " + layerConfig.nombre + ".");
        }

        if (
            layerConfig.simbologia &&
            !validSymbologyTypes.includes(layerConfig.simbologia.tipo)
        ) {
            reportConfigIssue(
                "Tipo de simbología desconocido en " + layerConfig.nombre + ": " +
                layerConfig.simbologia.tipo + "."
            );
        }

        if (
            layerConfig.simbologia &&
            layerConfig.simbologia.tipo === "valoresUnicos" &&
            (!layerConfig.simbologia.campo || !Array.isArray(layerConfig.simbologia.categorias))
        ) {
            reportConfigIssue("Simbología de valores únicos incompleta en " + layerConfig.nombre + ".");
        }

        if (
            layerConfig.simbologia &&
            layerConfig.simbologia.tipo === "graduados" &&
            (!layerConfig.simbologia.campo || !Array.isArray(layerConfig.simbologia.clases))
        ) {
            reportConfigIssue("Simbología graduada incompleta en " + layerConfig.nombre + ".");
        }

        if (
            layerConfig.busqueda &&
            layerConfig.busqueda.enabled !== false &&
            !validSearchModes.includes(layerConfig.busqueda.modoResultado || "resaltar")
        ) {
            reportConfigIssue(
                "Modo de búsqueda desconocido en " + layerConfig.nombre + ": " +
                layerConfig.busqueda.modoResultado + "."
            );
        }


        if (
            layerConfig.popup && layerConfig.popup.enabled !== false &&
            layerConfig.infoPanel && layerConfig.infoPanel.enabled === true
        ) {
            reportConfigIssue(
                layerConfig.nombre +
                " tiene popup e infoPanel activos; se usará infoPanel."
            );
        }
    });
}

function validateGeoJsonFields(layerConfig, geojsonData) {
    if (
        !geojsonData ||
        geojsonData.type !== "FeatureCollection" ||
        !Array.isArray(geojsonData.features)
    ) {
        reportConfigIssue(layerConfig.nombre + " no contiene un FeatureCollection válido.");
        return;
    }

    if (geojsonData.features.length === 0) {
        reportConfigIssue(layerConfig.nombre + " no contiene entidades.");
        return;
    }

    const availableFields = new Set();
    geojsonData.features.forEach(function (feature) {
        Object.keys(feature.properties || {}).forEach(function (fieldName) {
            availableFields.add(fieldName);
        });
    });

    const requiredFields = [];
    const popupConfig = layerConfig.popup || {};
    const infoPanelConfig = layerConfig.infoPanel || {};
    const searchConfig = layerConfig.busqueda || {};
    const symbologyConfig = layerConfig.simbologia || {};
    const labelConfig = layerConfig.etiquetado || {};

    if (popupConfig.enabled !== false) {
        if (popupConfig.titulo) {
            requiredFields.push({ field: popupConfig.titulo, use: "título del popup" });
        }
        (popupConfig.campos || []).forEach(function (fieldConfig) {
            requiredFields.push({ field: fieldConfig.campo, use: "popup" });
        });
    }


    if (infoPanelConfig.enabled === true) {
        if (infoPanelConfig.titulo) {
            requiredFields.push({ field: infoPanelConfig.titulo, use: "título del panel" });
        }
        (infoPanelConfig.campos || []).forEach(function (fieldConfig) {
            requiredFields.push({ field: fieldConfig.campo, use: "panel de información" });
        });
    }

    if (searchConfig.enabled !== false) {
        requiredFields.push({ field: searchConfig.campoPrincipal, use: "búsqueda" });
        (searchConfig.campos || []).forEach(function (fieldName) {
            requiredFields.push({ field: fieldName, use: "búsqueda" });
        });
    }

    if (symbologyConfig.tipo === "valoresUnicos" || symbologyConfig.tipo === "graduados") {
        requiredFields.push({ field: symbologyConfig.campo, use: "simbología" });
    }

    if (labelConfig.enabled !== false) {
        requiredFields.push({ field: labelConfig.campo, use: "etiquetado" });
    }

    requiredFields.forEach(function (requirement) {
        if (requirement.field && !availableFields.has(requirement.field)) {
            reportConfigIssue(
                "El campo '" + requirement.field + "' usado en " + requirement.use +
                " no existe en " + layerConfig.nombre + "."
            );
        }
    });
}

function loadGeoJsonLayer(layerConfig) {
    fetch(layerConfig.archivo)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Error HTTP " + response.status);
            }

            return response.json();
        })
        .then(function (geojsonData) {
            validateGeoJsonFields(layerConfig, geojsonData);
            const layerIsInteractive = layerConfig.interactive !== false;
            const layerIsStructural = layerConfig.estructural === true;
            const symbology = layerConfig.simbologia || {};
            const containsOnlyPoints = geojsonData.features.every(function (feature) {
                return feature.geometry && feature.geometry.type === "Point";
            });
            const clusterRequested = layerConfig.cluster === true;
            const canCluster = clusterRequested &&
                containsOnlyPoints &&
                typeof L.markerClusterGroup === "function";

            layerOpacityValues[layerConfig.id] = 1;

            if (clusterRequested && !containsOnlyPoints) {
                reportConfigIssue(
                    "cluster solo puede utilizarse con puntos en " + layerConfig.nombre + "."
                );
            } else if (clusterRequested && typeof L.markerClusterGroup !== "function") {
                reportConfigIssue("No fue posible iniciar el clustering de " + layerConfig.nombre + ".");
            }

            const geoJsonLayer = L.geoJSON(geojsonData, {
                interactive: layerIsInteractive,
                pane: layerIsStructural ? "structuralPane" : "overlayPane",
                style: function (feature) {
                    return getFeatureStyle(feature, layerConfig);
                },
                onEachFeature: function (feature, featureLayer) {
                    if (!layerIsInteractive) {
                        return;
                    }

                    const popupContent = buildPopupContent(feature, layerConfig.popup);

                    if (popupContent) {
                        featureLayer._visorPopupContent = popupContent;

                        if (!isFeatureInteractionSuspended()) {
                            featureLayer.bindPopup(popupContent);
                        }
                    }

                    if (
                        (layerConfig.seleccion && layerConfig.seleccion.enabled !== false) ||
                        (layerConfig.infoPanel && layerConfig.infoPanel.enabled === true)
                    ) {
                        featureLayer._visorSelectionHandler = function () {
                            if (isFeatureInteractionSuspended()) {
                                return;
                            }

                            const selectionConfig = layerConfig.seleccion || {};

                            selectMapFeature(featureLayer, layerConfig, {
                                center: selectionConfig.centrarAlSeleccionar === true,
                                highlight: true,
                                popup: true
                            });
                        };
                        featureLayer.on("click", featureLayer._visorSelectionHandler);
                    }

                    featureLayer.on("popupclose", function () {
                        if (selectedFeature === featureLayer) {
                            clearMapSelection();
                        }
                    });
                }
            });

            layerLegendSymbols[layerConfig.id] = getLayerLegendSymbols(geoJsonLayer);
            let leafletLayer = geoJsonLayer;

            if (canCluster) {
                const clusterLayer = L.markerClusterGroup({
                    chunkedLoading: true,
                    showCoverageOnHover: true,
                    zoomToBoundsOnClick: true,
                    spiderfyOnMaxZoom: true
                });

                geoJsonLayer.eachLayer(function (featureLayer) {
                    clusterLayer.addLayer(featureLayer);
                });
                leafletLayer = clusterLayer;
            }

            loadedLayers[layerConfig.id] = leafletLayer;

            if (layerIsStructural && symbology.halo && symbology.halo.enabled !== false) {
                const haloConfig = symbology.halo;
                const haloLayer = L.geoJSON(geojsonData, {
                    interactive: false,
                    pane: "structuralHaloPane",
                    style: {
                        color: haloConfig.color || "#ffffff",
                        weight: haloConfig.weight || 7,
                        opacity: haloConfig.opacity ?? 0.9,
                        fill: false,
                        lineCap: "round",
                        lineJoin: "round"
                    }
                });

                structuralHaloLayers[layerConfig.id] = haloLayer;
            }

            const checkbox = document.getElementById("layer-" + layerConfig.id);
            const opacityInput = document.getElementById("opacity-" + layerConfig.id);
            const opacityValue = document.getElementById("opacity-value-" + layerConfig.id);

            if (checkbox) {
                checkbox.addEventListener("change", function () {
                    clearMapSelection();
                    updateLayerScaleVisibility(layerConfig);
                    updateLegend();
                    updateLayerLabels();
                });
            }

            if (opacityInput) {
                opacityInput.addEventListener("input", function () {
                    const opacityPercent = Number(opacityInput.value);

                    clearMapSelection();
                    updateLayerOpacity(layerConfig, leafletLayer, opacityPercent / 100);
                    opacityValue.value = opacityPercent + "%";
                    opacityValue.textContent = opacityPercent + "%";
                });
            }

            updateLayerScaleVisibility(layerConfig);

            if (
                appConfig.mapa.vistaInicial.tipo === "capa" &&
                appConfig.mapa.vistaInicial.capaId === layerConfig.id
            ) {
                applyConfiguredView();
            }

            updateLegend();
            updateLayerLabels();
        })
        .catch(function (error) {
            const checkbox = document.getElementById("layer-" + layerConfig.id);

            if (checkbox) {
                checkbox.disabled = true;
            }

            console.error("No fue posible cargar la capa:", layerConfig.nombre, error);
            reportConfigIssue(
                "No fue posible cargar " + layerConfig.nombre + " desde '" + layerConfig.archivo + "'."
            );
        });
}

validateLayerConfigs();

document.getElementById("close-feature-info").addEventListener("click", clearMapSelection);

map.on("zoomend", updateAllLayerScaleVisibility);

appConfig.capas
    .filter(function (layerConfig) {
        return layerConfig.enabled !== false;
    })
    .forEach(loadGeoJsonLayer);

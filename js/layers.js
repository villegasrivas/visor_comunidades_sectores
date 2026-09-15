/* Carga, simbología e interacción de las capas GeoJSON. */
/* Las capas se incorporan en config.js; normalmente no modifique este archivo. */
const loadedLayers = {};
const layerLegendSymbols = {};
const structuralHaloLayers = {};
const layerOpacityValues = {};
const layerCategoryVisibility = {};
const layerFeatureLayers = {};
let selectedFeature = null;
let selectedFeatureConfig = null;
let selectedPointHighlight = null;
let searchResultState = null;
const featureInfoPanel = document.getElementById("feature-info-panel");
const featureInfoLayer = document.getElementById("feature-info-layer");
const featureInfoTitle = document.getElementById("feature-info-title");
const featureInfoContent = document.getElementById("feature-info-content");
let featureInfoPanelMode = null;
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
    const factor = fieldConfig.factor !== undefined ? Number(fieldConfig.factor) : 1;

    if (!Number.isFinite(numericValue) || !Number.isFinite(factor)) {
        return value;
    }

    const decimals = fieldConfig.decimales !== undefined ? fieldConfig.decimales : 2;
    let formattedValue = (numericValue * factor).toLocaleString("es-CL", {
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
    featureInfoPanelMode = null;
}

function appendFeatureInfoRow(labelText, value) {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const content = document.createElement("div");

    row.className = "feature-info-row";
    label.className = "feature-info-label";
    content.className = "feature-info-value";
    label.textContent = labelText;
    content.textContent = value;
    row.appendChild(label);
    row.appendChild(content);
    featureInfoContent.appendChild(row);
    return content;
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
    featureInfoPanelMode = "entity";

    (panelConfig.campos || []).forEach(function (fieldConfig) {
        const value = properties[fieldConfig.campo];

        if (value === null || value === undefined || String(value).trim() === "") {
            return;
        }

        appendFeatureInfoRow(
            fieldConfig.etiqueta || fieldConfig.campo,
            formatPopupValue(value, fieldConfig)
        );
    });

    if (featureInfoContent.children.length === 0) {
        featureInfoContent.textContent = "No hay información configurada para mostrar.";
    }

    featureInfoPanel.hidden = false;
}

function normalizeCategoryInfoValue(value) {
    return String(value).trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

/* Resume valores distintos del campo y cuenta cuántas entidades comparten cada uno. */
function summarizeCategoryField(features, fieldConfig) {
    const values = new Map();

    features.forEach(function (feature) {
        const properties = feature.properties || {};
        const value = properties[fieldConfig.campo];

        if (value === null || value === undefined || String(value).trim() === "") {
            return;
        }

        const key = normalizeCategoryInfoValue(value);
        const current = values.get(key);

        if (current) {
            current.count += 1;
        } else {
            values.set(key, { value: value, count: 1 });
        }
    });

    return Array.from(values.values());
}

/* Calcula estadísticas numéricas y aplica conversión, redondeo y unidad al total. */
function calculateConfiguredStatistic(features, statisticConfig) {
    const values = features
        .map(function (feature) {
            const rawValue = (feature.properties || {})[statisticConfig.campo];

            if (
                rawValue === null || rawValue === undefined ||
                String(rawValue).trim() === ""
            ) {
                return null;
            }

            const numericValue = Number(rawValue);
            return Number.isFinite(numericValue) ? numericValue : null;
        })
        .filter(function (value) {
            return value !== null;
        });

    if (values.length === 0 || (statisticConfig.operacion || "suma") !== "suma") {
        return null;
    }

    const total = values.reduce(function (sum, value) {
        return sum + value;
    }, 0);

    return formatPopupValue(
        total,
        Object.assign({}, statisticConfig, { formato: "decimal" })
    );
}

function getLayerDataFeatures(layerConfig) {
    if (!Object.prototype.hasOwnProperty.call(layerFeatureLayers, layerConfig.id)) {
        return null;
    }

    return layerFeatureLayers[layerConfig.id].map(function (featureLayer) {
        return featureLayer.feature;
    });
}

function getCategoryFeatures(layerConfig, category) {
    const symbology = layerConfig.simbologia || {};

    return (layerFeatureLayers[layerConfig.id] || [])
        .map(function (featureLayer) {
            return featureLayer.feature;
        })
        .filter(function (feature) {
            const matchedCategory = findUniqueCategory(feature, symbology);

            return matchedCategory &&
                normalizeUniqueValue(matchedCategory.valor) === normalizeUniqueValue(category.valor);
        });
}

function appendMultipleCategoryValues(values, fieldConfig) {
    const content = appendFeatureInfoRow(
        fieldConfig.etiqueta || fieldConfig.campo,
        "Valores múltiples (" + values.length + ")"
    );
    const list = document.createElement("ul");

    list.className = "category-info-values";
    values.forEach(function (item) {
        const listItem = document.createElement("li");
        const value = document.createElement("span");
        const count = document.createElement("span");

        value.textContent = formatPopupValue(item.value, fieldConfig);
        count.className = "category-info-count";
        count.textContent = item.count + (item.count === 1 ? " entidad" : " entidades");
        listItem.appendChild(value);
        listItem.appendChild(count);
        list.appendChild(listItem);
    });
    content.appendChild(list);
}

/* Abre información común de una categoría sin modificar su filtro ni la selección. */
function openCategoryInfoPanel(layerConfig, category) {
    const panelConfig = layerConfig.infoCategorias || {};
    const categoryInfo = category.informacion || {};
    const features = getCategoryFeatures(layerConfig, category);

    layerMetadataPanel.hidden = true;
    featureInfoLayer.textContent = layerConfig.nombre;
    featureInfoTitle.textContent = category.etiqueta || String(category.valor);
    featureInfoContent.innerHTML = "";
    featureInfoPanelMode = "category";

    if (categoryInfo.descripcion) {
        const description = document.createElement("p");

        description.className = "category-info-description";
        description.textContent = categoryInfo.descripcion;
        featureInfoContent.appendChild(description);
    }

    (panelConfig.camposAdicionales || [])
        .concat(categoryInfo.camposAdicionales || [])
        .forEach(function (fieldConfig) {
            appendFeatureInfoRow(fieldConfig.etiqueta || "Información", fieldConfig.valor);
        });

    if (panelConfig.mostrarCantidad !== false) {
        appendFeatureInfoRow(
            panelConfig.etiquetaCantidad || "Cantidad de entidades",
            String(features.length)
        );
    }

    (panelConfig.campos || []).forEach(function (fieldConfig) {
        const values = summarizeCategoryField(features, fieldConfig);

        if (values.length === 0) {
            appendFeatureInfoRow(
                fieldConfig.etiqueta || fieldConfig.campo,
                "Sin información"
            );
        } else if (values.length === 1) {
            appendFeatureInfoRow(
                fieldConfig.etiqueta || fieldConfig.campo,
                formatPopupValue(values[0].value, fieldConfig)
            );
        } else {
            appendMultipleCategoryValues(values, fieldConfig);
        }
    });

    (panelConfig.estadisticas || []).forEach(function (statisticConfig) {
        const value = calculateConfiguredStatistic(features, statisticConfig);

        appendFeatureInfoRow(
            statisticConfig.etiqueta || statisticConfig.campo,
            value === null ? "Sin información" : value
        );
    });

    if (categoryInfo.enlace) {
        const link = document.createElement("a");

        link.className = "category-info-link";
        link.href = categoryInfo.enlace;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = categoryInfo.textoEnlace || "Más información";
        featureInfoContent.appendChild(link);
    }

    if (features.length === 0 && featureInfoContent.children.length === 0) {
        featureInfoContent.textContent = "La información de esta categoría aún no está disponible.";
    }

    featureInfoPanel.hidden = false;
}

function closeCurrentInfoPanel() {
    if (featureInfoPanelMode === "entity") {
        clearMapSelection();
    } else {
        closeFeatureInfoPanel();
    }
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

function getFeatureGeometryKind(feature) {
    const type = feature && feature.geometry ? feature.geometry.type : "";

    if (type === "Point" || type === "MultiPoint") return "punto";
    if (type === "LineString" || type === "MultiLineString") return "linea";
    if (type === "Polygon" || type === "MultiPolygon") return "poligono";
    return "mixta";
}

/* Convierte propiedades de relleno en trazo cuando la geometría es lineal. */
function adaptStyleToGeometry(style, geometryKind) {
    const adaptedStyle = Object.assign({}, style || {});

    if (geometryKind === "linea") {
        if (adaptedStyle.fillColor !== undefined) {
            adaptedStyle.color = adaptedStyle.fillColor;
        }
        delete adaptedStyle.fillColor;
        delete adaptedStyle.fillOpacity;
        adaptedStyle.fill = false;
    }

    return adaptedStyle;
}

function mergeStylesForGeometry(geometryKind) {
    const styles = Array.prototype.slice.call(arguments, 1);
    return Object.assign.apply({}, [{}].concat(styles.map(function (style) {
        return adaptStyleToGeometry(style, geometryKind);
    })));
}

function findUniqueCategory(feature, symbology) {
    const properties = feature && feature.properties ? feature.properties : {};
    const featureValue = normalizeUniqueValue(properties[symbology.campo]);

    return (symbology.categorias || []).find(function (item) {
        return normalizeUniqueValue(item.valor) === featureValue;
    });
}

function shouldRenderFeature(feature, layerConfig) {
    const symbology = layerConfig.simbologia || {};

    return symbology.tipo !== "valoresUnicos" ||
        symbology.mostrarNoConfigurados !== false ||
        Boolean(findUniqueCategory(feature, symbology));
}

function isCategoryFilterEnabled(layerConfig) {
    const symbology = layerConfig.simbologia || {};
    const filterConfig = symbology.filtroCategorias || {};

    return symbology.tipo === "valoresUnicos" && filterConfig.enabled === true;
}

function initializeCategoryFilterState(layerConfig) {
    if (layerCategoryVisibility[layerConfig.id]) {
        return layerCategoryVisibility[layerConfig.id];
    }

    const symbology = layerConfig.simbologia || {};
    const state = new Map();

    (symbology.categorias || []).forEach(function (category) {
        state.set(normalizeUniqueValue(category.valor), category.visibleInicial !== false);
    });
    state.set("__default__", symbology.visibleDefaultInicial !== false);
    layerCategoryVisibility[layerConfig.id] = state;
    return state;
}

function getFeatureCategoryFilterKey(feature, layerConfig) {
    const symbology = layerConfig.simbologia || {};
    const category = findUniqueCategory(feature, symbology);

    return category ? normalizeUniqueValue(category.valor) : "__default__";
}

function isConfiguredCategoryVisible(layerConfig, category) {
    if (!isCategoryFilterEnabled(layerConfig)) {
        return true;
    }

    return initializeCategoryFilterState(layerConfig)
        .get(normalizeUniqueValue(category.valor)) !== false;
}

function isDefaultCategoryVisible(layerConfig) {
    return !isCategoryFilterEnabled(layerConfig) ||
        initializeCategoryFilterState(layerConfig).get("__default__") !== false;
}

function isFeatureCategoryVisible(feature, layerConfig) {
    if (!isCategoryFilterEnabled(layerConfig)) {
        return true;
    }

    return initializeCategoryFilterState(layerConfig)
        .get(getFeatureCategoryFilterKey(feature, layerConfig)) !== false;
}

function applyLayerCategoryFilter(layerConfig) {
    const leafletLayer = loadedLayers[layerConfig.id];
    const featureLayers = layerFeatureLayers[layerConfig.id] || [];

    if (!leafletLayer) {
        return;
    }

    featureLayers.forEach(function (featureLayer) {
        const shouldShow = isFeatureCategoryVisible(featureLayer.feature, layerConfig);
        const isShown = leafletLayer.hasLayer(featureLayer);

        if (shouldShow && !isShown) {
            leafletLayer.addLayer(featureLayer);
        } else if (!shouldShow && isShown) {
            leafletLayer.removeLayer(featureLayer);
        }
    });
}

function updateCategoryFilterPresentation(layerConfig) {
    clearMapSelection();
    applyLayerCategoryFilter(layerConfig);
    updateLegend();
    updateLayerLabels();

    if (typeof clearSearchResults === "function") {
        clearSearchResults();
    }
}

function setLayerCategoryVisibility(layerConfig, categoryValue, visible) {
    initializeCategoryFilterState(layerConfig)
        .set(normalizeUniqueValue(categoryValue), visible);
    updateCategoryFilterPresentation(layerConfig);
}

function setLayerDefaultCategoryVisibility(layerConfig, visible) {
    initializeCategoryFilterState(layerConfig).set("__default__", visible);
    updateCategoryFilterPresentation(layerConfig);
}

function setAllLayerCategoriesVisibility(layerConfig, visible) {
    const symbology = layerConfig.simbologia || {};
    const state = initializeCategoryFilterState(layerConfig);

    (symbology.categorias || []).forEach(function (category) {
        state.set(normalizeUniqueValue(category.valor), visible);
    });
    state.set("__default__", visible);

    const container = document.getElementById("category-filter-" + layerConfig.id);
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
            input.checked = visible;
        });
    }

    updateCategoryFilterPresentation(layerConfig);
}

function shouldUseCirclePointSymbol(layerConfig) {
    const symbology = layerConfig.simbologia || {};

    return (symbology.simboloPunto || "circulo") === "circulo";
}

function getPointSymbolType(layerConfig) {
    const symbology = layerConfig.simbologia || {};

    return symbology.simboloPunto || "circulo";
}

/* Genera cuadrados, triángulos y cruces como SVG liviano dentro de un marcador. */
function createPointSymbolIcon(style, symbolType) {
    const radius = Math.min(Math.max(Number(style.radius) || 7, 3), 20);
    const weight = Math.min(Math.max(Number(style.weight) || 0, 0), 8);
    const size = Math.ceil((radius + weight + 2) * 2);
    const center = size / 2;
    const arm = radius;
    const thickness = Math.max(2, radius * 0.34);
    const color = escapeHtml(style.color || "#3388ff");
    const fillColor = escapeHtml(style.fillColor || style.color || "#3388ff");
    const stroke = style.stroke === false ? "none" : color;
    const fill = style.fill === false ? "none" : fillColor;
    const strokeOpacity = style.opacity ?? 1;
    const fillOpacity = style.fillOpacity ?? 0.8;
    let shape;

    if (symbolType === "cuadrado") {
        shape = '<rect x="' + (center - arm) + '" y="' + (center - arm) +
            '" width="' + (arm * 2) + '" height="' + (arm * 2) + '" rx="1" />';
    } else if (symbolType === "triangulo") {
        shape = '<path d="M ' + center + " " + (center - arm) +
            " L " + (center + arm) + " " + (center + arm) +
            " L " + (center - arm) + " " + (center + arm) + ' Z" />';
    } else {
        shape = '<path d="M ' + (center - thickness) + " " + (center - arm) +
            " H " + (center + thickness) + " V " + (center - thickness) +
            " H " + (center + arm) + " V " + (center + thickness) +
            " H " + (center + thickness) + " V " + (center + arm) +
            " H " + (center - thickness) + " V " + (center + thickness) +
            " H " + (center - arm) + " V " + (center - thickness) +
            " H " + (center - thickness) + ' Z" />';
    }

    return L.divIcon({
        className: "map-vector-point-icon map-vector-point-icon--" + symbolType,
        html: '<svg viewBox="0 0 ' + size + " " + size +
            '" aria-hidden="true"><g stroke="' + stroke +
            '" stroke-width="' + weight +
            '" stroke-opacity="' + strokeOpacity +
            '" stroke-linejoin="round" fill="' + fill +
            '" fill-opacity="' + fillOpacity + '">' + shape + "</g></svg>",
        iconSize: [size, size],
        iconAnchor: [center, center]
    });
}

function getFeatureInteractionStyle(feature, configuredStyle, role) {
    const geometryKind = getFeatureGeometryKind(feature);
    const style = configuredStyle || {};
    const adaptedStyle = adaptStyleToGeometry(style, geometryKind);

    // En contraste inverso, la opacidad de relleno también atenúa las líneas restantes.
    if (
        geometryKind === "linea" &&
        role === "resto" &&
        style.opacity === undefined &&
        style.fillOpacity !== undefined
    ) {
        adaptedStyle.opacity = style.fillOpacity;
    }

    return adaptedStyle;
}

function getMarkerInteractionOpacity(configuredStyle, role) {
    const style = configuredStyle || {};

    if (style.opacity !== undefined) return Number(style.opacity);
    if (role === "resto" && style.fillOpacity !== undefined) return Number(style.fillOpacity);
    return 1;
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
    const geometryKind = getFeatureGeometryKind(feature);

    if (symbology.tipo === "simple") {
        return applyLayerOpacity(
            mergeStylesForGeometry(geometryKind, symbology.estilo || {}),
            layerConfig
        );
    }

    if (symbology.tipo === "valoresUnicos") {
        const category = findUniqueCategory(feature, symbology);

        return applyLayerOpacity(
            mergeStylesForGeometry(
                geometryKind,
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
            mergeStylesForGeometry(
                geometryKind,
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
        } else if (layer._visorPointSymbolType) {
            symbols.set("punto-" + layer._visorPointSymbolType, {
                tipo: "punto",
                forma: layer._visorPointSymbolType
            });
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

function getLegendEntries(layerConfig, geometryKind) {
    const symbology = layerConfig.simbologia || {};
    const legendConfig = layerConfig.leyenda || {};

    if (symbology.tipo === "valoresUnicos") {
        const entries = (symbology.categorias || [])
            .filter(function (category) {
                return isConfiguredCategoryVisible(layerConfig, category);
            })
            .map(function (category) {
            return {
                etiqueta: category.etiqueta || String(category.valor),
                estilo: mergeStylesForGeometry(
                    geometryKind,
                    symbology.estiloBase || {},
                    category.estilo || {}
                )
            };
        });

        if (
            symbology.mostrarDefaultEnLeyenda !== false &&
            isDefaultCategoryVisible(layerConfig)
        ) {
            entries.push({
                etiqueta: symbology.etiquetaDefault || "Otros valores",
                estilo: mergeStylesForGeometry(
                    geometryKind,
                    symbology.estiloBase || {},
                    symbology.estiloDefault || {}
                )
            });
        }

        return entries;
    }

    if (symbology.tipo === "graduados") {
        const entries = (symbology.clases || []).map(function (classConfig) {
            return {
                etiqueta: classConfig.etiqueta,
                estilo: mergeStylesForGeometry(
                    geometryKind,
                    symbology.estiloBase || {},
                    classConfig.estilo || {}
                )
            };
        });

        if (symbology.mostrarDefaultEnLeyenda !== false) {
            entries.push({
                etiqueta: symbology.etiquetaDefault || "Sin datos",
                estilo: mergeStylesForGeometry(
                    geometryKind,
                    symbology.estiloBase || {},
                    symbology.estiloDefault || {}
                )
            });
        }

        return entries;
    }

    return [{
        etiqueta: legendConfig.titulo || layerConfig.nombre,
        estilo: adaptStyleToGeometry(symbology.estilo || {}, geometryKind),
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

/* Ubica y orienta la etiqueta sobre un mismo tramo recto de la línea. */
function getLineLabelPlacement(featureLayer) {
    if (!featureLayer || typeof featureLayer.getLatLngs !== "function") {
        return { angle: 0, latLng: null };
    }

    let longestLength = 0;
    let selectedAngle = 0;
    let selectedLatLng = null;

    function inspectLatLngs(latLngs) {
        if (!Array.isArray(latLngs) || latLngs.length === 0) {
            return;
        }

        if (latLngs[0] && typeof latLngs[0].lat === "number") {
            for (let index = 1; index < latLngs.length; index += 1) {
                const start = map.latLngToLayerPoint(latLngs[index - 1]);
                const end = map.latLngToLayerPoint(latLngs[index]);
                const deltaX = end.x - start.x;
                const deltaY = end.y - start.y;
                const length = (deltaX * deltaX) + (deltaY * deltaY);

                if (length > longestLength) {
                    longestLength = length;
                    selectedAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                    selectedLatLng = {
                        lat: (latLngs[index - 1].lat + latLngs[index].lat) / 2,
                        lng: (latLngs[index - 1].lng + latLngs[index].lng) / 2
                    };
                }
            }
            return;
        }

        latLngs.forEach(inspectLatLngs);
    }

    inspectLatLngs(featureLayer.getLatLngs());

    while (selectedAngle > 90) {
        selectedAngle -= 180;
    }
    while (selectedAngle < -90) {
        selectedAngle += 180;
    }

    return {
        angle: Math.round(selectedAngle * 10) / 10,
        latLng: selectedLatLng
    };
}

function getLineLabelAngle(featureLayer) {
    return getLineLabelPlacement(featureLayer).angle;
}

function shouldOrientLabelAlongLine(featureLayer, labelConfig) {
    const geometryType = featureLayer && featureLayer.feature &&
        featureLayer.feature.geometry && featureLayer.feature.geometry.type;

    return labelConfig.orientacion === "linea" &&
        (geometryType === "LineString" || geometryType === "MultiLineString");
}

function buildFeatureLabel(value, featureLayer, labelConfig, placement) {
    if (!shouldOrientLabelAlongLine(featureLayer, labelConfig)) {
        return escapeHtml(value);
    }

    const angle = placement ? placement.angle : getLineLabelAngle(featureLayer);
    return '<span class="feature-label-text" style="--label-angle:' + angle + 'deg">' +
        escapeHtml(value) +
        "</span>";
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

            if (!shouldShow || !hasValue) {
                if (featureLayer.getTooltip()) {
                    featureLayer.unbindTooltip();
                }
                return;
            }

            const lineOrientation = shouldOrientLabelAlongLine(featureLayer, labelConfig);
            const labelPlacement = lineOrientation ? getLineLabelPlacement(featureLayer) : null;

            /* Al cambiar el zoom, recalcula juntos el punto y el ángulo de las líneas. */
            if (lineOrientation && featureLayer.getTooltip()) {
                featureLayer.unbindTooltip();
            }

            if (!featureLayer.getTooltip() && (!lineOrientation || labelPlacement.latLng)) {
                const labelClasses = [
                    "feature-label",
                    labelConfig.claseCss || "",
                    lineOrientation ? "feature-label-line" : ""
                ].filter(Boolean).join(" ");

                featureLayer.bindTooltip(
                    buildFeatureLabel(value, featureLayer, labelConfig, labelPlacement),
                    {
                        permanent: labelConfig.permanente !== false,
                        direction: labelConfig.direccion || "center",
                        interactive: false,
                        className: labelClasses
                    }
                );

                if (labelConfig.permanente !== false) {
                    if (lineOrientation) {
                        featureLayer.openTooltip(labelPlacement.latLng);
                    } else {
                        featureLayer.openTooltip();
                    }
                }
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
        } else if (typeof featureLayer.setOpacity === "function") {
            featureLayer.setOpacity(layerOpacityValues[state.layerConfig.id] ?? 1);
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
        const configuredStyle = candidateLayer === featureLayer
            ? inverseStyle.seleccionado
            : inverseStyle.resto;
        const role = candidateLayer === featureLayer ? "seleccionado" : "resto";

        if (typeof candidateLayer.setStyle === "function") {
            candidateLayer.setStyle(Object.assign(
                {},
                getFeatureStyle(candidateLayer.feature, layerConfig),
                getFeatureInteractionStyle(candidateLayer.feature, configuredStyle, role)
            ));
        } else if (typeof candidateLayer.setOpacity === "function") {
            candidateLayer.setOpacity(getMarkerInteractionOpacity(configuredStyle, role));
        }
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

    if (selectedPointHighlight) {
        map.removeLayer(selectedPointHighlight);
        selectedPointHighlight = null;
    }

    if (
        featureToReset &&
        configToReset &&
        typeof featureToReset.setStyle === "function"
    ) {
        featureToReset.setStyle(getFeatureStyle(featureToReset.feature, configToReset));
    } else if (
        featureToReset &&
        configToReset &&
        typeof featureToReset.setOpacity === "function"
    ) {
        featureToReset.setOpacity(layerOpacityValues[configToReset.id] ?? 1);
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

    if (shouldHighlight && !shouldApplyInverseContrast) {
        if (typeof featureLayer.setStyle === "function") {
            featureLayer.setStyle(getFeatureInteractionStyle(
                featureLayer.feature,
                highlightConfig.estilo,
                "seleccionado"
            ));
        } else if (typeof featureLayer.getLatLng === "function") {
            const markerStyle = highlightConfig.estilo || {};
            selectedPointHighlight = L.circleMarker(featureLayer.getLatLng(), {
                pane: getLayerPaneName(layerConfig),
                interactive: false,
                radius: markerStyle.radius ?? 12,
                color: markerStyle.fillColor || markerStyle.color || "#f28c28",
                weight: Math.max(Number(markerStyle.weight) || 3, 3),
                opacity: markerStyle.opacity ?? 1,
                fill: false
            }).addTo(map);
        }
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
    const validPointSymbols = ["marcador", "circulo", "cuadrado", "triangulo", "cruz"];
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
            layerConfig.simbologia.simboloPunto &&
            !validPointSymbols.includes(layerConfig.simbologia.simboloPunto)
        ) {
            reportConfigIssue(
                "Símbolo puntual desconocido en " + layerConfig.nombre + ": " +
                layerConfig.simbologia.simboloPunto + "."
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
            layerConfig.infoCategorias && layerConfig.infoCategorias.enabled === true &&
            layerConfig.simbologia && layerConfig.simbologia.tipo !== "valoresUnicos"
        ) {
            reportConfigIssue(
                "infoCategorias solo funciona con valores únicos en " + layerConfig.nombre + "."
            );
        }

        [
            { name: "metadata", config: layerConfig.metadata },
            { name: "infoCategorias", config: layerConfig.infoCategorias }
        ].forEach(function (owner) {
            (owner.config && owner.config.estadisticas || []).forEach(function (statisticConfig) {
                if ((statisticConfig.operacion || "suma") !== "suma") {
                    reportConfigIssue(
                        "Operación estadística desconocida en " + owner.name + " de " +
                        layerConfig.nombre + ": " + statisticConfig.operacion + "."
                    );
                }
                if (
                    statisticConfig.factor !== undefined &&
                    !Number.isFinite(Number(statisticConfig.factor))
                ) {
                    reportConfigIssue(
                        "factor debe ser numérico en " + owner.name + " de " + layerConfig.nombre + "."
                    );
                }
            });
        });

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
    const metadataConfig = layerConfig.metadata || {};
    const categoryInfoConfig = layerConfig.infoCategorias || {};
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

    if (categoryInfoConfig.enabled === true) {
        (categoryInfoConfig.campos || []).forEach(function (fieldConfig) {
            requiredFields.push({ field: fieldConfig.campo, use: "información de categorías" });
        });
        (categoryInfoConfig.estadisticas || []).forEach(function (statisticConfig) {
            requiredFields.push({ field: statisticConfig.campo, use: "estadísticas de categorías" });
        });
    }

    if (metadataConfig.enabled !== false) {
        (metadataConfig.estadisticas || []).forEach(function (statisticConfig) {
            requiredFields.push({ field: statisticConfig.campo, use: "estadísticas de metadata" });
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
            const paneName = getLayerPaneName(layerConfig);
            const containsOnlyPoints = geojsonData.features.every(function (feature) {
                return feature.geometry && feature.geometry.type === "Point";
            });
            const clusterRequested = layerConfig.cluster === true;
            const canCluster = clusterRequested &&
                containsOnlyPoints &&
                typeof L.markerClusterGroup === "function";

            layerOpacityValues[layerConfig.id] = 1;
            initializeCategoryFilterState(layerConfig);

            const omittedValues = new Set();
            if (symbology.tipo === "valoresUnicos" && symbology.mostrarNoConfigurados === false) {
                geojsonData.features.forEach(function (feature) {
                    if (!shouldRenderFeature(feature, layerConfig)) {
                        omittedValues.add(normalizeUniqueValue(
                            (feature.properties || {})[symbology.campo]
                        ) || "(vacío)");
                    }
                });
                if (omittedValues.size > 0) {
                    console.info(
                        layerConfig.nombre + ": valores no configurados omitidos:",
                        Array.from(omittedValues).join(", ")
                    );
                }
            }

            if (clusterRequested && !containsOnlyPoints) {
                reportConfigIssue(
                    "cluster solo puede utilizarse con puntos en " + layerConfig.nombre + "."
                );
            } else if (clusterRequested && typeof L.markerClusterGroup !== "function") {
                reportConfigIssue("No fue posible iniciar el clustering de " + layerConfig.nombre + ".");
            }

            const geoJsonLayer = L.geoJSON(geojsonData, {
                interactive: layerIsInteractive,
                pane: paneName,
                filter: function (feature) {
                    return shouldRenderFeature(feature, layerConfig);
                },
                style: function (feature) {
                    return getFeatureStyle(feature, layerConfig);
                },
                pointToLayer: function (feature, latlng) {
                    const pointSymbolType = getPointSymbolType(layerConfig);
                    const pointStyle = getFeatureStyle(feature, layerConfig);

                    if (pointSymbolType === "circulo") {
                        return L.circleMarker(
                            latlng,
                            Object.assign(
                                { pane: paneName, interactive: layerIsInteractive },
                                pointStyle
                            )
                        );
                    }

                    if (pointSymbolType === "marcador") {
                        return L.marker(latlng, {
                            pane: paneName,
                            interactive: layerIsInteractive
                        });
                    }

                    const pointLayer = L.marker(latlng, {
                        pane: paneName,
                        interactive: layerIsInteractive,
                        icon: createPointSymbolIcon(pointStyle, pointSymbolType)
                    });

                    pointLayer._visorPointSymbolType = pointSymbolType;
                    return pointLayer;
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
            layerFeatureLayers[layerConfig.id] = [];
            geoJsonLayer.eachLayer(function (featureLayer) {
                layerFeatureLayers[layerConfig.id].push(featureLayer);
            });
            let leafletLayer = geoJsonLayer;

            if (canCluster) {
                const clusterLayer = L.markerClusterGroup({
                    chunkedLoading: true,
                    showCoverageOnHover: true,
                    zoomToBoundsOnClick: true,
                    spiderfyOnMaxZoom: true,
                    clusterPane: paneName
                });

                geoJsonLayer.eachLayer(function (featureLayer) {
                    clusterLayer.addLayer(featureLayer);
                });
                leafletLayer = clusterLayer;
            }

            loadedLayers[layerConfig.id] = leafletLayer;
            applyLayerCategoryFilter(layerConfig);

            if (typeof refreshOpenLayerMetadata === "function") {
                refreshOpenLayerMetadata(layerConfig);
            }

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

document.getElementById("close-feature-info").addEventListener("click", closeCurrentInfoPanel);

map.on("zoomend", updateAllLayerScaleVisibility);

appConfig.capas
    .filter(function (layerConfig) {
        return layerConfig.enabled !== false;
    })
    .forEach(loadGeoJsonLayer);

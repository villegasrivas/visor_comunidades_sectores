/* Interfaz generada desde la configuración del visor. */
/* Textos, herramientas y capas se personalizan en config.js. */
document.getElementById("viewer-title").textContent = appConfig.aplicacion.titulo;
document.getElementById("brand-main").textContent = appConfig.aplicacion.institucion;
document.getElementById("brand-secondary").textContent = appConfig.aplicacion.subtitulo;
document.title = appConfig.aplicacion.tituloNavegador;

const logoConfig = appConfig.aplicacion.logo;
const brandLogo = document.getElementById("brand-logo");
const brandLogoImage = document.getElementById("brand-logo-image");
const brandLogoFallback = document.getElementById("brand-logo-fallback");

function showLogoFallback() {
    brandLogoImage.hidden = true;
    brandLogoFallback.hidden = false;
}

if (!logoConfig || logoConfig.enabled === false) {
    brandLogo.hidden = true;
} else {
    brandLogoFallback.textContent = logoConfig.textoRespaldo || "";
    brandLogoImage.alt = logoConfig.textoAlternativo || "Logo institucional";
    brandLogoImage.addEventListener("load", function () {
        brandLogoImage.hidden = false;
        brandLogoFallback.hidden = true;
    });
    brandLogoImage.addEventListener("error", showLogoFallback);

    if (logoConfig.archivo) {
        brandLogoImage.src = logoConfig.archivo;
    } else {
        showLogoFallback();
    }
}

const basemapList = document.getElementById("basemap-list");
const layerGroupsList = document.getElementById("layer-groups-list");

function createLayerGroup(title) {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const options = document.createElement("div");

    section.className = "layer-group";
    heading.className = "layer-group-title";
    heading.textContent = title;
    section.appendChild(heading);
    section.appendChild(options);

    return { section: section, options: options };
}

const basemapGroup = createLayerGroup("Mapa base");

appConfig.mapasBase
    .filter(function (basemapConfig) {
        return basemapConfig.enabled !== false;
    })
    .forEach(function (basemapConfig) {
        const label = document.createElement("label");
        const radio = document.createElement("input");
        const text = document.createElement("span");

        label.className = "layer-option";
        radio.type = "radio";
        radio.name = "basemap";
        radio.value = basemapConfig.id;
        radio.checked = basemapConfig.id === activeBasemapId;
        text.textContent = basemapConfig.nombre;

        radio.addEventListener("change", function () {
            if (radio.checked) {
                setActiveBasemap(basemapConfig.id);
            }
        });

        label.appendChild(radio);
        label.appendChild(text);
        basemapGroup.options.appendChild(label);
    });

basemapList.appendChild(basemapGroup.section);

const layerMetadataPanel = document.getElementById("layer-metadata-panel");
const layerMetadataTitle = document.getElementById("layer-metadata-title");
const layerMetadataContent = document.getElementById("layer-metadata-content");
let activeMetadataLayerConfig = null;

function addMetadataRow(labelText, value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return;
    }

    const row = document.createElement("div");
    const label = document.createElement("span");
    const content = document.createElement("div");

    row.className = "layer-metadata-row";
    label.className = "layer-metadata-label";
    content.className = "layer-metadata-value";
    label.textContent = labelText;
    content.textContent = value;
    row.appendChild(label);
    row.appendChild(content);
    layerMetadataContent.appendChild(row);
}

function openLayerMetadata(layerConfig) {
    const metadata = layerConfig.metadata || {};
    const layerFeatures = typeof getLayerDataFeatures === "function"
        ? getLayerDataFeatures(layerConfig)
        : null;

    activeMetadataLayerConfig = layerConfig;
    layerMetadataTitle.textContent = layerConfig.nombre;
    layerMetadataContent.innerHTML = "";

    if (metadata.descripcion) {
        const description = document.createElement("p");
        description.className = "layer-metadata-description";
        description.textContent = metadata.descripcion;
        layerMetadataContent.appendChild(description);
    }

    addMetadataRow("Fuente", metadata.fuente);
    addMetadataRow("Institución responsable", metadata.institucion);
    addMetadataRow("Actualización", metadata.fechaActualizacion);
    addMetadataRow("Escala o precisión", metadata.escala);

    (metadata.camposAdicionales || []).forEach(function (fieldConfig) {
        addMetadataRow(fieldConfig.etiqueta || "Información", fieldConfig.valor);
    });

    (metadata.estadisticas || []).forEach(function (statisticConfig) {
        const value = layerFeatures === null
            ? "Calculando…"
            : calculateConfiguredStatistic(layerFeatures, statisticConfig);

        addMetadataRow(
            statisticConfig.etiqueta || statisticConfig.campo,
            value === null ? "Sin información" : value
        );
    });

    if (metadata.enlace) {
        const link = document.createElement("a");
        link.className = "layer-metadata-link";
        link.href = metadata.enlace;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Más información";
        layerMetadataContent.appendChild(link);
    }

    if (layerMetadataContent.children.length === 0) {
        layerMetadataContent.textContent = "No hay metadata registrada para esta capa.";
    }

    layerMetadataPanel.hidden = false;
}

function refreshOpenLayerMetadata(layerConfig) {
    if (
        activeMetadataLayerConfig &&
        activeMetadataLayerConfig.id === layerConfig.id &&
        !layerMetadataPanel.hidden
    ) {
        openLayerMetadata(layerConfig);
    }
}

function createMetadataButton(layerConfig) {
    const button = document.createElement("button");

    button.className = "layer-info-button";
    button.type = "button";
    button.textContent = "i";
    button.title = "Información de " + layerConfig.nombre;
    button.setAttribute("aria-label", "Información de " + layerConfig.nombre);
    button.addEventListener("click", function () {
        openLayerMetadata(layerConfig);
    });

    return button;
}

document.getElementById("close-layer-metadata").addEventListener("click", function () {
    layerMetadataPanel.hidden = true;
    activeMetadataLayerConfig = null;
});

function createCategoryFilter(layerConfig) {
    const symbology = layerConfig.simbologia || {};
    const filterConfig = symbology.filtroCategorias || {};
    const categoryInfoConfig = layerConfig.infoCategorias || {};
    const filteringEnabled = filterConfig.enabled === true;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const options = document.createElement("div");

    details.id = "category-filter-" + layerConfig.id;
    details.className = "layer-category-filter";
    details.open = filteringEnabled
        ? filterConfig.abiertoInicial !== false
        : categoryInfoConfig.abiertoInicial !== false;
    summary.textContent = filteringEnabled ? "Filtrar categorías" : "Información por categoría";
    options.className = "layer-category-options";
    details.appendChild(summary);

    if (filteringEnabled && filterConfig.mostrarTodas !== false) {
        const actions = document.createElement("div");
        const showAll = document.createElement("button");
        const hideAll = document.createElement("button");

        actions.className = "layer-category-actions";
        showAll.type = "button";
        showAll.textContent = "Todas";
        hideAll.type = "button";
        hideAll.textContent = "Ninguna";
        showAll.addEventListener("click", function () {
            setAllLayerCategoriesVisibility(layerConfig, true);
        });
        hideAll.addEventListener("click", function () {
            setAllLayerCategoriesVisibility(layerConfig, false);
        });
        actions.appendChild(showAll);
        actions.appendChild(hideAll);
        options.appendChild(actions);
    }

    (symbology.categorias || []).forEach(function (category, index) {
        const row = document.createElement("div");

        row.className = "layer-category-row";

        if (filteringEnabled) {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            const text = document.createElement("span");

            label.className = "layer-category-option";
            checkbox.type = "checkbox";
            checkbox.id = "category-" + layerConfig.id + "-" + index;
            checkbox.checked = category.visibleInicial !== false;
            text.textContent = category.etiqueta || String(category.valor);
            checkbox.addEventListener("change", function () {
                setLayerCategoryVisibility(layerConfig, category.valor, checkbox.checked);
            });
            label.appendChild(checkbox);
            label.appendChild(text);
            row.appendChild(label);
        } else {
            const name = document.createElement("span");

            name.className = "layer-category-name";
            name.textContent = category.etiqueta || String(category.valor);
            row.appendChild(name);
        }

        if (categoryInfoConfig.enabled === true) {
            const infoButton = document.createElement("button");
            const categoryName = category.etiqueta || String(category.valor);

            infoButton.className = "layer-category-info-button";
            infoButton.type = "button";
            infoButton.textContent = "i";
            infoButton.title = "Información de " + categoryName;
            infoButton.setAttribute("aria-label", "Información de " + categoryName);
            infoButton.addEventListener("click", function () {
                openCategoryInfoPanel(layerConfig, category);
            });
            row.appendChild(infoButton);
        }

        options.appendChild(row);
    });

    if (
        symbology.mostrarNoConfigurados !== false &&
        symbology.mostrarDefaultEnLeyenda !== false
    ) {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        const text = document.createElement("span");

        label.className = "layer-category-option";
        checkbox.type = "checkbox";
        checkbox.id = "category-" + layerConfig.id + "-default";
        checkbox.checked = symbology.visibleDefaultInicial !== false;
        text.textContent = symbology.etiquetaDefault || "Otros valores";
        checkbox.addEventListener("change", function () {
            setLayerDefaultCategoryVisibility(layerConfig, checkbox.checked);
        });
        label.appendChild(checkbox);
        label.appendChild(text);
        options.appendChild(label);
    }

    details.appendChild(options);
    return details;
}

appConfig.gruposCapas
    .filter(function (groupConfig) {
        return groupConfig.enabled !== false;
    })
    .forEach(function (groupConfig) {
        const groupLayers = appConfig.capas.filter(function (layerConfig) {
            return layerConfig.enabled !== false &&
                layerConfig.grupo === groupConfig.id;
        });

        if (groupLayers.length === 0) {
            return;
        }

        const layerGroup = createLayerGroup(groupConfig.nombre);

        groupLayers.forEach(function (layerConfig) {
            const control = document.createElement("div");
            const optionRow = document.createElement("div");
            let checkbox = null;

            control.className = "layer-control";
            control.id = "layer-control-" + layerConfig.id;
            optionRow.className = "layer-option-row";

            if (layerConfig.estructural === true) {
                const structuralName = document.createElement("span");

                structuralName.className = "layer-option layer-option-static";
                structuralName.textContent = layerConfig.nombre;
                optionRow.appendChild(structuralName);
            } else {
                const label = document.createElement("label");
                const text = document.createElement("span");

                checkbox = document.createElement("input");
                label.className = "layer-option";
                checkbox.type = "checkbox";
                checkbox.id = "layer-" + layerConfig.id;
                checkbox.checked = layerConfig.visibleInicial === true;
                text.textContent = layerConfig.nombre;
                label.appendChild(checkbox);
                label.appendChild(text);
                optionRow.appendChild(label);
            }

            if (layerConfig.metadata && layerConfig.metadata.enabled === true) {
                optionRow.appendChild(createMetadataButton(layerConfig));
            }

            control.appendChild(optionRow);

            if (layerConfig.opacityControl === true && checkbox) {
                const opacityRow = document.createElement("div");
                const opacityLabel = document.createElement("label");
                const opacityInput = document.createElement("input");
                const opacityValue = document.createElement("output");

                opacityRow.className = "layer-opacity";
                opacityLabel.textContent = "Opacidad";
                opacityLabel.htmlFor = "opacity-" + layerConfig.id;
                opacityInput.id = "opacity-" + layerConfig.id;
                opacityInput.type = "range";
                opacityInput.min = "0";
                opacityInput.max = "100";
                opacityInput.value = "100";
                opacityInput.disabled = !checkbox.checked;
                opacityInput.setAttribute("aria-label", "Opacidad de " + layerConfig.nombre);
                opacityValue.id = "opacity-value-" + layerConfig.id;
                opacityValue.value = "100%";
                opacityValue.textContent = "100%";

                opacityRow.appendChild(opacityLabel);
                opacityRow.appendChild(opacityInput);
                opacityRow.appendChild(opacityValue);
                control.appendChild(opacityRow);
            }

            if (
                checkbox &&
                layerConfig.simbologia &&
                layerConfig.simbologia.tipo === "valoresUnicos" &&
                (
                    (
                        layerConfig.simbologia.filtroCategorias &&
                        layerConfig.simbologia.filtroCategorias.enabled === true
                    ) ||
                    (layerConfig.infoCategorias && layerConfig.infoCategorias.enabled === true)
                )
            ) {
                control.appendChild(createCategoryFilter(layerConfig));
            }

            if (layerConfig.minZoom != null || layerConfig.maxZoom != null) {
                const scaleStatus = document.createElement("div");
                const minimum = layerConfig.minZoom;
                const maximum = layerConfig.maxZoom;

                scaleStatus.id = "scale-status-" + layerConfig.id;
                scaleStatus.className = "layer-scale-status";

                if (minimum != null && maximum != null) {
                    scaleStatus.textContent = "Visible en zoom " + minimum + "–" + maximum;
                } else if (minimum != null) {
                    scaleStatus.textContent = "Visible desde zoom " + minimum;
                } else {
                    scaleStatus.textContent = "Visible hasta zoom " + maximum;
                }

                control.appendChild(scaleStatus);
            }

            layerGroup.options.appendChild(control);
        });

        layerGroupsList.appendChild(layerGroup.section);
    });

const legendContent = document.getElementById("legend-content");
const legendList = document.getElementById("legend-list");
const legendToggle = document.getElementById("legend-toggle");
const legendUiConfig = appConfig.herramientas.leyenda || {};

function setLegendCollapsed(collapsed) {
    legendContent.classList.toggle("map-legend-collapsed", collapsed);
    legendToggle.title = collapsed ? "Mostrar leyenda" : "Ocultar leyenda";
    legendToggle.setAttribute("aria-label", legendToggle.title);
    legendToggle.setAttribute("aria-expanded", String(!collapsed));
}

legendToggle.hidden = legendUiConfig.plegable === false;
setLegendCollapsed(legendUiConfig.colapsadaInicial === true);
legendToggle.addEventListener("click", function (event) {
    event.stopPropagation();
    setLegendCollapsed(!legendContent.classList.contains("map-legend-collapsed"));
});

/* La muestra usa la geometría real y separa la opacidad del borde y del relleno. */
function createLegendSymbol(entry, geometry) {
    const symbol = document.createElement("span");
    const style = entry.estilo || {};

    symbol.className = "legend-symbol";
    symbol.setAttribute("aria-hidden", "true");

    if (geometry.tipo === "marcador") {
        const icon = geometry.icono.createIcon();
        icon.className = "legend-marker-icon";
        icon.removeAttribute("style");
        icon.setAttribute("alt", "");
        symbol.appendChild(icon);
    } else if (entry.halo) {
        symbol.classList.add("legend-symbol-structural");
        symbol.style.setProperty("--legend-line-color", style.color || "#17365d");
        symbol.style.setProperty("--legend-halo-color", entry.halo.color || "#ffffff");
    } else {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const pointShape = geometry.forma || "circulo";
        const shapeTag = geometry.tipo === "punto" && pointShape === "circulo"
            ? "circle"
            : geometry.tipo === "punto" && pointShape === "cuadrado"
                ? "rect"
                : "path";
        const shape = document.createElementNS("http://www.w3.org/2000/svg", shapeTag);
        const color = style.color || "#3388ff";

        svg.setAttribute("viewBox", "0 0 28 20");
        svg.classList.add("legend-vector-symbol");
        if (geometry.tipo === "punto") {
            if (pointShape === "circulo") {
                shape.setAttribute("cx", "14");
                shape.setAttribute("cy", "10");
                shape.setAttribute("r", "6");
            } else if (pointShape === "cuadrado") {
                shape.setAttribute("x", "8");
                shape.setAttribute("y", "4");
                shape.setAttribute("width", "12");
                shape.setAttribute("height", "12");
                shape.setAttribute("rx", "1");
            } else {
                shape.setAttribute("d", pointShape === "triangulo"
                    ? "M 14 3 L 21 16 L 7 16 Z"
                    : "M 11 3 H 17 V 7 H 22 V 13 H 17 V 17 H 11 V 13 H 6 V 7 H 11 Z");
            }
        } else {
            shape.setAttribute("d", geometry.tipo === "linea"
                ? "M 3 14 L 25 6" : "M 3 4 H 25 V 16 H 3 Z");
        }
        shape.setAttribute("stroke", style.stroke === false ? "none" : color);
        shape.setAttribute("stroke-width", Math.min(style.weight ?? 3, 6));
        shape.setAttribute("stroke-opacity", style.opacity ?? 1);
        shape.setAttribute("stroke-linecap", style.lineCap || "round");
        shape.setAttribute("stroke-linejoin", style.lineJoin || "round");
        if (style.dashArray) {
            shape.setAttribute("stroke-dasharray", String(style.dashArray));
        }
        const hasFill = geometry.tipo !== "linea" && style.fill !== false;
        shape.setAttribute("fill", hasFill ? style.fillColor || color : "none");
        shape.setAttribute("fill-opacity", style.fillOpacity ?? 0.2);
        svg.appendChild(shape);
        symbol.appendChild(svg);
    }
    return symbol;
}

function createLegendItem(entry, geometries) {
    const item = document.createElement("div");
    const symbols = document.createElement("span");
    const label = document.createElement("span");

    item.className = "legend-item";
    symbols.className = "legend-symbols";
    label.className = "legend-label";
    geometries.forEach(function (geometry) {
        symbols.appendChild(createLegendSymbol(entry, geometry));
    });
    label.textContent = entry.etiqueta;

    item.appendChild(symbols);
    item.appendChild(label);
    return item;
}

function updateLegend() {
    legendList.innerHTML = "";

    appConfig.capas.forEach(function (layerConfig) {
        const legendConfig = layerConfig.leyenda;
        const leafletLayer = loadedLayers[layerConfig.id];

        if (
            layerConfig.enabled === false ||
            !legendConfig ||
            legendConfig.enabled === false ||
            !leafletLayer ||
            !map.hasLayer(leafletLayer)
        ) {
            return;
        }

        const geometries = layerLegendSymbols[layerConfig.id] || [];
        if (geometries.length === 0) {
            return;
        }
        const vectorGeometry = geometries.find(function (geometry) {
            return geometry.tipo !== "marcador";
        });
        const entries = getLegendEntries(
            layerConfig,
            vectorGeometry ? vectorGeometry.tipo : geometries[0].tipo
        );
        if (entries.length === 0) {
            return;
        }
        const layerLegend = document.createElement("div");

        layerLegend.className = "legend-layer";

        if (
            layerConfig.simbologia.tipo === "valoresUnicos" ||
            layerConfig.simbologia.tipo === "graduados"
        ) {
            const title = document.createElement("div");
            title.className = "legend-layer-title";
            title.textContent = legendConfig.titulo || layerConfig.nombre;
            layerLegend.appendChild(title);
        }

        entries.forEach(function (entry) {
            layerLegend.appendChild(createLegendItem(entry, geometries));
        });

        legendList.appendChild(layerLegend);
    });

    legendContent.hidden = legendList.children.length === 0;
}

const searchConfig = appConfig.herramientas.busqueda;
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

if (!searchConfig || searchConfig.enabled === false) {
    searchInput.parentElement.style.display = "none";
    searchResults.style.display = "none";
}

function clearSearchResults() {
    searchResults.innerHTML = "";
    searchResults.classList.remove("search-results-visible");
}

function performSearch(searchText) {
    clearSearchResults();

    if (typeof clearMapSelection === "function") {
        clearMapSelection();
    }

    const normalizedSearch = searchText.trim().toLocaleLowerCase("es");
    const minimumLength = searchConfig.minimoCaracteres || 2;

    if (normalizedSearch.length < minimumLength) {
        return;
    }

    const matches = [];

    appConfig.capas.forEach(function (layerConfig) {
        const layerSearch = layerConfig.busqueda;
        const leafletLayer = loadedLayers[layerConfig.id];

        if (
            layerConfig.enabled === false ||
            !layerSearch ||
            layerSearch.enabled === false ||
            !leafletLayer ||
            (searchConfig.soloCapasVisibles && !map.hasLayer(leafletLayer))
        ) {
            return;
        }

        leafletLayer.eachLayer(function (featureLayer) {
            const properties = featureLayer.feature && featureLayer.feature.properties;

            if (!properties) {
                return;
            }

            const mainValue = properties[layerSearch.campoPrincipal];

            if (mainValue === null || mainValue === undefined || String(mainValue).trim() === "") {
                return;
            }

            const searchableValues = [mainValue];

            (layerSearch.campos || []).forEach(function (fieldName) {
                const fieldValue = properties[fieldName];

                if (fieldValue !== null && fieldValue !== undefined) {
                    searchableValues.push(fieldValue);
                }
            });

            const searchableText = searchableValues.join(" ").toLocaleLowerCase("es");

            if (searchableText.includes(normalizedSearch)) {
                matches.push({
                    titulo: String(mainValue),
                    capa: layerConfig.nombre,
                    featureLayer: featureLayer,
                    layerConfig: layerConfig
                });
            }
        });
    });

    if (matches.length === 0) {
        const noResults = document.createElement("div");
        noResults.className = "search-result-item";
        noResults.textContent = "Sin resultados";
        searchResults.appendChild(noResults);
    } else {
        matches.slice(0, searchConfig.maxResultados || 10).forEach(function (match) {
            const button = document.createElement("button");
            const title = document.createElement("span");
            const layerName = document.createElement("span");

            button.type = "button";
            button.className = "search-result-item";
            title.className = "search-result-title";
            layerName.className = "search-result-layer";
            title.textContent = match.titulo;
            layerName.textContent = match.capa;

            button.appendChild(title);
            button.appendChild(layerName);
            button.addEventListener("click", function () {
                selectMapFeature(match.featureLayer, match.layerConfig, {
                    center: searchConfig.centrarResultado === true,
                    highlight: searchConfig.resaltarResultado === true,
                    popup: searchConfig.abrirPopup === true,
                    resultMode:
                        match.layerConfig.busqueda.modoResultado ||
                        (match.layerConfig.busqueda.aislarResultado === true ? "aislar" : "resaltar")
                });
                clearSearchResults();
            });

            searchResults.appendChild(button);
        });
    }

    searchResults.classList.add("search-results-visible");
}

if (searchConfig && searchConfig.enabled !== false) {
    searchInput.addEventListener("input", function () {
        performSearch(searchInput.value);
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest(".search-container") && !event.target.closest(".search-results")) {
            clearSearchResults();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            clearSearchResults();
        }
    });
}

const measurementConfig = appConfig.herramientas.medicion;
const measurementButton = document.getElementById("measurement-button");

if (!measurementConfig || measurementConfig.enabled === false) {
    measurementButton.style.display = "none";
}

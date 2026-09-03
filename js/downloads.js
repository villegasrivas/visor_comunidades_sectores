/* Catálogo de PDF y KML preparados previamente; no exporta la vista actual. */
const downloadsConfig = appConfig.herramientas.descargas;
const downloadsButton = document.getElementById("downloads-button");
let downloadsPanel = null;

function resolveDownloadFile(fileConfig, baseUri) {
    if (!fileConfig || typeof fileConfig.archivo !== "string" || !fileConfig.archivo.trim()) {
        return null;
    }
    try {
        const root = new URL("descargas/", baseUri);
        const url = new URL(fileConfig.archivo.trim().replace(/\\/g, "/"), baseUri);
        const decodedPath = decodeURIComponent(url.pathname);
        const extension = decodedPath.match(/\.(pdf|kml)$/i);
        if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname) ||
            url.username || url.password || url.search || url.hash || !extension ||
            decodedPath.split("/").some(function (part) { return part === ".." || part === "."; })) {
            return null;
        }
        return {
            url: url.href,
            nombre: decodedPath.split("/").pop(),
            formato: extension[1].toUpperCase()
        };
    } catch (error) {
        return null;
    }
}

async function downloadPreparedFile(file, button, status) {
    if (button.disabled) {
        return;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    status.classList.remove("download-error");
    status.textContent = "Preparando descarga…";
    try {
        const response = await fetch(file.url, { cache: "no-store" });
        if (!response.ok || (response.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
            throw new Error("Archivo no disponible");
        }
        const blob = await response.blob();
        if (blob.size === 0) {
            throw new Error("Archivo vacío");
        }
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = file.nombre;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Da tiempo al navegador para iniciar el guardado antes de liberar el archivo.
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 60000);
        status.textContent = "Descarga iniciada. Revisa las descargas de tu navegador.";
    } catch (error) {
        status.classList.add("download-error");
        status.textContent = "No se pudo descargar el archivo. Puede no estar disponible; intenta nuevamente o contacta a la institución.";
    } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
    }
}

function createDownloadCard(fileConfig) {
    const file = resolveDownloadFile(fileConfig, document.baseURI);
    const card = document.createElement("article");
    const heading = document.createElement("div");
    const badge = document.createElement("span");
    const title = document.createElement("h3");
    const button = document.createElement("button");
    const status = document.createElement("p");
    card.className = "download-card";
    heading.className = "download-card-heading";
    badge.className = "download-format";
    badge.textContent = file ? file.formato : "Archivo";
    title.textContent = fileConfig.titulo || (file ? file.nombre : "Archivo sin configurar");
    heading.appendChild(badge);
    heading.appendChild(title);
    card.appendChild(heading);

    if (fileConfig.descripcion) {
        const description = document.createElement("p");
        description.className = "download-description";
        description.textContent = fileConfig.descripcion;
        card.appendChild(description);
    }
    if (fileConfig.fechaActualizacion) {
        const date = document.createElement("p");
        date.className = "download-date";
        date.textContent = "Actualización: " + fileConfig.fechaActualizacion;
        card.appendChild(date);
    }

    button.className = "download-action";
    button.type = "button";
    button.textContent = file ? "Descargar " + file.formato + " ⇩" : "No disponible";
    button.setAttribute("aria-label", "Descargar " + title.textContent + (file ? " (" + file.formato + ")" : ""));
    status.className = "download-status";
    status.setAttribute("role", "status");
    if (file) {
        button.addEventListener("click", function () { downloadPreparedFile(file, button, status); });
    } else {
        button.disabled = true;
        status.textContent = "La ruta debe corresponder a un PDF o KML dentro de descargas/.";
        status.classList.add("download-error");
    }
    card.appendChild(button);
    card.appendChild(status);
    return card;
}

function closeDownloadsPanel() {
    if (!downloadsPanel) {
        return;
    }
    downloadsPanel.hidden = true;
    downloadsButton.classList.remove("tool-button-active");
    downloadsButton.setAttribute("aria-expanded", "false");
}

function openDownloadsPanel() {
    if (typeof closeGoogleMapsTool === "function") {
        closeGoogleMapsTool();
    }
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
    closeFeatureInfoPanel();
    downloadsPanel.hidden = false;
    downloadsButton.classList.add("tool-button-active");
    downloadsButton.setAttribute("aria-expanded", "true");
}

function initializeDownloadsTool() {
    if (!downloadsConfig || downloadsConfig.enabled === false) {
        downloadsButton.hidden = true;
        return;
    }
    downloadsPanel = document.createElement("section");
    downloadsPanel.id = "downloads-panel";
    downloadsPanel.className = "downloads-panel";
    downloadsPanel.setAttribute("aria-label", "Descargas");
    downloadsPanel.hidden = true;
    downloadsPanel.innerHTML =
        '<div class="downloads-header"><span>Descargas</span>' +
        '<button id="downloads-close" type="button" title="Cerrar descargas" aria-label="Cerrar descargas">×</button></div>' +
        '<div id="downloads-content" class="downloads-content">' +
        '<p class="downloads-intro">Documentos y capas preparados para descarga. No reflejan necesariamente la vista actual del mapa.</p>' +
        '<div id="downloads-list"></div></div>';
    document.getElementById("map").appendChild(downloadsPanel);
    const list = document.getElementById("downloads-list");
    const files = Array.isArray(downloadsConfig.archivos) ? downloadsConfig.archivos : [];
    files.filter(function (file) { return file && file.enabled !== false; }).forEach(function (file) {
        list.appendChild(createDownloadCard(file));
    });
    if (list.children.length === 0) {
        const empty = document.createElement("p");
        empty.className = "downloads-empty";
        empty.textContent = "No hay archivos publicados para descargar.";
        list.appendChild(empty);
    }
    L.DomEvent.disableClickPropagation(downloadsPanel);
    L.DomEvent.disableScrollPropagation(downloadsPanel);
    downloadsButton.addEventListener("click", function () {
        if (downloadsPanel.hidden) openDownloadsPanel();
        else closeDownloadsPanel();
    });
    document.getElementById("downloads-close").addEventListener("click", function () {
        closeDownloadsPanel();
        downloadsButton.focus();
    });
    document.querySelector(".map-tools").addEventListener("click", function (event) {
        const button = event.target.closest("button");
        if (button && button !== downloadsButton) closeDownloadsPanel();
    }, true);
    document.getElementById("open-layers-panel").addEventListener("click", closeDownloadsPanel);
    document.getElementById("search-input").addEventListener("focus", closeDownloadsPanel);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !downloadsPanel.hidden) {
            closeDownloadsPanel();
            downloadsButton.focus();
        }
    });
}

initializeDownloadsTool();

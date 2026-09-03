/* Conversión WGS84 y visualización de coordenadas del mapa. */
const cursorCoordinatesConfig = appConfig.herramientas.coordenadasCursor;
const coordinatesDisplay = document.getElementById("map-coordinates");

function latLngToUtm(latitude, longitude, zone) {
    const semiMajorAxis = 6378137;
    const flattening = 1 / 298.257223563;
    const scaleFactor = 0.9996;
    const eccentricitySquared = flattening * (2 - flattening);
    const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
    const latitudeRadians = latitude * Math.PI / 180;
    const longitudeRadians = longitude * Math.PI / 180;
    const centralMeridian = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const sinLatitude = Math.sin(latitudeRadians);
    const cosLatitude = Math.cos(latitudeRadians);
    const tangentLatitude = Math.tan(latitudeRadians);
    const radius = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
    const tangentTerm = tangentLatitude ** 2;
    const eccentricityTerm = secondEccentricitySquared * cosLatitude ** 2;
    const longitudeTerm = cosLatitude * (longitudeRadians - centralMeridian);
    const meridionalArc = semiMajorAxis * (
        (1 - eccentricitySquared / 4 - 3 * eccentricitySquared ** 2 / 64 - 5 * eccentricitySquared ** 3 / 256) * latitudeRadians -
        (3 * eccentricitySquared / 8 + 3 * eccentricitySquared ** 2 / 32 + 45 * eccentricitySquared ** 3 / 1024) * Math.sin(2 * latitudeRadians) +
        (15 * eccentricitySquared ** 2 / 256 + 45 * eccentricitySquared ** 3 / 1024) * Math.sin(4 * latitudeRadians) -
        (35 * eccentricitySquared ** 3 / 3072) * Math.sin(6 * latitudeRadians)
    );

    const easting = 500000 + scaleFactor * radius * (
        longitudeTerm +
        (1 - tangentTerm + eccentricityTerm) * longitudeTerm ** 3 / 6 +
        (5 - 18 * tangentTerm + tangentTerm ** 2 + 72 * eccentricityTerm - 58 * secondEccentricitySquared) * longitudeTerm ** 5 / 120
    );
    let northing = scaleFactor * (
        meridionalArc +
        radius * tangentLatitude * (
            longitudeTerm ** 2 / 2 +
            (5 - tangentTerm + 9 * eccentricityTerm + 4 * eccentricityTerm ** 2) * longitudeTerm ** 4 / 24 +
            (61 - 58 * tangentTerm + tangentTerm ** 2 + 600 * eccentricityTerm - 330 * secondEccentricitySquared) * longitudeTerm ** 6 / 720
        )
    );

    if (latitude < 0) {
        northing += 10000000;
    }

    return { easting: easting, northing: northing };
}

function utmToLatLng(easting, northing, zone, hemisphere) {
    const semiMajorAxis = 6378137;
    const flattening = 1 / 298.257223563;
    const scaleFactor = 0.9996;
    const eccentricitySquared = flattening * (2 - flattening);
    const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
    const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));
    const x = easting - 500000;
    const y = String(hemisphere).toUpperCase() === "S" ? northing - 10000000 : northing;
    const meridionalArc = y / scaleFactor;
    const mu = meridionalArc / (
        semiMajorAxis * (1 - eccentricitySquared / 4 - 3 * eccentricitySquared ** 2 / 64 - 5 * eccentricitySquared ** 3 / 256)
    );
    const footprintLatitude =
        mu +
        (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
        (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
        (151 * e1 ** 3 / 96) * Math.sin(6 * mu) +
        (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const sinFootprint = Math.sin(footprintLatitude);
    const cosFootprint = Math.cos(footprintLatitude);
    const tangentFootprint = Math.tan(footprintLatitude);
    const radius = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2);
    const meridionalRadius = semiMajorAxis * (1 - eccentricitySquared) /
        (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5;
    const tangentTerm = tangentFootprint ** 2;
    const eccentricityTerm = secondEccentricitySquared * cosFootprint ** 2;
    const d = x / (radius * scaleFactor);
    const latitude = footprintLatitude -
        (radius * tangentFootprint / meridionalRadius) * (
            d ** 2 / 2 -
            (5 + 3 * tangentTerm + 10 * eccentricityTerm - 4 * eccentricityTerm ** 2 - 9 * secondEccentricitySquared) * d ** 4 / 24 +
            (61 + 90 * tangentTerm + 298 * eccentricityTerm + 45 * tangentTerm ** 2 - 252 * secondEccentricitySquared - 3 * eccentricityTerm ** 2) * d ** 6 / 720
        );
    const centralMeridian = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const longitude = centralMeridian + (
        d -
        (1 + 2 * tangentTerm + eccentricityTerm) * d ** 3 / 6 +
        (5 - 2 * eccentricityTerm + 28 * tangentTerm - 3 * eccentricityTerm ** 2 + 8 * secondEccentricitySquared + 24 * tangentTerm ** 2) * d ** 5 / 120
    ) / cosFootprint;

    return {
        lat: latitude * 180 / Math.PI,
        lng: longitude * 180 / Math.PI
    };
}

function formatCoordinateNumber(value, decimals) {
    return value.toLocaleString("es-CL", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function updateCoordinatesDisplay(latlng) {
    if (!cursorCoordinatesConfig || cursorCoordinatesConfig.enabled === false) {
        return;
    }

    const lines = [];
    const geographicConfig = cursorCoordinatesConfig.geograficas || {};
    const utmConfig = cursorCoordinatesConfig.utm || {};

    if (geographicConfig.enabled !== false) {
        const decimals = geographicConfig.decimales ?? 6;
        lines.push(
            "WGS84 · Lat " + formatCoordinateNumber(latlng.lat, decimals) +
            " · Lon " + formatCoordinateNumber(latlng.lng, decimals)
        );
    }

    if (utmConfig.enabled === true) {
        const zone = Number(utmConfig.zona);
        const decimals = utmConfig.decimales ?? 0;
        const utm = latLngToUtm(latlng.lat, latlng.lng, zone);

        lines.push(
            "UTM " + zone + String(utmConfig.hemisferio || "S").toUpperCase() +
            " · E " + formatCoordinateNumber(utm.easting, decimals) +
            " · N " + formatCoordinateNumber(utm.northing, decimals)
        );
    }

    coordinatesDisplay.innerHTML = lines.map(function (line) {
        return "<span>" + line + "</span>";
    }).join("");
}

if (!cursorCoordinatesConfig || cursorCoordinatesConfig.enabled === false) {
    coordinatesDisplay.hidden = true;
} else {
    updateCoordinatesDisplay(map.getCenter());
    map.on("mousemove", function (event) {
        updateCoordinatesDisplay(event.latlng);
    });
    map.on("click", function (event) {
        updateCoordinatesDisplay(event.latlng);
    });
}

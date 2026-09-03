/* Geolocalización del usuario. */
const geolocationConfig = appConfig.herramientas.geolocalizacion;
const geolocationButton = document.getElementById("geolocation-button");
let userLocationMarker = null;
let userAccuracyCircle = null;

if (!geolocationConfig || geolocationConfig.enabled === false) {
    geolocationButton.style.display = "none";
}

function showUserLocation(latitude, longitude, accuracy) {
    const userLatLng = [latitude, longitude];

    map.setView(userLatLng, geolocationConfig.zoom || 17);

    if (userLocationMarker) {
        userLocationMarker.setLatLng(userLatLng);

        if (!map.hasLayer(userLocationMarker)) {
            userLocationMarker.addTo(map);
        }
    } else {
        userLocationMarker = L.marker(userLatLng)
            .addTo(map)
            .bindPopup("Ubicación actual");
    }

    if (userAccuracyCircle) {
        userAccuracyCircle.setLatLng(userLatLng);
        userAccuracyCircle.setRadius(accuracy);

        if (!map.hasLayer(userAccuracyCircle)) {
            userAccuracyCircle.addTo(map);
        }
    } else {
        userAccuracyCircle = L.circle(userLatLng, { radius: accuracy }).addTo(map);
    }

    userLocationMarker.openPopup();
}

function requestUserLocation() {
    if (!navigator.geolocation) {
        alert("Este navegador no permite utilizar geolocalización.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (position) {
            showUserLocation(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy
            );
        },
        function (error) {
            const messages = {
                1: "El permiso de ubicación fue rechazado.",
                2: "La ubicación no está disponible.",
                3: "La solicitud de ubicación excedió el tiempo de espera."
            };

            alert(messages[error.code] || "No fue posible obtener la ubicación.");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

if (geolocationConfig && geolocationConfig.enabled !== false) {
    geolocationButton.addEventListener("click", requestUserLocation);
}

map.on("click", function () {
    if (userLocationMarker && map.hasLayer(userLocationMarker)) {
        map.removeLayer(userLocationMarker);
    }

    if (userAccuracyCircle && map.hasLayer(userAccuracyCircle)) {
        map.removeLayer(userAccuracyCircle);
    }
});

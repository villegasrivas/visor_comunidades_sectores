/* Configuración central: personalice este archivo para crear un visor nuevo. */
const appConfig = {
    version: 1,

    desarrollo: {
        validarConfiguracion: true          // Muestra advertencias útiles durante la edición.
    },

    /* Identidad y textos visibles de la aplicación. */
    aplicacion: {
        titulo: "COMUNIDADES Y SECTORES RURALES",
        tituloNavegador: "Sectores Rurales - Municipalidad de Nueva Imperial",
        institucion: "Municipalidad de Nueva Imperial",
        subtitulo: "Departamento SIG-SECPLAN",
        
        logo: {
            enabled: true,                 // Oculta o muestra el logo completo.
            archivo: "images/muni3.png",
            textoAlternativo: "Logo de la Municipalidad de Nueva Imperial",
            textoRespaldo: "MNI"           // Se muestra si la imagen no carga.
        }
    },

    /* Vista de inicio y límites de navegación. */
    mapa: {
        vistaInicial: {
            tipo: "capa",                 // "capa" o "centro".
            capaId: "limiteComunal",      // Se usa cuando tipo es "capa".
            centro: [-38.74, -72.95],      // Respaldo o vista de tipo "centro".
            zoom: 11,
            padding: [20, 20]
        },
        zoomMin: 8,
        zoomMax: 19
    },

    /* Fuentes cartográficas de fondo; solo una queda activa. */
    mapasBase: [
        {
            id: "osm",
            nombre: "OpenStreetMap",
            enabled: true,
            visibleInicial: true,
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            opciones: {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
        },
        {
            id: "satelite",
            nombre: "Satélite",
            enabled: true,
            visibleInicial: false,
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            opciones: {
                maxZoom: 19,
                attribution: "Tiles &copy; Esri"
            }
        }
    ],

    /* Opciones generales de las herramientas del visor. */
    herramientas: {
        busqueda: {
            enabled: true,                 // Muestra u oculta el buscador.
            minimoCaracteres: 2,
            maxResultados: 10,
            soloCapasVisibles: true,       // Ignora capas apagadas al buscar.
            centrarResultado: true,
            resaltarResultado: true,
            abrirPopup: true
        },
        geolocalizacion: {
            enabled: false,
            zoom: 17
        },

        coordenadasCursor: {
            enabled: true,
            geograficas: {
                enabled: true,
                decimales: 6
            },
            utm: {
                enabled: true,
                zona: 18,
                hemisferio: "S",
                decimales: 0
            }
        },

        buscarCoordenadas: {
            enabled: false,
            geograficas: true,
            utm: true,
            zonaUtm: 18,
            hemisferioUtm: "S",
            zoom: 17,
            mostrarMarcador: true,
            estiloMarcador: {
                radius: 7,
                color: "#ffffff",
                weight: 2,
                fillColor: "#e47b25",
                fillOpacity: 1
            }
        },
        
        googleMaps: {
            enabled: false,                 // Muestra u oculta la herramienta Cómo llegar.
            modoViaje: "driving"           // driving: auto; walking: a pie; bicycling: bicicleta; transit: transporte público.
        },

        descargas: {
            enabled: false,                 // Muestra u oculta el panel de descargas.
            archivos: [                   // Copie un ejemplo y quite los // para publicarlo.
                {
                     enabled: true,      // Permite retirar un archivo sin borrar su configuración.
                     titulo: "Mapa general",
                     descripcion: "Mapa preparado para impresión.",
                     fechaActualizacion: "AAAA-MM-DD",
                     archivo: "descargas/mapas/PROY.pdf"
                },
                {
                     enabled: true,
                     titulo: "Capa para Google Earth",
                     descripcion: "Información espacial para descarga.",
                     fechaActualizacion: "AAAA-MM-DD",
                     archivo: "descargas/capas/comunidades.kml"
                 }
            ]
        },

        medicion: {
            enabled: true,                 // Muestra u oculta toda la herramienta.
            distancia: true,
            superficie: true,
            estilo: {
                color: "#e47b25",
                weight: 3,
                fillColor: "#e47b25",
                fillOpacity: 0.18
            }
        }
    },

    /* Organiza visualmente las capas en el panel lateral. */
    gruposCapas: [
        {
            id: "referencia",
            nombre: "Capas de referencia",
            enabled: true
        },
        {
            id: "tematicas",
            nombre: "Capas temáticas",
            enabled: true
        }
    ],

    /* Capas GeoJSON y comportamiento particular de cada una. */
    capas: [
        {
            id: "limiteComunal",
            nombre: "Límite comunal",
            enabled: true,                       // Incluye o elimina la capa estructural.
            grupo: "referencia",
            archivo: "data/limite_comunal.geojson",
            estructural: true,                    // Siempre visible; se controla con enabled.
            interactive: false,                  // Permite interacción con las entidades.
            opacityControl: false,               // Muestra el control de transparencia.
            cluster: false,                      // Agrupa puntos cercanos.
            minZoom: null,                       // Zoom mínimo visible; null sin límite.
            maxZoom: null,                       // Zoom máximo visible; null sin límite.

            metadata: {
                enabled: false,                   // Muestra el ícono de información de la capa.
                fuente: "",
                institucion: "",
                fechaActualizacion: "",
                escala: "",
                descripcion: "Límite comunal utilizado como referencia estructural del visor.",
                enlace: ""
            },

            seleccion: {
                enabled: false,
                centrarAlSeleccionar: false
            },

            resaltado: {
                enabled: false,
                estilo: {
                    color: "#e47b25",
                    weight: 5,
                    fillOpacity: 0.12
                }
            },

            popup: {
                enabled: false,                  // Información breve sobre el mapa.
                titulo: null,
                campos: []
            },

            infoPanel: {
                enabled: false,                  // Información extensa en panel lateral.
                titulo: null,
                campos: []
            },

            busqueda: {
                enabled: false,                  // Incluye la capa en el buscador.
                campoPrincipal: null,
                campos: [],
                modoResultado: "resaltar"
            },

            leyenda: {
                enabled: true,
                titulo: "Límite comunal"
            },

            etiquetado: {
                enabled: false,
                campo: null,
                zoomMin: 14,
                zoomMax: null,
                permanente: true,
                claseCss: ""
            },

            simbologia: {
                tipo: "simple",
                halo: {
                    enabled: true,                // Trazo inferior para fondos claros u oscuros.
                    color: "#ffffff",
                    weight: 7,
                    opacity: 0.9
                },
                estilo: {
                    color: "#17365d",
                    weight: 3,
                    opacity: 1,
                    fill: false
                }
            }
        },
        {
            id: "sectoresRurales",
            nombre: "Sectores rurales",
            enabled: true,
            grupo: "referencia",
            archivo: "data/sectores_rurales_2609.geojson",
            visibleInicial: true,
            estructural: false,                   // Reserva el orden superior para límites.
            interactive: true,                   // Permite interacción con las entidades.
            opacityControl: true,                // Muestra el control de transparencia.
            cluster: false,                      // Agrupa puntos cercanos.
            minZoom: null,                       // Zoom mínimo visible; null sin límite.
            maxZoom: null,                       // Zoom máximo visible; null sin límite.

            metadata: {
                enabled: false,                   // Muestra el ícono de información de la capa.
                fuente: "",
                institucion: "",
                fechaActualizacion: "",
                escala: "",
                descripcion: "Delimitación de los sectores rurales de la comuna.",
                enlace: ""
            },

            seleccion: {
                enabled: true,
                centrarAlSeleccionar: false
            },

            resaltado: {
                enabled: true,
                estilo: {
                    color: "#555555",
                    weight: 3,
                    fillOpacity: 0.25
                }
            },

            popup: {
                enabled: true,                   // Información breve sobre el mapa.
                titulo: "NOMBRE",
                campos: [
                    {
                        campo: "Shape_Area",
                        etiqueta: "Sup (m2)",
                        formato: "decimal",
                        decimales: 0,
                        sufijo: " m2"
                    }
                ]
            },

            infoPanel: {
                enabled: false,                  // Información extensa en panel lateral.
                titulo: "NOMBRE",
                campos: []
            },

            busqueda: {
                enabled: true,                   // Incluye la capa en el buscador.
                campoPrincipal: "NOMBRE",
                campos: [],
                modoResultado: "contrasteInverso",
                estiloContrasteInverso: {
                    seleccionado: {
                        color: "#ffffff",
                        weight: 4,
                        fillOpacity: 0
                    },
                    resto: {
                        fillOpacity: 0.65
                    }
                }
            },

            leyenda: {
                enabled: true,
                titulo: "Sectores rurales"
            },

            etiquetado: {
                enabled: true,
                campo: "NOMBRE",
                zoomMin: 14,
                zoomMax: null,
                permanente: true,
                claseCss: "etiqueta-sector"
            },

            simbologia: {
                tipo: "simple",
                estilo: {
                    color: "#f3f4f6",
                    weight: 1.5,
                    fillColor: "#4e401f",
                    fillOpacity: 0.5
                }
             }
             
        },
{
    id: "Comunidades",
    nombre: "Comunidades",
    enabled: true,                          // Incluye o excluye completamente la capa.
    grupo: "referencia",                    // Debe existir en gruposCapas.
    archivo: "data/comunidades_imp_2609.geojson",
    visibleInicial: true,                  // Estado del checkbox al iniciar.
    estructural: false,                     // Use true para límites siempre visibles.
    interactive: true,                     // Permite interacción con las entidades.
    opacityControl: true,                  // Muestra el control de transparencia.
    cluster: false,                        // Agrupa puntos cercanos.
    minZoom: null,                         // Zoom mínimo visible; null sin límite.
    maxZoom: null,                         // Zoom máximo visible; null sin límite.

    metadata: {
        enabled: false,                     // Muestra el ícono de información de la capa.
        fuente: "",
        institucion: "",
        fechaActualizacion: "",
        escala: "",
        descripcion: "Cobertura de comunidades de la comuna.",
        enlace: ""
    },

    seleccion: {
        enabled: true,
        centrarAlSeleccionar: false
    },

    resaltado: {
        enabled: true,
        estilo: {
            color: "#ffffff",
            weight: 3,
            fillOpacity: 0.30
        }
    },

    popup: {
        enabled: true,                     // Información breve sobre el mapa.
        titulo: "COMUNIDAD",
        prefijo: "Com. ",
        campos: [
                     {
                campo: "sector",
                etiqueta: "Sector",
                formato: "texto"
            },
            {
                campo: "TM",
                etiqueta: "TM",
                formato: "texto"
            }
        ]
    },

    infoPanel: {
        enabled: false,                    // Información extensa en panel lateral.
        titulo: "COMUNIDAD",
        campos: []
    },

    busqueda: {
        enabled: true,                     // Incluye la capa en el buscador.
        campoPrincipal: "COMUNIDAD",
        campos: ["sector"],
        modoResultado: "resaltar"          // "resaltar", "aislar" o "contrasteInverso".
    },

    leyenda: {
        enabled: true,
        titulo: "Comunidades"
    },

    etiquetado: {
        enabled: true,
        campo: "COMUNIDAD",
        zoomMin: 14,
        zoomMax: null,
        permanente: true,
        claseCss: "etiqueta-comunidad"
    },

    simbologia: {
        tipo: "simple",
        estilo: {
            color: "#edf1f5",
            weight: 1.5,
            fillColor: "#0d3b08",
            fillOpacity: 0.5
        }
    }
},
{
    id: "Sedes",
    nombre: "Sedes Rurales",
    enabled: true,                          // Incluye o excluye completamente la capa.
    grupo: "tematicas",                    // Debe existir en gruposCapas.
    archivo: "data/sedes.geojson",
    visibleInicial: false,                  // Estado del checkbox al iniciar.
    estructural: false,                     // Use true para límites siempre visibles.
    interactive: true,                     // Permite interacción con las entidades.
    opacityControl: false,                   // Muestra el control de transparencia.
    cluster: true,                         // Use true solamente en capas de puntos.
    minZoom: null,                         // Zoom mínimo visible; null sin límite.
    maxZoom: null,                         // Zoom máximo visible; null sin límite.

    metadata: {
        enabled: false,                     // Muestra el ícono de información de la capa.
        fuente: "Sedes rurales de Nueva Imperial",
        institucion: "Municipalidad Nueva Imperial",
        fechaActualizacion: "2021-11",
        escala: "",
        descripcion: "Lugares destinados a reuniones de organizaciones territoriales y/o funcionales",
        enlace: ""
    },

    seleccion: {
        enabled: true,
        centrarAlSeleccionar: false
    },

    resaltado: {
        enabled: true,
        estilo: {
            color: "#ffffff",
            weight: 3,
            fillOpacity: 0.30
        }
    },

    popup: {
        enabled: true,                     // Información breve sobre el mapa.
        titulo: "",
        prefijo: "",                          // Texto opcional antes del título.
        sufijo: "",                           // Texto opcional después del título.
        campos: [
            {
                campo: "Comunidad",
                etiqueta: "Sede Com. ",
                formato: "texto"
            },
              {
                campo: "Sector",
                etiqueta: "Sector",
                formato: "texto"
            }
        ]
    },

    infoPanel: {
        enabled: false,                    // Información extensa en panel lateral.
        titulo: "CAMPO_TITULO",
        campos: [
            {
                campo: "CAMPO",
                etiqueta: "Etiqueta",
                formato: "texto"
            }
        ]
    },

    busqueda: {
        enabled: true,                     // Incluye la capa en el buscador.
        campoPrincipal: "Comunidad",
        campos: ["Sector"],
        modoResultado: "resaltar",         // "resaltar", "aislar" o "contrasteInverso".
        estiloContrasteInverso: {
            seleccionado: { color: "#ffffff", weight: 4, fillOpacity: 0 },
            resto: { fillOpacity: 0.65 }
        }
    },

    leyenda: {
        enabled: true,
        titulo: "Sedes rurales"
    },

    etiquetado: {
        enabled: false,
        campo: "CAMPO_ETIQUETA",
        zoomMin: 14,
        zoomMax: null,
        permanente: true,
        claseCss: "etiqueta-personalizada" // Clase opcional definida en styles.css.
    },

    simbologia: {
        tipo: "simple",
        estilo: {
            color: "#3388ff",
            weight: 2,
            fillColor: "#3388ff",
            fillOpacity: 0.20
        }
    }
}

    ]
};

/*
PLANTILLA PARA AGREGAR UNA CAPA NUEVA
Copie este objeto dentro de appConfig.capas y complete sus valores.

{
    id: "idCapa",
    nombre: "Nombre visible",
    enabled: true,                          // Incluye o excluye completamente la capa.
    grupo: "tematicas",                    // Debe existir en gruposCapas.
    archivo: "data/archivo.geojson",
    visibleInicial: false,                  // Estado del checkbox al iniciar.
    estructural: false,                     // Use true para límites siempre visibles.
    interactive: true,                     // Permite interacción con las entidades.
    opacityControl: true,                  // Muestra el control de transparencia.
    cluster: false,                        // Use true solamente en capas de puntos.
    minZoom: null,                         // Zoom mínimo visible; null sin límite.
    maxZoom: null,                         // Zoom máximo visible; null sin límite.

    metadata: {
        enabled: true,                     // Muestra el ícono de información de la capa.
        fuente: "Nombre de la fuente",
        institucion: "Institución responsable",
        fechaActualizacion: "AAAA-MM-DD",
        escala: "Escala o precisión de origen",
        descripcion: "Descripción breve del dataset.",
        enlace: ""
    },

    seleccion: {
        enabled: true,
        centrarAlSeleccionar: false
    },

    resaltado: {
        enabled: true,
        estilo: {
            color: "#ffffff",
            weight: 3,
            fillOpacity: 0.30
        }
    },

    popup: {
        enabled: true,                     // Información breve sobre el mapa.
        titulo: "CAMPO_TITULO",
        prefijo: "",                          // Texto opcional antes del título.
        sufijo: "",                           // Texto opcional después del título.
        campos: [
            {
                campo: "CAMPO",
                etiqueta: "Etiqueta",
                formato: "texto"
            },
            {
                campo: "Shape_Area",
                etiqueta: "Sup (m2)",
                formato: "decimal",
                decimales: 0,
                sufijo: " m2"
                    }
        ]
    },

    infoPanel: {
        enabled: false,                    // Información extensa en panel lateral.
        titulo: "CAMPO_TITULO",
        campos: [
            {
                campo: "CAMPO",
                etiqueta: "Etiqueta",
                formato: "texto"
            }
        ]
    },

    busqueda: {
        enabled: true,                     // Incluye la capa en el buscador.
        campoPrincipal: "CAMPO_PRINCIPAL",
        campos: ["CAMPO_SECUNDARIO"],
        modoResultado: "resaltar",         // "resaltar", "aislar" o "contrasteInverso".
        estiloContrasteInverso: {
            seleccionado: { color: "#ffffff", weight: 4, fillOpacity: 0 },
            resto: { fillOpacity: 0.65 }
        }
    },

    leyenda: {
        enabled: true,
        titulo: "Nombre en leyenda"
    },

    etiquetado: {
        enabled: false,
        campo: "CAMPO_ETIQUETA",
        zoomMin: 14,
        zoomMax: null,
        permanente: true,
        claseCss: "etiqueta-personalizada" // Clase opcional definida en styles.css.
    },

    simbologia: {
        tipo: "simple",
        estilo: {
            color: "#3388ff",
            weight: 2,
            fillColor: "#3388ff",
            fillOpacity: 0.20
        }
    }
}

EJEMPLO DE SIMBOLOGÍA POR VALORES ÚNICOS
Reemplace el bloque simbologia de la capa por una estructura como esta:

simbologia: {
    tipo: "valoresUnicos",
    campo: "CAMPO_CATEGORIA",
    estiloBase: {
        color: "#ffffff",
        weight: 1,
        fillOpacity: 0.60
    },
    categorias: [
        {
            valor: "VALOR_A",
            etiqueta: "Categoría A",
            estilo: { fillColor: "#2f7d32" }
        },
        {
            valor: "VALOR_B",
            etiqueta: "Categoría B",
            estilo: { fillColor: "#7b4ab5" }
        }
    ],
    estiloDefault: { fillColor: "#9e9e9e" },
    etiquetaDefault: "Sin información u otros",
    mostrarDefaultEnLeyenda: true
}

EJEMPLO DE SIMBOLOGÍA POR COLORES GRADUADOS
Cada clase excluye min e incluye max; use max: null en la última clase.

simbologia: {
    tipo: "graduados",
    campo: "CAMPO_NUMERICO",
    valoresSinDatos: [0, null, ""],
    estiloBase: {
        color: "#ffffff",
        weight: 1,
        fillOpacity: 0.65
    },
    clases: [
        {
            min: 0,
            max: 50,
            etiqueta: "1–50",
            estilo: { fillColor: "#eff3ff" }
        },
        {
            min: 50,
            max: 100,
            etiqueta: "51–100",
            estilo: { fillColor: "#6baed6" }
        },
        {
            min: 100,
            max: null,
            etiqueta: "Más de 100",
            estilo: { fillColor: "#08519c" }
        }
    ],
    estiloDefault: { fillColor: "#bdbdbd" },
    etiquetaDefault: "Sin información",
    mostrarDefaultEnLeyenda: true
}
*/

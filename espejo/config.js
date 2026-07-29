// Todo numero ajustable del sistema vive aca. Ningun otro archivo deberia tener
// constantes magicas: si algo hay que calibrar el dia del evento, se calibra aca.

export const CONFIG = {
  // En manual la experiencia no avanza sola: cada estado espera un ESPACIO.
  // Sirve para probar sin pelear con el reloj — la escena no se corta a los
  // treinta segundos ni cuando salis de cuadro.
  //
  // La experiencia arranca en automatico al detectar una cara. El modo manual
  // se puede activar desde la configuracion cuando haga falta probarla.
  avance: {
    manual: false,
  },

  demo: {
    pausaSinPersonaMs: 6500,
  },

  // Duraciones de cada estado, en milisegundos.
  tiempos: {
    enganche: 4000,
    sorteo: 6000,
    revelacion: 5000,
    escena: 30000,
    reflexion: 12000,
    cierre: 8000,
    enfriamiento: 4000,
    ausenciaParaCortar: 3000,
    sesionMaxima: 120000,
  },

  // Cuando se considera que hay alguien sentado.
  // Entrar es rapido; salir es lento, para que la experiencia no parpadee
  // cada vez que alguien gira la cabeza.
  presencia: {
    cuadrosParaEntrar: 6,
    msParaSalir: 400,
  },

  // Filtro exponencial. Mas bajo = mas suave y mas lento.
  suavizado: {
    posicion: 0.35,
    radio: 0.25,
    angulo: 0.15,
  },

  deteccion: {
    fpsObjetivo: 22,
    anchoCamara: 1280,
    altoCamara: 720,
    factorRadio: 1.6,
    ventanaConfianza: 30,

    // Centros de iris. Salen de FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS y
    // FACE_LANDMARKS_RIGHT_IRIS del propio paquete de MediaPipe, no de memoria.
    // Promediar los cuatro puntos del anillo da el centro de la pupila.
    //
    // "izquierdo" y "derecho" aca son etiquetas sin peso: mapearRostro ordena
    // los dos ojos por su posicion en pantalla despues de espejar, asi que da
    // igual cual sea cual.
    indices: {
      ojoIzq: [474, 475, 476, 477],
      ojoDer: [469, 470, 471, 472],
    },

    // Respaldo por si el modelo no trae iris (menos de 478 puntos).
    // Son las esquinas interna y externa de cada ojo.
    indicesSinIris: {
      ojoIzq: [362, 263],
      ojoDer: [33, 133],
    },
  },

  manos: {
    maximo: 2,

    // Mas alto que el de la cara a proposito. Una cabeza se mueve despacio; una
    // mano se mueve diez veces mas rapido, y a 22 cuadros por segundo el circulo
    // va siempre atras de la mano de verdad: manoteas y no le pegas a nada.
    fps: 34,

    // Generosos: es mas facil disfrutar un circulo que perdona que uno exacto
    // que te hace errar. Subilos si sigue costando pegarle a los objetos.
    factorRadio: 1.4,
    radioMinimoEnPalmas: 1.0,

    // Suavizado y tope de la velocidad con la que la cabeza y las manos golpean
    // los objetos. Sin tope, un parpadeo de la deteccion dispara un objeto a
    // velocidad absurda.
    alfaVelocidad: 0.4,
    velocidadMaxima: 4000,
  },

  objetos: {
    maximo: 40,
    intervaloAparicion: 350,
    vidaMs: 12000,
  },

  efectos: {
    // Particulas por carrera. Como los objetos, tope fijo: el rendimiento no
    // puede depender de cuanto tiempo lleve alguien sentado.
    presupuesto: 60,
  },

  fisica: {
    gravedad: 1600,
    restitucion: 0.55,
    friccion: 0.98,
  },

  render: {
    anchoReferencia: 1080,
    altoReferencia: 1920,

    // Tope de cuadros dibujados por segundo. En una pantalla de alta frecuencia
    // el navegador ofrece 144 o 240, y dibujarlos todos es calor y consumo sin
    // ningun beneficio visible. El margen de 2 ms evita el error clasico de que
    // una pantalla de 60 Hz caiga a 30 por unas decimas de jitter.
    fpsMaximo: 60,
    margenMs: 2,
  },

  operacion: {
    recargaCadaMs: 4 * 60 * 60 * 1000,
  },

  interfazGestual: {
    reposo: {
      esperaInicialMs: 3000,
      intervaloMs: 5000,
      cierreMs: 850,
      cerradoMs: 300,
      aperturaMs: 1050,
    },
  },

  red: {
    puerto: 8080,
    reconexionMs: 2000,
    latidoMs: 2000,
  },
};

// Todo numero ajustable del sistema vive aca. Ningun otro archivo deberia tener
// constantes magicas: si algo hay que calibrar el dia del evento, se calibra aca.

export const CONFIG = {
  // En manual la experiencia no avanza sola: cada estado espera un ESPACIO.
  // Sirve para probar sin pelear con el reloj — la sesion no se corta cuando
  // salis de cuadro. En false (lo normal, y lo unico valido para el evento) la
  // experiencia es automatica; la tecla A alterna en vivo, y mientras el modo
  // manual este activo el espejo lo avisa en pantalla.
  avance: {
    manual: false,
  },

  // Duraciones de cada estado, en milisegundos. La escena no tiene duracion
  // propia a proposito: dura mientras la persona siga sentada, y el unico tope
  // es sesionMaxima, que hace de red de seguridad y de rotacion de la fila.
  tiempos: {
    enganche: 2000,
    sorteo: 4000,
    revelacion: 4000,
    cierre: 3000,
    enfriamiento: 2000,

    // Cuanto tiene que faltar la presencia para dar la sesion por terminada.
    // Generoso a proposito: la deteccion de alguien sentado lejos entra y sale,
    // y cortarle la escena a quien no se movio es el peor error posible. Sumado
    // a presencia.msParaSalir da unos diez segundos de tolerancia real. Quien se
    // va de verdad libera el espejo igual en menos de veinte segundos, contando
    // el cierre (tests/integracion/presencia.test.js vigila las dos puntas).
    ausenciaParaCortar: 8000,

    // Red de seguridad, no temporizador de la experiencia: existe por si la
    // deteccion se traba en verdadero (un poster, el respaldo de una silla) y el
    // espejo se queda en escena para siempre. Con 75 s le cortaba la escena a
    // quien la estaba disfrutando, que es justo lo que no tiene que hacer.
    sesionMaxima: 180000,
  },

  // Cuando se considera que hay alguien sentado.
  // Entrar es rapido; salir es lento, para que la experiencia no parpadee
  // cada vez que alguien gira la cabeza.
  presencia: {
    msParaEntrar: 270, // seis detecciones seguidas a 22 cuadros por segundo

    // Este numero es el que decide si el espejo se siente estable o nervioso.
    // Es el colchon que absorbe los huecos de la deteccion ANTES de que lleguen
    // a la maquina de estados. Con 800 ms un rostro intermitente reiniciaba una
    // y otra vez los dos segundos continuos que pide el enganche: las nubes se
    // abrian y se cerraban sin llegar nunca al sorteo.
    msParaSalir: 2000,
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

    // Alto, en pixeles, del lienzo que se le da a MediaPipe. No es el cuadro de
    // la camara: es solo el pedazo que se ve en pantalla (ver
    // calcularRecorteVisible en escena.js). Con una camara apaisada en una
    // pantalla vertical, dos tercios del ancho no se ven nunca, y analizarlos
    // gastaba la resolucion del modelo en pixeles que nadie mira. Subirlo no
    // agranda la cara dentro del recorte: lo que da alcance es el recorte, no
    // este numero.
    altoAnalisis: 720,

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

    // Generosos: facil de interactuar a 1.5m - 2m de la camara sin exigir estirar el brazo.
    factorRadio: 1.5,
    radioMinimoEnPalmas: 1.2,

    // Suavizado y tope de la velocidad con la que la cabeza y las manos golpean
    // los objetos. Sin tope, un parpadeo de la deteccion dispara un objeto a
    // velocidad absurda.
    alfaVelocidad: 0.4,
    velocidadMaxima: 4000,

    // Que hacen las manos con los objetos que caen.
    //   'atraer':  iman — los objetos se juntan y quedan flotando alrededor de
    //              la palma (pedido de la primera prueba con publico).
    //   'golpear': los objetos rebotan y se manotean.
    // La tecla I alterna en vivo, para comparar los dos modos con gente delante.
    interaccion: 'atraer',

    // El campo del iman: un resorte hacia un anillo de reposo alrededor de la
    // palma, con los capturados separandose entre si para no encimarse. La
    // fuerza tiene que ganarle comodo a fisica.gravedad, o los objetos se
    // escurren por debajo del campo; con 8000 el iman captura desde cualquier
    // angulo y el racimo queda quieto (fisica.test.js lo vigila).
    atraccion: {
      alcanceFactor: 3.2, // alcance del campo, en radios de mano
      alcanceArribaFactor: 4.5, // alcance extendido hacia arriba para capturar objetos que caen a distancia
      reposoFactor: 0.3, // anillo de reposo, en radios de mano: bien chico para que el racimo se abrace a la palma y no flote lejos
      fuerza: 8000, // aceleracion maxima del resorte, en px/s2
      amortiguacion: 3.5, // 1/s: cuanto se frenan los objetos dentro del campo
      separacion: 10, // 1/s: que tan rapido se apartan dos capturados encimados
    },

    // La señal de que las manos sirven para algo. No dibuja la mano —eso compite
    // con la mano de verdad que ya se ve en el espejo— sino el campo del iman:
    // un resplandor en la palma y anillos que se CIERRAN hacia ella, que es el
    // mismo camino que hacen los objetos. El anillo nace en el alcance real del
    // campo, asi que ademas enseña hasta donde llega.
    senal: {
      resplandorFactor: 2.2, // radio del resplandor, en radios de mano
      nucleoFactor: 0.22, // brillo que marca de donde cuelga el racimo
      anchoAnilloFactor: 0.5, // que tan difusa es cada banda, en radios de mano
      anillos: 2, // cuantos viajan a la vez: con uno solo la señal parpadea
      periodoMs: 1500, // lo que tarda una banda en llegar a la palma
    },

    // Suavizado SOLO para el iman: el racimo cuelga de la palma en forma
    // permanente, asi que el temblor de la deteccion se le traslada entero; el
    // atractor sigue una palma filtrada que lo corta. El modo golpe usa la
    // palma cruda a proposito — el filtro mete retardo y el manotazo lo sufre.
    suavizadoDelIman: {
      posicion: 0.35,
      radio: 0.25,
      retencionMs: 400,
      distanciaMaximaEnRadios: 3,
    },
  },

  pose: {
    fps: 12,
    // Los hombros sostienen la presencia cuando la cara gira. La mascara solo
    // se usaba en diagnostico y su clon por cuadro era un costo innecesario.
    segmentacion: false,
  },

  objetos: {
    maximo: 24,
    intervaloAparicion: 450,
    vidaMs: 12000,
  },

  efectos: {
    // Particulas por carrera. Como los objetos, tope fijo: el rendimiento no
    // puede depender de cuanto tiempo lleve alguien sentado.
    presupuesto: 60,
  },

  // Las nubes son el estado de reposo del espejo: cubren la pantalla cuando no
  // hay nadie, salen hacia los lados al detectar a alguien y vuelven por el
  // mismo camino cuando la persona lleva dos segundos ausente.
  niebla: {
    cantidad: 26, // jirones en pantalla
    agitacionSorteo: 3, // cuanto se aceleran los jirones durante el sorteo
    velocidades: {
      abrir: 1.7, // fraccion por segundo: el espejo se despeja en ~0.6 s
      cerrar: 0.34, // acompaña los tres segundos del estado de cierre
    },
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
};

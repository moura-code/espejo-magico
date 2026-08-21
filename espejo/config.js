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

    // El humo entra, se espesa y tapa la pantalla. Detras, las nubes se abren y
    // se sortean las carreras: cuando el humo se disipa los objetos ya estan.
    humo: 3000,

    // Tope de la eleccion, no su duracion: la eleccion termina cuando la
    // persona elige. Existe porque sin el, quien no entiende el gesto se queda
    // mirando cinco objetos quietos hasta el tope de sesion, tres minutos
    // despues, con la fila esperando. Al vencerse se elige una sola por sorteo:
    // nadie se va sin ingenieria.
    eleccionMaxima: 30000,

    revelacion: 2500,
    cierre: 3000,

    // Corto: quien llega despues de que el espejo volvio al reposo no tiene por
    // que esperar. Existe solo para que la persona que se esta yendo no dispare
    // una sesion nueva de espaldas.
    enfriamiento: 1000,

    // El equilibrio del que dependen las dos quejas del stand, en tension.
    //
    // Corto de mas: le corta la escena a alguien que sigue sentado y solo se
    // perdio un momento. Largo de mas: la persona que se fue se lleva el espejo
    // con ella y el que sigue en la fila mira una escena ajena.
    //
    // Sumado a presencia.msParaSalir da seis segundos de tolerancia real, y con
    // el cierre el espejo queda libre a los nueve de que alguien se levanta.
    // Debajo de esos seis segundos, si dos personas se turnan muy rapido, la
    // segunda hereda la carrera de la primera: distinguirlas pide comparar
    // posiciones, no acortar plazos.
    ausenciaParaCortar: 4000,

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
    // va siempre atras de la mano de verdad: apuntas y el anillo va atrasado.
    fps: 34,

    // Generosos: facil de interactuar a 1.5m - 2m de la camara sin exigir estirar el brazo.
    factorRadio: 1.5,
    radioMinimoEnPalmas: 1.2,

    // La palma que elige va filtrada. El sostenido mide que la mano se quede
    // quieta encima de un objeto, y el temblor crudo de la deteccion la hace
    // entrar y salir del blanco varias veces por segundo: el anillo de progreso
    // se llenaria a los saltos.
    suavizado: {
      posicion: 0.35,
      radio: 0.25,
      retencionMs: 400,
      distanciaMaximaEnRadios: 3,
    },

    // La señal de que las manos sirven para algo. No dibuja la mano —eso compite
    // con la mano de verdad que ya se ve en el espejo— sino un resplandor en la
    // palma. Sin el, el sostenido es a ciegas: no sabes donde registra tu mano
    // hasta que el anillo del objeto empieza a llenarse.
    senal: {
      resplandorFactor: 2.2, // radio del resplandor, en radios de mano
      nucleoFactor: 0.22, // brillo que marca el punto que elige
    },
  },

  pose: {
    // La pose sostiene la presencia cuando la cara gira, y ademas recorta la
    // silueta para meter el fondo de la carrera atras de la persona.
    fps: 12,

    // En la revelacion y la escena la mascara ES la imagen: a 12 cuadros por
    // segundo el borde de la silueta va atras del cuerpo y se ve el fondo
    // pegado al hombro. Solo sube ahi, que es donde se mira.
    fpsConFondo: 20,
    segmentacion: true,
  },

  // El sostenido: como se elige un objeto sin tocar nada.
  //
  // El plazo es el equilibrio entre elegir sin querer al pasar la mano (corto de
  // mas) y cansar el brazo (largo de mas). Con 1500 ms hay tiempo de sacar la
  // mano al ver que se empieza a llenar el anillo equivocado.
  eleccion: {
    msParaElegir: 1500,

    // Cuanto se le perdona a la deteccion antes de empezar a vaciar el anillo.
    // NO es un detalle: la deteccion de manos se pierde varios cuadros por
    // segundo con la mano de costado o mal iluminada, y como vaciar es mas
    // rapido que llenar, sin gracia un 25% de cuadros perdidos convertia 1,5 s
    // de sostenido en doce. Con 250 ms se absorbe cualquier parpadeo real y
    // solo una mano que se fue de verdad hace bajar el anillo.
    msDeGracia: 250,

    // Pasada la gracia, el progreso NO se borra de golpe: se vacia en este
    // tiempo. Mas rapido que llenarse, para que un roce no valga por una
    // eleccion, pero no instantaneo.
    msDeOlvido: 600,

    // Que tan generoso es el blanco, en radios del objeto. Es mas facil
    // disfrutar un blanco que perdona que uno exacto que te hace errar.
    radioFactor: 1.4,

    // Cuantos objetos se ofrecen. Tambien cuantas carreras se sortean.
    cantidad: 5,
  },

  // Donde se ponen esos objetos.
  //
  // NO van en posiciones fijas de la pantalla: a dos metros de la camara el
  // brazo de la persona alcanza apenas el tercio central del espejo, y cinco
  // objetos en las esquinas serian inalcanzables. Van en arco alrededor de los
  // hombros, con el radio proporcional al ancho de hombros — que es el mejor
  // indicador de a que distancia esta sentada.
  tablero: {
    radioFactor: 1.5, // alcance del arco, en anchos de hombros
    radioObjetoFactor: 0.28, // tamaño de cada objeto, en anchos de hombros

    // El arco, en grados, medidos como en el lienzo: 180 es a la izquierda, 270
    // es arriba, 0 es a la derecha. Pasa por encima de la cabeza.
    desde: 200,
    hasta: 340,

    // El ancla va muy suavizada: si los objetos siguieran a los hombros cuadro a
    // cuadro, apuntarles seria imposible. Ademas se CONGELA apenas empieza un
    // sostenido, para que el blanco no se escape de abajo de la mano.
    suavizado: 0.06,

    // Respaldo cuando no hay pose y solo hay cara: un ancho de hombros son unos
    // tres radios de rostro, y el centro esta un radio y medio mas abajo.
    hombrosPorRostro: 3,
    caidaPorRostro: 1.5,

    // Margen minimo al borde del lienzo, en radios de objeto. Con la persona
    // muy cerca el arco se sale de la pantalla; esto lo mete de vuelta.
    margen: 1.1,
  },

  // El humo que entra al sentarse. Es un video blanco sobre negro, compuesto en
  // `screen`: el negro desaparece solo y no hace falta canal alfa.
  humo: {
    ruta: 'assets/humo.mp4',
    opacidad: 0.95,

    // Fraccion del estado HUMO que tarda en espesarse. El resto lo pasa tapando.
    fraccionDeEntrada: 0.55,

    // Cuanto tarda en disiparse ya dentro de la eleccion, dejando los objetos.
    msDeSalida: 1400,

    // Cuanto se lo espera al arrancar antes de seguir sin humo. Con la ventana
    // tapada Chrome posterga la descarga y no avisa ni que si ni que no: sin
    // este tope el espejo no llega a arrancar. Generoso a proposito, el video
    // pesa 12 MB y en la PC del evento se sirve desde el disco local.
    msParaCargar: 8000,
  },

  // El fondo de la carrera, detras de la persona.
  fondo: {
    // Cuando la mascara de segmentacion no esta —pose perdida, GPU lenta, modelo
    // sin cargar— el fondo se dibuja igual encima del espejo con esta opacidad,
    // en vez de dejar la pantalla en negro con publico delante.
    opacidadSinMascara: 0.75,
    oscurecerVideo: 0.55, // cuanto se apaga el espejo debajo del fondo sin mascara
  },

  // El unico puente que sale de esta PC. Le avisa a MAITE que carrera se eligio
  // para que las tablets muestren a la gente de esa ingenieria.
  //
  // El espejo NO depende de esto: si MAITE no esta levantado, no contesta o
  // tarda, la experiencia sigue igual y lo unico que queda es un aviso en la
  // consola. En false ni se intenta.
  maite: {
    activo: true,
    url: 'http://localhost:3000',
    tiempoLimiteMs: 1500,
  },

  // Las nubes son el estado de reposo del espejo: cubren la pantalla cuando no
  // hay nadie, salen hacia los lados al detectar a alguien y vuelven por el
  // mismo camino cuando la persona lleva dos segundos ausente.
  niebla: {
    cantidad: 26, // jirones en pantalla
    agitacionHumo: 3, // cuanto se aceleran los jirones mientras entra el humo
    velocidades: {
      abrir: 1.7, // fraccion por segundo: el espejo se despeja en ~0.6 s
      cerrar: 0.34, // acompaña los tres segundos del estado de cierre
    },
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

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

  // Duraciones de cada estado, en milisegundos. La exploracion no tiene
  // duracion propia a proposito: dura mientras la persona siga sentada, y el
  // unico tope es sesionMaxima, que hace de red de seguridad y de rotacion de
  // la fila.
  tiempos: {
    enganche: 2000,

    // El humo entra, se espesa y tapa la pantalla. Detras, las nubes se abren y
    // se sortean las carreras: cuando el humo se disipa los objetos ya estan.
    humo: 3000,

    // La red de seguridad de la fila, no un tope de la experiencia: la
    // exploracion no termina nunca sola. Existe porque sin ella, quien no
    // entiende el gesto se queda mirando los objetos girar hasta el tope de
    // sesion, tres minutos despues, con la fila esperando. Al vencerse se
    // muestra una por sorteo —lo ofrecido viene barajado, asi que tomar el
    // primero ya es un sorteo— y la eleccion queda cerrada igual que si la
    // hubiera agarrado con la mano: nadie se va sin ingenieria.
    eleccionMaxima: 30000,

    // Cuanto tarda en entrar el fondo de una ingenieria con su ficha. Es el
    // reloj de la mirada, no el de un estado: arranca cuando la persona agarra
    // su objeto, en cualquier momento de la exploracion.
    aparicion: 2500,

    // Cuanto tarda el objeto agarrado en volar de su ranura a su lugar en el
    // fondo. Mas corto que la aparicion: llega mientras el fondo todavia entra,
    // y se lee como que el fondo se arma alrededor de lo que la persona eligio.
    //
    // Es tambien lo que tarda en apagarse el carrusel, y no por casualidad: el
    // anillo termina de vaciarse justo cuando el objeto elegido aterriza, y eso
    // se lee como que los demas se apartaron para dejarlo pasar.
    vuelo: 1000,
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
    // espejo se queda tomado para siempre. Con 75 s le cortaba la exploracion a
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
  },

  // Donde se ponen los objetos que se ofrecen: un anillo con todas las
  // carreras, del que solo se ve una ventana.
  //
  // NO van en posiciones fijas de la pantalla: a dos metros de la camara el
  // brazo de la persona alcanza apenas el tercio central del espejo, y doce
  // objetos repartidos por el lienzo serian inalcanzables. Van en un anillo
  // alrededor de los hombros, con el radio proporcional al ancho de hombros —
  // que es el mejor indicador de a que distancia esta sentada. Del anillo se
  // dibuja solo la ventana de arriba; el resto esta "detras del marco" y sigue
  // girando.
  tablero: {
    radioFactor: 1.5, // alcance del anillo, en anchos de hombros
    radioObjetoFactor: 0.22, // tamaño de cada objeto, en anchos de hombros

    // La ventana visible, en grados, medidos como en el lienzo: 180 es a la
    // izquierda, 270 es arriba, 0 es a la derecha. Pasa por encima de la
    // cabeza y baja hasta la altura de los hombros a cada lado: con doce a 30
    // grados se ven cinco o seis, como en el boceto de la catedra. Lo que
    // queda fuera no se dibuja ni se puede agarrar.
    desde: 190,
    hasta: 350,

    // Cuanto gira el carrusel. Lento a proposito: a 8 grados por segundo la
    // vuelta entera lleva 45 s y entra un objeto nuevo cada cuatro. La mano
    // lo sigue sin esfuerzo, y se detiene en cuanto empieza un sostenido.
    gradosPorSegundo: 8,

    // La rampa de alfa en cada borde de la ventana, para que nada aparezca ni
    // desaparezca de golpe. Un objeto a medio entrar no se puede agarrar.
    gradosDeFundido: 12,

    // Aire minimo entre dos objetos vecinos, en radios de objeto. Con doce a
    // 30 grados y el radio achicado por el borde del lienzo, sin esto dos
    // objetos se encimarian y el de atras seria inelegible.
    aireEntreObjetos: 0.2,

    // El ancla va muy suavizada: si los objetos siguieran a los hombros cuadro a
    // cuadro, apuntarles seria imposible. Ademas se CONGELA apenas empieza un
    // sostenido —y con ella la rotacion—, para que el blanco no se escape de
    // abajo de la mano.
    suavizado: 0.06,

    // Respaldo cuando no hay pose y solo hay cara: un ancho de hombros son unos
    // tres radios de rostro, y el centro esta un radio y medio mas abajo.
    hombrosPorRostro: 3,
    caidaPorRostro: 1.5,

    // Margen minimo al borde del lienzo, en radios de objeto. Con la persona
    // muy cerca el anillo se sale de la pantalla; esto lo mete de vuelta.
    margen: 1.1,
  },

  // El humo que entra al sentarse. Es un video blanco sobre negro, compuesto en
  // `screen`: el negro desaparece solo y no hace falta canal alfa.
  humo: {
    ruta: 'assets/humo.mp4',
    opacidad: 0.95,

    // Fraccion del estado HUMO que tarda en espesarse. El resto lo pasa tapando.
    fraccionDeEntrada: 0.55,

    // Cuanto humo queda mientras el espejo descansa. Es lo que ve la fila
    // mientras espera: tiene que leerse como un espejo cubierto, no como una
    // pantalla apagada, asi que nunca llega a tapar del todo.
    enReposo: 0.35,
    msParaAsentarse: 1500,
    // Lo que tarda una respiracion entera. Lento a proposito: mas rapido se
    // lee como un parpadeo del video y no como algo vivo.
    msDeRespiro: 5200,

    // Cuanto tarda en disiparse ya dentro de la eleccion, dejando los objetos.
    msDeSalida: 1400,

    // Cuanto se lo espera al arrancar antes de seguir sin humo. Con la ventana
    // tapada Chrome posterga la descarga y no avisa ni que si ni que no: sin
    // este tope el espejo no llega a arrancar. Generoso a proposito, el video
    // pesa 12 MB y en la PC del evento se sirve desde el disco local.
    msParaCargar: 8000,
  },

  // El fondo de la carrera, detras de la persona, y el objeto apoyado en el.
  fondo: {
    // Cuando la mascara de segmentacion no esta —pose perdida, GPU lenta, modelo
    // sin cargar— el fondo se dibuja igual encima del espejo con esta opacidad,
    // en vez de dejar la pantalla en negro con publico delante.
    opacidadSinMascara: 0.75,
    oscurecerVideo: 0.55, // cuanto se apaga el espejo debajo del fondo sin mascara

    // Donde se apoya el objeto cuando el fondo no declara su `lugar`:
    // normalizado a la imagen, arriba a la izquierda, lejos de la cara, del
    // nombre y del recorrido del carrusel, que pasa por encima de la cabeza a
    // un tercio de la pantalla. `escala` es el diametro como fraccion del ancho
    // de la imagen.
    lugarPorDefecto: { x: 0.2, y: 0.22, escala: 0.16 },

    // El halo del color de la carrera debajo del objeto apoyado. Lo presenta
    // sobre cualquier fondo, foto o escena vectorial, sin pedirle a cada imagen
    // que tenga una mesa justo ahi.
    haloDelLugar: 0.35,

    // La flotacion del objeto apoyado: `amplitud` en radios del objeto. Poca a
    // proposito: tiene que leerse vivo, no competir con la persona.
    flotar: { amplitud: 0.08, periodoMs: 3200 },

    // Cuanto se espera a cada fondo con movimiento antes de darlo por perdido y
    // seguir con su foto. Los videos se cargan DESPUES de que el espejo arranco
    // y de a uno, asi que este tope no retrasa el arranque: solo evita que un
    // archivo que nunca contesta deje la cola de descargas trabada para siempre
    // y las carreras siguientes sin su video.
    msParaCargarVideo: 8000,
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

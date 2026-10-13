// Todo numero ajustable del sistema vive aca. Ningun otro archivo deberia tener
// constantes magicas: si algo hay que calibrar el dia del evento, se calibra aca.

// El dorado de MAITE: el color con el que las cuatro tablets escriben los
// nombres (--color-accent-strong en su public/style.css). Va en el nombre de la
// ingenieria, en la carga y en las fichas, igual para las doce.
const DORADO = '#f0dca0';

export const CONFIG = {
  // En manual la experiencia no avanza sola: cada estado espera un ESPACIO.
  // Sirve para probar sin pelear con el reloj — la sesion no se corta cuando
  // salis de cuadro. En false (lo normal, y lo unico valido para el evento) la
  // experiencia es automatica; la tecla A alterna en vivo, y mientras el modo
  // manual este activo el espejo lo avisa en pantalla.
  avance: {
    manual: false,
  },

  // Los colores de la experiencia, que son los de las tablets de MAITE
  // (`public/style.css`): las dos piezas estan a dos metros una de otra en el
  // stand y tienen que leerse como una sola instalacion. La catedra pidio que
  // el color no distinga a las ingenierias, asi que los nombres, la carga y los
  // halos van en estos, iguales para las doce. Las opciones que se miraron
  // estan lado a lado en herramientas/colores.html.
  paleta: {
    // --color-accent-strong: el de los nombres en las cuatro tablets.
    nombre: DORADO,
    // --color-text-muted: el de los textos de las tablets.
    texto: '#cdbfa0',
    // --color-bg, casi opaco: el panel de las fichas.
    panel: 'rgba(5, 5, 10, 0.8)',
    // El dorado apenas (0x47 es el 28 %): el borde del panel.
    borde: `${DORADO}47`,
  },

  // Duraciones de cada estado, en milisegundos. La exploracion no tiene
  // duracion propia ni tope, a proposito: la persona se queda lo que quiera,
  // para elegir y para explorar, y lo que la termina es que se vaya. Si hace
  // falta liberar el espejo con alguien sentado, el equipo del stand la cierra
  // con ESPACIO, y el espejo espera una ausencia antes de rearmarse.
  tiempos: {
    enganche: 2000,

    // El humo entra, se espesa y tapa la pantalla. Detras, las nubes se abren y
    // se sortean las carreras: cuando el humo se disipa los objetos ya estan.
    humo: 3000,

    // Si la persona mira el carrusel pero no empezo un sostenido, se repite la
    // instruccion una vez. Nada mas: no se le asigna una carrera ni se libera
    // el espejo, elige cuando quiere.
    ayudaEleccion: 10000,

    // Cuanto tarda en entrar el fondo de una ingenieria con su nombre. Es el
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

    // Cuanto tardan en aparecer los objetos escondidos en el fondo. Arrancan
    // cuando el elegido aterriza —primero se sigue el vuelo— y la consigna
    // que enseña a explorarlos entra y sale con este mismo plazo.
    escondidos: 1500,
    cierre: 3000,

    // Lo que tarda en entrar la invitacion del reposo, y lo que tarda en irse
    // cuando alguien se sienta: rapido, mientras las nubes se abren. Aparecer y
    // desaparecer de golpe se leia como un parpadeo encima de las nubes. Sigue
    // al estado desde donde este, como las nubes: si el reposo dura menos que
    // su entrada, se va desde donde habia llegado.
    invitacion: 1200,
    salidaDeLaInvitacion: 600,

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

    // Cuanto puede durar el ENGANCHE sin completarse. No es un plazo para la
    // persona —la experiencia todavia no empezo—: un rostro que aparece y
    // desaparece nunca junta los dos segundos continuos que arrancan, y como
    // esta ahi tampoco acumula la ausencia que corta. Sin esto el espejo se
    // queda trabado en el enganche, con las nubes agitandose para siempre.
    engancheMaximo: 180000,
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

    // Con la ingenieria ya elegida las manos siguen sirviendo —pasarlas sobre
    // los objetos del fondo abre sus fichas—, pero ya no hay un sostenido que
    // se llene cuadro a cuadro: con 300 ms para abrir y 900 de gracia alcanza
    // con pocos cuadros, y el resto se lo queda la silueta, que es lo que mas se
    // mira a partir de ahi y corre a fpsConFondo con lectura de la GPU. Hay que
    // medirlo con el panel (P) en la PC del evento: rostro, pose y manos corren
    // en el mismo hilo.
    fpsExplorando: 12,

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

      // Se prende rapido y se apaga despacio. El filtro suelta de golpe una mano
      // perdida y la vuelve a tomar de golpe: sin esto la señal parpadeaba con
      // la mano de costado.
      msDeEntrada: 150,
      msDeSalida: 450,
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

  // Como se recorta a la persona con la mascara de la pose (silueta.js). La
  // confianza del modelo NO va directo al alfa: lo que no sabe si es persona
  // —el respaldo de la silla, el marco de una ventana— le sale a medias y
  // saltando de una mascara a la otra, y usada tal cual es la sala real
  // parpadeando detras de la persona.
  silueta: {
    // Cuanto se queda de la mascara anterior donde el modelo duda: el
    // `combine_with_previous_ratio` de MediaPipe, que usaba 0,7 con la camara a
    // 30 cuadros por segundo; la pose corre a 20 o menos. Solo donde duda: lo
    // seguro pasa en la misma mascara y una mano que entra no se arrastra. Con
    // 0,7 quedaba el doble de idas y vueltas; con 0,9 mejora poco y lo dudoso
    // tarda mas en acomodarse cuando la persona se mueve.
    mezcla: 0.85,

    // Y despues, contraste. Debajo de `transparenteHasta` no se dibuja nada:
    // lo que el modelo vio a medias. Desde `opacaDesde` la persona es entera,
    // sin el fondo transparentandose a traves de la ropa oscura. En el medio,
    // el borde suave. Un poco arriba de 0,5 a proposito: ante la duda, mejor
    // sin la silla que con ella. Bajando el primero vuelve el halo de la sala
    // alrededor del pelo; subiendo el segundo, lo fino —mechones, dedos— se
    // transparenta.
    transparenteHasta: 0.4,
    opacaDesde: 0.8,

    // LA SEGUNDA OPINION (segmentador.js). La pose se lleva lo que la persona
    // tiene pegado —el marco de una ventana junto al pelo, los papeles de la
    // mesa— con confianza alta, y eso ningun suavizado lo saca. Con esto, un
    // pixel es persona solo si el segmentador selfie de MediaPipe tambien lo
    // ve. Es un modelo mas en el mismo hilo, alrededor de 1 ms con la GPU
    // (mirarlo con el panel, P). En false, la silueta sale de la pose sola.
    confirmarConSelfie: true,

    // Salvo que el selfie no vea a la persona: si confirma menos de esta
    // fraccion de lo que la pose ve, se le cree a la pose sola. Sin esto, un
    // cuadro en que el selfie falla —mala luz, alguien lejos— borraria a la
    // persona entera y quedaria el fondo sin nadie adelante.
    confirmacionMinima: 0.5,
  },

  // El sostenido: como se elige un objeto sin tocar nada.
  //
  // El plazo es el equilibrio entre elegir sin querer al pasar la mano (corto de
  // mas) y cansar el brazo (largo de mas). La catedra pidio mas "tiempo de
  // carga": con tres segundos la eleccion se siente deliberada, hay tiempo de
  // sacar la mano al ver que se llena el anillo equivocado, y el brazo lo
  // aguanta porque el carrusel se detiene apenas empieza.
  eleccion: {
    msParaElegir: 3000,

    // Cuanto se le perdona a la deteccion antes de empezar a vaciar el anillo.
    // NO es un detalle: la deteccion de manos se pierde varios cuadros por
    // segundo con la mano de costado o mal iluminada, y como vaciar es mas
    // rapido que llenar, sin gracia un 25% de cuadros perdidos convertia 1,5 s
    // de sostenido en doce. Con 250 ms se absorbe cualquier parpadeo real y
    // solo una mano que se fue de verdad hace bajar el anillo.
    msDeGracia: 250,

    // Pasada la gracia, el progreso NO se borra de golpe: se vacia en este
    // tiempo. Mas rapido que llenarse, para que un roce no valga por una
    // eleccion, pero no instantaneo: con la carga mas lenta, un anillo que se
    // vaciaba en 600 ms se leia como un corte.
    msDeOlvido: 1000,

    // Que tan generoso es el blanco, en radios del objeto. Es mas facil
    // disfrutar un blanco que perdona que uno exacto que te hace errar.
    radioFactor: 1.4,
  },

  // Como se ve la carga del sostenido. UN SOLO COLOR para las doce —el de los
  // nombres de MAITE— y transparencia en cada parte, que es lo que pidio
  // explorar la catedra: `pista` es la opacidad del anillo completo de atras,
  // `trazo` la del que avanza, `brillo` cuanto resplandece y `relleno` la del
  // disco que se llena detras del objeto (0 lo apaga). Las otras opciones que
  // se miraron estan andando en herramientas/colores.html.
  carga: {
    color: DORADO,
    pista: 0.22,
    trazo: 0.9,
    brillo: 0.7,
    relleno: 0.26,
    // El disco, en radios del objeto: un poco mas grande, para que se vea
    // alrededor, y mas chico que el anillo.
    radioDelDisco: 1.12,
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

    // El tamaño de cada objeto, en anchos de hombros. Era 0,22: en la pantalla
    // de 47" se veian chicos. El tope no es este numero sino la cuerda entre
    // vecinos (aireEntreObjetos): en un espejo vertical doce no entran mas
    // grandes en 1080 px de ancho —unos 190 px, diez centimetros—, y en
    // apaisado llegan a lo que se pide aca.
    radioObjetoFactor: 0.32,

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
    ruta: 'comun/humo.mp4',
    opacidad: 0.95,

    // Fraccion del estado HUMO que tarda en espesarse. El resto lo pasa tapando.
    fraccionDeEntrada: 0.55,

    // Hasta donde se espesa en el ENGANCHE, mientras se confirma que la persona
    // se quedo. Arranca del humo del reposo y el HUMO sigue desde aca: es una
    // sola niebla que se espesa, no un humo que se va y otro que llega.
    enEnganche: 0.6,

    // Lo mas que cambia el humo que se ve, por segundo. Las curvas de cada
    // estado son mas lentas y se siguen igual; esto solo pone tope a los saltos
    // de una a otra —alguien que se va en pleno enganche—, que se cortaban.
    velocidad: 1.2,

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

    // La foto entra entera (los objetos estan pintados adentro), y en una
    // pantalla de otra proporcion —la notebook— no la llena. Lo que queda libre
    // es la misma foto agrandada, desenfocada y oscurecida: la escena que sigue
    // fuera de foco, no una banda negra. `desenfoque` es el radio en fraccion
    // del lado corto de la pantalla; `brillo`, cuanto queda de su luz. En el
    // espejo vertical la foto llena la pantalla y esto no se dibuja.
    relleno: { desenfoque: 0.035, brillo: 0.5 },

    // Donde se apoya el objeto cuando el fondo no declara su `lugar`:
    // normalizado a la imagen, arriba a la izquierda, lejos de la cara y del
    // nombre. `escala` es el diametro como fraccion del ancho de la imagen.
    // Justo debajo de la franja del cartel de las fichas, con aire para crecer
    // mientras se lee: mas arriba quedaria debajo del cartel.
    lugarPorDefecto: { x: 0.18, y: 0.28, escala: 0.20 },

    // Y donde esperan los otros cuatro objetos cuando el fondo no declara sus
    // `escondites` —el respaldo vectorial, una carrera sin fondos—: forman el
    // arco en herradura que rodea a la persona (arriba a la derecha, en la
    // cima sobre la cabeza, y a los dos costados a la altura del pecho/hombros).
    // tests/integracion/fondos.test.js y fichas.test.js la vigilan con las doce
    // ingenierias.
    esconditesPorDefecto: [
      { x: 0.82, y: 0.28, escala: 0.20 },
      { x: 0.50, y: 0.20, escala: 0.20 },
      { x: 0.15, y: 0.48, escala: 0.20 },
      { x: 0.85, y: 0.48, escala: 0.20 },
    ],

    // Franja de arriba del lienzo reservada para el cartel de lectura de las fichas.
    franjaCartel: 0.14,

    // Donde esta la persona, normalizado al espejo vertical: la cabeza y los
    // hombros. Ningun objeto del fondo va ahi —la catedra pidio la periferia,
    // para que no coincidan con la imagen de la persona—.
    // tests/integracion/fondos.test.js lo vigila con el catalogo real, y
    // herramientas/fondos.html la dibuja para elegir lugares mirando.
    zonaDeLaPersona: [
      { x0: 0.30, x1: 0.70, y0: 0.26, y1: 0.50 }, // la cabeza
      { x0: 0.25, x1: 0.75, y0: 0.50, y1: 1.0 }, // los hombros y el cuerpo
    ],

    // Margen minimo del objeto apoyado al borde del lienzo, en radios y desde
    // el centro (1 es tocar el borde). Solo actua cuando el recorte del fondo
    // deja el lugar fuera de la pantalla: las fotos se preparan para el espejo
    // vertical, y en un monitor apaisado —desarrollo— la franja de arriba,
    // donde van los lugares, queda recortada. En el espejo no mueve nada.
    margenDelLugar: 1.25,

    // En una pantalla mas ancha que alta —la notebook donde se desarrolla— la
    // composicion vertical entra achicada a la altura de la pantalla, y los
    // objetos, medidos contra ella, se veian chiquitos con lugar de sobra a los
    // costados de la persona. Ahi crecen este factor; en el espejo vertical no
    // cambia nada. El tope es que los blancos de la mano de los dos de cada
    // costado no se toquen: tests/integracion/fondos.test.js lo vigila.
    agrandarEnApaisado: 1.25,

    // El halo debajo del objeto apoyado, en el color de la paleta. Lo presenta
    // sobre cualquier fondo, foto o escena vectorial, sin pedirle a cada imagen
    // que tenga una mesa justo ahi.
    haloDelLugar: 0.3,

    // La flotacion del objeto apoyado: `amplitud` en radios del objeto. Poca a
    // proposito: tiene que leerse vivo, no competir con la persona.
    flotar: { amplitud: 0.08, periodoMs: 3200 },

    // Lo que tardan la flotacion y el halo en entrar cuando el objeto aterriza.
    // Llega volando sin ninguno de los dos: aparecer enteros en un cuadro era un
    // salto justo en el momento mas mirado.
    msDeAterrizaje: 400,

    // Cuanto se espera a cada fondo con movimiento antes de darlo por perdido y
    // seguir con su foto. Los videos se cargan DESPUES de que el espejo arranco
    // y de a uno, asi que este tope no retrasa el arranque: solo evita que un
    // archivo que nunca contesta deje la cola de descargas trabada para siempre
    // y las carreras siguientes sin su video.
    msParaCargarVideo: 8000,
  },

  // Los otros objetos de la ingenieria, escondidos en el fondo.
  escondidos: {
    // Menos halo que el del carrusel: estan integrados al fondo, no encima.
    // Algo igual, porque un objeto oscuro en un rincon oscuro no lo encuentra
    // nadie.
    halo: 0.18,

    // El halo del objeto que se esta leyendo, sea escondido o el que llego
    // volando: asi se sabe de cual habla la ficha.
    haloAlLeer: 0.45,

    // El pequeño movimiento que pidio la catedra para que se los pueda
    // identificar: se mecen despacio, cada uno a su ritmo —`variacion` mas
    // lento que el anterior—. Mas rapido o mas amplio se lee como un aviso y
    // compite con la persona.
    balanceo: { grados: 6, amplitud: 0.05, periodoMs: 4400, variacion: 0.17 },

    // Cuanto crece el objeto que se esta describiendo, en fraccion del radio,
    // y cuanto se calma su vaiven mientras se lee su ficha.
    resalte: 0.14,
    calmaAlLeer: 0.7,
  },

  // Los objetos que viven ADENTRO de la foto: PINTADOS en los fondos generados
  // (herramientas/escenas.py) o FOTOGRAFIADOS en una foto real
  // (herramientas/ubicar.py). No hay PNG que dibujar encima: el objeto ya se ve
  // en la escena. Lo que se calibra aca es como se lo saca de ahi cuando la
  // mano pasa por arriba —el pintado, recortado de la foto con su mascara; el
  // fotografiado, con su propio PNG calzado encima—.
  recortes: {
    // Cuanto crece el objeto levantado, y cuanto se ilumina. Crece desde su
    // propio centro: asi se separa del hueco que deja sin correrse de lugar.
    // Poco a proposito —es un objeto de la escena, no un icono—, pero lo justo
    // para que no se confunda con su propio agujero, que tiene su misma forma.
    crecer: 1.16,
    brillo: 0.18,

    // El FOTOGRAFIADO no crece. La foto sigue debajo con el mismo objeto, y un
    // grupo de cosas —en Química, los tubos, el matraz y la botella— agrandado
    // desde su centro deja asomar a cada una al costado de su copia: se ven
    // dobles. Se ilumina en su lugar exacto, con el mismo `brillo`, y en vez de
    // crecer se despega con un `resplandor` del dorado de la paleta que sigue
    // su silueta: solo con el brillo, sobre una foto clara, casi no se notaba.
    // `desenfoque` es el ancho del resplandor, en fraccion del lado corto del
    // objeto en pantalla, y `resplandor` su opacidad con la mano encima.
    fotografiado: { crecer: 1, resplandor: 0.9, desenfoque: 0.05 },

    // El resplandor que lo delata mientras nadie lo toca. Reemplaza al vaiven
    // de los objetos sueltos: un objeto pintado adentro de la foto no se puede
    // mecer. `halo` es el medio del latido y `amplitud` cuanto se abre a cada
    // lado; `variacion` hace que cada uno lata a su ritmo, porque cinco al
    // unisono se leen como una animacion pegada encima.
    //
    // Muy tenue: si se leyera como un boton alrededor del objeto volveriamos al
    // sticker que estos fondos existen para sacar.
    latido: { halo: 0.1, amplitud: 0.55, periodoMs: 4600, variacion: 0.19 },

    // El que se esta leyendo late fijo, sin respirar: ya se sabe cual es.
    haloAlLeer: 0.3,

    // Lo que tarda el PNG que llego volando en fundirse con el objeto que ya
    // estaba pintado en su lugar. Los dos no son identicos, asi que dejar de
    // dibujarlo de golpe al aterrizar seria un salto en el cuadro mas mirado.
    msDeFusion: 450,
  },

  // La ficha de cada objeto del fondo: al pasar la mano por encima se abre su
  // nombre y una descripcion corta.
  //
  // Abrir pide un momento y cerrar pide otro mas largo, igual que la presencia
  // y el sostenido: una ficha que se abre al primer cuadro se abre con cada
  // mano que pasa camino a otro lado, y una que se cierra al primero parpadea
  // con cada deteccion perdida y no deja terminar de leer.
  fichas: {
    msParaMostrar: 300,
    msDeGracia: 900,
    msDeEntrada: 450,
    msDeSalida: 700,

    // Lo que tarda en pasar adelante de la persona el objeto que tiene la mano
    // encima. Corto a proposito: detras, la mano lo tapa y la persona siente
    // que lo atraviesa. Un fundido y no un corte igual: nada aparece de golpe.
    msDelante: 150,

    // El blanco de la mano, en radios del objeto. Los objetos del fondo son
    // grandes y los dos de cada costado van uno arriba del otro: con un blanco
    // mas generoso los dos se tocaban y, yendo a buscar el de abajo, se abria el
    // de arriba. tests/integracion/fondos.test.js exige que los blancos de un
    // mismo fondo no se toquen.
    radioFactor: 1.2,

    // Un escondido se puede leer recien cuando se ve a medias: abrir la ficha
    // de algo que todavia no aparecio seria hablar de nada.
    alfaParaLeer: 0.5,

    // La letra de la ficha, en fraccion del tamaño de frase de la pantalla
    // (unos 43 px con 1080 de lado corto): `texto` la descripcion y `titulo` el
    // nombre. Es legibilidad a dos metros en la pantalla de 47" del stand: la
    // descripcion queda en 36 px, unos 2 cm de letra, parada o acostada (antes
    // eran 32 px en el espejo y 18 en apaisado). Mas grande ya no entra: con
    // 37 px las fichas de la foto de Quimica, acostada, bajaban hasta el nombre
    // tapando un objeto. Si una no entrara, achica la letra sola, y
    // tests/integracion/fichas.test.js avisa.
    tipografia: { texto: 0.84, titulo: 1.25 },

    // La ficha que va DEBAJO de su objeto (los que viven adentro de la foto):
    // su ancho en fraccion del lado corto de la pantalla, y el aire entre el
    // objeto y el cartel en radios del objeto. El ancho es el compromiso: mas
    // angosta parte la descripcion en seis renglones, mas ancha le tapa el
    // objeto vecino. tests/integracion/fichas.test.js exige las dos cosas con
    // el catalogo real.
    anchoDebajo: 0.44,
    huecoDebajo: 0.3,

    // Hasta donde puede irse esa ficha con la letra pedida, en radios del
    // objeto desde su centro, cuando ninguno de sus sitios de siempre queda
    // libre (disponerFichaDebajo): mas lejos ya parece la ficha del vecino, y
    // conviene achicar la letra para quedar a su lado. Por debajo del 2,2 con
    // el que tests/integracion/fichas.test.js mide que este pegada.
    distanciaDebajo: 2,
  },

  // El puente con MAITE. El espejo anota que carrera se eligio en su propio
  // servidor (/estado.json) y MAITE lo lee para que las tablets muestren a la
  // gente de esa ingenieria. `url` vacia = el mismo servidor que sirve el espejo.
  //
  // El espejo NO depende de esto: si MAITE no esta levantado, no contesta o
  // tarda, la experiencia sigue igual y lo unico que queda es un aviso en la
  // consola. En false ni se intenta.
  maite: {
    activo: true,
    url: '',
    tiempoLimiteMs: 1500,
  },

  // Las nubes son el estado de reposo del espejo: cubren la pantalla cuando no
  // hay nadie, se quedan mientras el humo se espesa al detectar a alguien, se
  // apartan hacia los lados con la eleccion —junto con el humo— y vuelven por el
  // mismo camino en el cierre. Se abren UNA sola vez: apartarse al detectar a la
  // persona y que el humo tapara todo otra vez se leia como nubes que se iban y
  // volvian.
  niebla: {
    cantidad: 26, // jirones en pantalla
    agitacionHumo: 3, // cuanto se aceleran los jirones mientras se espesa el humo
    velocidades: {
      abrir: 0.8, // fraccion por segundo: ~1,2 s, al paso del humo que se disipa
      cerrar: 0.34, // acompaña los tres segundos del estado de cierre
    },

    // El espejo duerme —desenfocado y oscurecido— mientras hay niebla, y se
    // despierta con la eleccion, cuando se abren las nubes: de a poco, en
    // `msParaDespertar`, como el humo que se disipa. Vuelve a dormirse en el
    // reposo, en `msParaDormirse`. `desenfoque` en pixeles; `brillo`, cuanto
    // queda de su luz dormido.
    espejoDormido: { desenfoque: 10, brillo: 0.45, msParaDespertar: 1400, msParaDormirse: 1200 },
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

  // El regulador cambia entre perfiles solo cuando el equipo sostiene un mal o
  // buen rendimiento. La cara nunca baja tanto como para perder presencia; lo
  // que se recorta primero son manos y pose, que son los modelos mas costosos.
  rendimiento: {
    fpsParaBajar: 27,
    fpsParaSubir: 35,
    msParaBajar: 5000,
    msParaSubir: 10000,
    ventanaMs: 2000,
    perfiles: [
      { nombre: 'completo', rostro: 22, manos: 34, manosConFondo: 12, pose: 12, poseConFondo: 20 },
      { nombre: 'equilibrado', rostro: 18, manos: 24, manosConFondo: 10, pose: 10, poseConFondo: 16 },
      { nombre: 'seguro', rostro: 16, manos: 16, manosConFondo: 8, pose: 8, poseConFondo: 12 },
    ],
  },

  operacion: {
    recargaCadaMs: 4 * 60 * 60 * 1000,

    // En modo demo (tecla D) el puntero hace de mano: sin camara se puede
    // elegir sosteniendo el mouse sobre un objeto y abrir las fichas pasandolo
    // por encima. Es el radio de esa mano, en pixeles.
    radioDelPuntero: 70,
  },
};

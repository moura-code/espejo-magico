// Cableado de la experiencia. Aca se juntan todos los modulos anteriores.
//
// Este archivo no tiene logica propia: decide QUE modulo habla con cual y en
// que orden se dibuja. Todo lo que se puede probar vive en otro lado.

import { CONFIG } from './config.js';
import { cargarContenido, objetoDeCarrera, fondoActivo } from './contenido.js';
import { crearBanco, cargarImagenDelNavegador } from './imagenes.js';
import { abrirCamara, crearReintentador, dormir } from './camara.js';
import { crearDetectorMediaPipe, crearFuenteSintetica } from './rostro.js';
import { crearDetectorDeManosMediaPipe } from './manos.js';
import { crearDetectorDePoseMediaPipe } from './pose.js';
import { crearFiltroRostro, crearFiltroDeManos, crearHisteresis } from './suavizado.js';
import { crearSorteo } from './sorteo.js';
import { crearMaquina, ESTADOS } from './maquina-estados.js';
import { crearEleccion } from './eleccion.js';
import { crearTablero } from './tablero.js';
import { crearSilueta } from './silueta.js';
import { lugarEnPantalla, posicionEnVuelo, flotacion } from './vuelo.js';
import { crearPuente } from './maite.js';
import { alfaDeHumo } from './humo.js';
import { cargarVideoDelNavegador, crearBancoDeVideos } from './videos.js';
import {
  crearNiebla,
  objetivoDeNiebla,
  acercarNiebla,
  calcularTransicionEscena,
} from './niebla.js';
import { figurasDisponibles } from './figuras.js';
import { crearBancoDeEscenarios } from './escenarios.js';
import {
  calcularDisposicion,
  calcularRecorteVisible,
  calcularRectanguloVideo,
  dibujarVideoEspejado,
  dibujarFondo,
  dibujarPersonaRecortada,
  dibujarObjeto,
  dibujarObjetoApoyado,
  dibujarAnilloDeProgreso,
  dibujarManos,
  dibujarPersona,
  dibujarNombreDeCarrera,
  dibujarHumo,
  dibujarInvitacion,
  dibujarConsigna,
  TITULO_SOLO,
  PESO_TITULO,
} from './escena.js';
import { instalarOperacion } from './operacion.js';

// ---------- lienzos ----------
// La niebla va en su propia capa para componer todos los jirones laterales sin
// alterar el video ni los objetos que quedan debajo. La persona va en otra
// porque recortarla contra la silueta necesita dos pasadas, y hacerlas sobre el
// lienzo principal se llevaria puesto el fondo que ya esta dibujado.
const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');
const capaNiebla = document.createElement('canvas');
const ctxNiebla = capaNiebla.getContext('2d');
const capaPersona = document.createElement('canvas');
const ctxPersona = capaPersona.getContext('2d');
const persona = { canvas: capaPersona, ctx: ctxPersona };

let disposicion = calcularDisposicion(1, 1);

function ajustar() {
  lienzo.width = capaNiebla.width = capaPersona.width = window.innerWidth;
  lienzo.height = capaNiebla.height = capaPersona.height = window.innerHeight;
  disposicion = calcularDisposicion(lienzo.width, lienzo.height);
}
ajustar();
window.addEventListener('resize', ajustar);

// Lienzo de analisis. Los detectores NO miran el cuadro completo de la camara:
// miran exactamente el pedazo que se ve en pantalla, redibujado aca. Con una
// camara apaisada en un espejo vertical eso es un tercio del ancho, y ese tercio
// es lo unico que el visitante ve: analizar el resto gastaba dos tercios de la
// resolucion del modelo en pixeles invisibles, y es lo que ponia el limite de a
// que distancia se reconoce una cara.
const lienzoAnalisis = document.createElement('canvas');
const ctxAnalisis = lienzoAnalisis.getContext('2d');

function aviso(texto) {
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = '#fff';
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(texto, lienzo.width / 2, lienzo.height / 2);
  ctx.textAlign = 'start';
}
aviso('cargando…');

// ---------- contenido ----------
const contenido = await cargarContenido({ figurasValidas: figurasDisponibles() });
const banco = crearBanco({ cargar: cargarImagenDelNavegador, raiz: '/contenido/' });
const informe = await banco.precargar(contenido.todasLasImagenes());
if (informe.faltantes.length > 0) {
  console.warn(
    `Faltan ${informe.faltantes.length} de ${informe.total} imagenes. Se dibujan figuras del color de la carrera:`,
    informe.faltantes,
  );
}

// Los fondos que se mueven. NO se esperan aca: se cargan al final, con el bucle
// ya andando, y hasta que llegan se ve la foto del mismo fondo. Un video pesa
// mil veces mas que un PNG y nada de la experiencia depende de el.
const videosDeFondo = crearBancoDeVideos({
  cargar: (ruta) => cargarVideoDelNavegador(ruta, { msMaximos: CONFIG.fondo.msParaCargarVideo }),
  raiz: '/contenido/',
});

const jugables = contenido.idsJugables();
if (jugables.length === 0) {
  // Sin ninguna carrera con par en MAITE no hay nada que ofrecer. Se cae a todo
  // el catalogo: el espejo anda solo y las tablets se quedan en humo, que es
  // mucho mejor que una pantalla vacia el dia del evento.
  console.warn('Ninguna carrera tiene "maite" en carreras.json: se ofrecen todas.');
}

// EL LIENZO NO DISPARA LA CARGA DE UNA FUENTE. A diferencia del DOM, `ctx.font`
// con una familia que todavia no cargo no la pide: cae en silencio a la del
// sistema y sigue como si nada. Sin esperarla aca, el espejo arranca con la
// tipografia equivocada durante los primeros segundos y nadie lo nota — o peor,
// se nota el dia del evento, cuando el nombre de la carrera cambia de forma a
// mitad de una sesion.
//
// Es un archivo local de 30 kB: la espera es imperceptible. Y si faltara, el
// respaldo de espejo.html (Georgia) se dibuja igual.
try {
  await document.fonts.load(`${PESO_TITULO} 64px ${TITULO_SOLO}`);
  if (!document.fonts.check(`${PESO_TITULO} 64px ${TITULO_SOLO}`)) {
    console.warn(`Tipografía ${TITULO_SOLO} no disponible: se dibuja con el respaldo.`);
  }
} catch (error) {
  console.warn('No se pudo cargar la tipografía:', error?.message ?? error);
}

// El humo es un agregado opcional: si el video falta o el navegador no lo puede
// reproducir, el espejo arranca igual y lo unico que se pierde es la transicion.
let videoDeHumo = null;
try {
  videoDeHumo = await cargarVideoDelNavegador(`/contenido/${CONFIG.humo.ruta}`, {
    msMaximos: CONFIG.humo.msParaCargar,
  });
} catch (error) {
  console.warn('Humo no disponible:', error?.message ?? error);
}

// ---------- rostro ----------
let modo = 'camara';
let estadoDeCamara = { lista: false };

const camara = crearReintentador({
  abrir: () =>
    abrirCamara({
      ancho: CONFIG.deteccion.anchoCamara,
      alto: CONFIG.deteccion.altoCamara,
      obtenerMedia: (pedido) => navigator.mediaDevices.getUserMedia(pedido),
      // Cuando la pista muere, el reintentador vuelve a abrir solo. `camara` ya
      // esta asignada para cuando esto se ejecuta: la camara tarda en caerse.
      alPerder: () => camara.perdida(),
    }),
  reintentoMs: 5000,
  alEstado: (estado) => {
    estadoDeCamara = estado;
    if (!estado.lista) console.warn('camara:', estado.error);
  },
  dormir,
});

let detector;
try {
  detector = await crearDetectorMediaPipe({
    base: '/vendor/mediapipe',
    indices: CONFIG.deteccion.indices,
    indicesSinIris: CONFIG.deteccion.indicesSinIris,
    factorRadio: CONFIG.deteccion.factorRadio,
    ventanaConfianza: CONFIG.deteccion.ventanaConfianza,
  });
} catch (error) {
  console.error(error);
  aviso('MediaPipe no cargó — mirá la consola (F12)');
  throw error;
}

let detectorDeManos = null;
try {
  detectorDeManos = await crearDetectorDeManosMediaPipe({
    base: '/vendor/mediapipe',
    maximo: CONFIG.manos.maximo,
    factorRadio: CONFIG.manos.factorRadio,
    radioMinimoEnPalmas: CONFIG.manos.radioMinimoEnPalmas,
  });
} catch (error) {
  // Sin manos no se puede elegir. El espejo sigue andando y el tope de la
  // eleccion sortea una carrera solo, asi que nadie se queda sin nada — pero es
  // una falla grave y tiene que verse en el panel del stand.
  console.warn('Deteccion de manos no disponible: no se va a poder elegir.', error);
}

let detectorDePose = null;
try {
  detectorDePose = await crearDetectorDePoseMediaPipe({
    base: '/vendor/mediapipe',
    segmentacion: CONFIG.pose.segmentacion,
  });
} catch (error) {
  console.warn('Deteccion de pose no disponible:', error);
}

const sintetica = crearFuenteSintetica();
const filtro = crearFiltroRostro(CONFIG.suavizado);
const filtroDeManos = crearFiltroDeManos(CONFIG.manos.suavizado);
// Dos histeresis sobre dos señales distintas. `histeresis` mira rostro O pose:
// es lo que SOSTIENE una sesion, y por eso los hombros alcanzan cuando la cara
// gira. `histeresisDeRostro` mira solo la cara: es lo que ARRANCA una sesion, y
// tiene que ser la mas exigente de las dos. Un falso positivo suelto destaparia
// el espejo frente a un sillon vacio durante varios segundos.
const histeresis = crearHisteresis(CONFIG.presencia);
const histeresisDeRostro = crearHisteresis(CONFIG.presencia);

// ---------- logica ----------
// Se ofrecen TODAS las carreras jugables, en el carrusel. El sorteo sigue
// existiendo por el orden: la bolsa entrega una permutacion fresca por sesion,
// asi dos visitantes seguidos no ven el anillo igual, y la primera de una
// sesion nunca repite la ultima de la anterior (que es la que muestra la red
// de la fila si nadie agarra nada).
const ofrecibles = jugables.length > 0 ? jugables : contenido.ids;
const sorteo = crearSorteo({ ids: ofrecibles });
const maquina = crearMaquina({
  tiempos: CONFIG.tiempos,
  sortearOpciones: () => sorteo.siguientes(ofrecibles.length),
  manual: CONFIG.avance.manual,
});
const eleccion = crearEleccion(CONFIG.eleccion);
const tablero = crearTablero(CONFIG.tablero);
const silueta = crearSilueta({ crearLienzo: () => document.createElement('canvas') });

// Las escenas vectoriales de cada ingenieria, el respaldo cuando falta el PNG
// del fondo. Se dibuja una sola vez por carrera y despues es un drawImage, igual
// de barato que la imagen a la que reemplaza.
const escenarios = crearBancoDeEscenarios({
  crearLienzo: (ancho, alto) => {
    const lienzoEscena = document.createElement('canvas');
    lienzoEscena.width = ancho;
    lienzoEscena.height = alto;
    return { lienzo: lienzoEscena, ctx: lienzoEscena.getContext('2d') };
  },
});
const puente = crearPuente(CONFIG.maite);
const niebla = crearNiebla({ cantidad: CONFIG.niebla.cantidad });

// La niebla arranca cerrada. Su apertura cambia de forma continua aunque la
// maquina salte de estado, y solo desplaza nubes hacia los lados.
let nieblaActual = { apertura: 0 };

// Las que se ofrecen, con el objeto que representa a cada carrera ya
// sorteado. Se arman una sola vez por sesion: sortear el objeto por cuadro haria
// que la imagen cambiara sola mientras la persona la mira.
let ofrecidos = [];
let blancos = [];
// La ingenieria que se esta mostrando ahora. La fija el evento `mira` de la
// maquina y no se recalcula por cuadro: `objetoDeCarrera` sortea cuando la
// carrera no declara representante, asi que resolverla en cada cuadro hacia
// parpadear el objeto entre PNG distintos.
let mostrada = null;
// El objeto con el que se agarro la carrera mostrada. Sale de `ofrecidos`, que
// ya sorteo uno por sesion: resolverlo por cuadro haria parpadear el PNG.
let objetoMostrado = null;
// De donde salio ese objeto: la posicion de su ranura en el cuadro en que se
// agarro. Se captura una vez, porque el carrusel sigue girando mientras el
// objeto vuela y el origen no puede irse con el. Null cuando no habia ranura a
// la vista: la red de la fila, o una carrera forzada por teclado.
let origenDelVuelo = null;

function prepararOfrecidos(opciones) {
  ofrecidos = opciones
    .map((id) => {
      const carrera = contenido.obtener(id);
      return carrera ? { id, carrera, definicion: objetoDeCarrera(carrera) } : null;
    })
    .filter(Boolean);
}

function atender(salida, ahora) {
  for (const evento of salida.eventos) {
    // Cambio la ingenieria que se esta mostrando. Es lo unico que le avisa a
    // MAITE, y la maquina ya se encargo de que no se repita: agarrar dos veces
    // el mismo objeto no manda dos veces, asi las tablets no parpadean.
    if (evento.tipo === 'mira') {
      const carrera = contenido.obtener(evento.carrera);
      mostrada = carrera ?? null;
      objetoMostrado =
        ofrecidos.find((ofrecido) => ofrecido.id === evento.carrera)?.definicion ??
        objetoDeCarrera(carrera);
      const ranura = blancos.find((blanco) => blanco.id === evento.carrera);
      origenDelVuelo =
        ranura && ranura.alfa > 0 ? { x: ranura.x, y: ranura.y, radio: ranura.radio } : null;
      puente.carrera(carrera?.maite ?? null);
      continue;
    }

    if (evento.tipo !== 'entra') continue;

    if (evento.estado === ESTADOS.HUMO) {
      prepararOfrecidos(salida.opciones);
      eleccion.reiniciar();
      tablero.reiniciar();
      mostrada = null;
      objetoMostrado = null;
      origenDelVuelo = null;
    }


    if (evento.estado === ESTADOS.ATRACCION) {
      ofrecidos = [];
      blancos = [];
      mostrada = null;
      objetoMostrado = null;
      origenDelVuelo = null;
      eleccion.reiniciar();
      tablero.reiniciar();
      puente.humo();
    }
  }
  return salida;
}

/**
 * Copia al lienzo de analisis lo que se ve en pantalla. Devuelve el lienzo, o
 * null si el video todavia no reporta tamaño.
 */
function prepararAnalisis(video, rectangulo) {
  const recorte = calcularRecorteVisible(
    video.videoWidth,
    video.videoHeight,
    rectangulo,
    disposicion.ancho,
    disposicion.alto,
  );
  if (!recorte) return null;

  const alto = CONFIG.deteccion.altoAnalisis;
  const ancho = Math.max(1, Math.round((alto * recorte.sAncho) / recorte.sAlto));
  if (lienzoAnalisis.width !== ancho || lienzoAnalisis.height !== alto) {
    lienzoAnalisis.width = ancho;
    lienzoAnalisis.height = alto;
  }

  ctxAnalisis.drawImage(
    video,
    recorte.sx,
    recorte.sy,
    recorte.sAncho,
    recorte.sAlto,
    0,
    0,
    ancho,
    alto,
  );
  return lienzoAnalisis;
}

const mezclar = (desde, hasta, t) => desde + (hasta - desde) * t;

// ---------- bucle ----------
let anterior = performance.now();
let ultimaDeteccion = 0;
let rostro = null;
let crudoRostro = null;
let pose = null;
let hayPersona = false;
let hayRostroEstable = false;
let manos = [];
let manosSuaves = [];
let verMalla = false;
let lienzoDeSilueta = null;
let ultimaDeteccionManos = 0;
let ultimaDeteccionPose = 0;
let estadoAnterior = ESTADOS.ATRACCION;
let progresoDeEleccion = 0;
let sobreQueBlanco = null;
const intervaloDeteccion = 1000 / CONFIG.deteccion.fpsObjetivo;
const intervaloManos = 1000 / CONFIG.manos.fps;
const intervaloDibujo = 1000 / CONFIG.render.fpsMaximo - CONFIG.render.margenMs;

// La silueta cuesta una lectura de la GPU a la CPU: solo se arma cuando hay un
// fondo que meterle atras a la persona, que ahora depende de si se esta
// mostrando una ingenieria y no del estado solo.
const conFondo = (estado, hayCarrera) =>
  Boolean(hayCarrera) && (estado === ESTADOS.EXPLORACION || estado === ESTADOS.CIERRE);

function cuadro(ahora) {
  requestAnimationFrame(cuadro);

  // Tope de cuadros. Se saltea el dibujo sin tocar `anterior`, asi el dt se
  // acumula solo.
  if (ahora - anterior < intervaloDibujo) return;

  operacion.registrarCuadro(ahora);

  // Se acota el dt: si el navegador se traba un instante, un salto grande
  // haria saltar la niebla de golpe.
  const dt = Math.min(0.05, (ahora - anterior) / 1000);
  anterior = ahora;

  const camaraLista = camara.obtener();
  const video = camaraLista?.video ?? null;

  // Donde se dibuja el video. De aca sale tambien el recorte que se analiza, y
  // por eso los puntos caen sobre la cara: los dos caminos —lo que se ve y lo
  // que se analiza— salen del mismo rectangulo. Si alguno se calcula por su
  // cuenta, los marcadores se van de la cara. Ya nos paso una vez.
  const rectangulo = video
    ? calcularRectanguloVideo(
        video.videoWidth,
        video.videoHeight,
        disposicion.ancho,
        disposicion.alto,
      )
    : { x: 0, y: 0, ancho: disposicion.ancho, alto: disposicion.alto };

  // --- deteccion ---
  // Las manos corren en su propio reloj, mas rapido que la cara: se mueven diez
  // veces mas rapido y a 22 cuadros por segundo el blanco va siempre atras de la
  // mano de verdad. Solo se buscan mientras la eleccion sigue abierta, que es el
  // unico momento en que sirven, porque es el detector mas caro del cuadro. Con
  // la ingenieria ya elegida no hay nada que agarrar: se apaga y esos
  // milisegundos se los queda la silueta, que es lo que se mira a partir de ahi.
  const poseSirve = detectorDePose && video && modo !== 'demo';
  const manosSirven =
    detectorDeManos &&
    video &&
    modo !== 'demo' &&
    estadoAnterior === ESTADOS.EXPLORACION &&
    !mostrada;

  // La mascara ES la imagen mientras hay fondo: a 12 cuadros por segundo el
  // borde de la silueta va atras del cuerpo y se ve el fondo pegado al hombro.
  const intervaloPose =
    1000 / (conFondo(estadoAnterior, mostrada) ? CONFIG.pose.fpsConFondo : CONFIG.pose.fps);

  const tocaRostro = ahora - ultimaDeteccion >= intervaloDeteccion;
  const tocaPose = poseSirve && ahora - ultimaDeteccionPose >= intervaloPose;
  const tocaManos = manosSirven && ahora - ultimaDeteccionManos >= intervaloManos;

  // El recorte se prepara UNA vez por cuadro y solo si alguno de los tres va a
  // correr: el drawImage no es gratis. Como contiene exactamente lo que se ve en
  // pantalla, los puntos que devuelven los detectores ya estan en coordenadas de
  // pantalla y el rectangulo de mapeo es la pantalla entera.
  const rectDeteccion = { x: 0, y: 0, ancho: disposicion.ancho, alto: disposicion.alto };
  const analisis =
    video && modo !== 'demo' && (tocaRostro || tocaPose || tocaManos)
      ? prepararAnalisis(video, rectangulo)
      : null;

  if (tocaRostro) {
    ultimaDeteccion = ahora;

    crudoRostro =
      modo === 'demo'
        ? sintetica.detectar(ahora, disposicion)
        : analisis
          ? detector.detectar(analisis, ahora, rectDeteccion)
          : null;

    rostro = crudoRostro ? filtro.filtrar(crudoRostro) : null;
  }

  if (tocaPose && analisis) {
    ultimaDeteccionPose = ahora;
    pose = detectorDePose.detectar(analisis, ahora, rectDeteccion);
    // La silueta cuesta una lectura de la GPU a la CPU, asi que solo se arma
    // cuando hay fondo que meterle atras a la persona.
    lienzoDeSilueta = conFondo(estadoAnterior, mostrada)
      ? silueta.actualizar(pose?.mascara)
      : null;
  } else if (!poseSirve) {
    pose = null;
    lienzoDeSilueta = null;
  }

  const habiaPresencia = hayPersona;
  hayPersona = histeresis.actualizar(Boolean(crudoRostro || pose), ahora);
  hayRostroEstable = histeresisDeRostro.actualizar(Boolean(crudoRostro), ahora);
  if (habiaPresencia && !hayPersona) {
    filtro.reiniciar();
    crudoRostro = null;
    rostro = null;
    pose = null;
    lienzoDeSilueta = null;
  }

  if (tocaManos && analisis) {
    ultimaDeteccionManos = ahora;
    // La palma que elige va filtrada: el temblor crudo la hace entrar y salir
    // del blanco varias veces por segundo y el anillo se llenaria a los saltos.
    manos = detectorDeManos.detectar(analisis, ahora, rectDeteccion);
    manosSuaves = filtroDeManos.filtrar(manos, ahora);
  } else if (!manosSirven) {
    manos = [];
    manosSuaves = [];
    filtroDeManos.reiniciar();
  }

  // --- estado ---
  const salida = atender(
    maquina.actualizar({
      puedeIniciar: hayRostroEstable,
      hayPersona,
      // Con un sostenido en curso la red de la fila espera: cerrarle la eleccion
      // a alguien que tiene la mano puesta seria robarle el gesto.
      eligiendo: progresoDeEleccion > 0,
      ahora,
    }),
    ahora,
  );

  const estado = salida.estado;
  estadoAnterior = estado;
  const carrera = salida.carrera ? contenido.obtener(salida.carrera) : null;
  const enEstadoDesde = ahora - maquina.desdeCuando();
  // El fondo tiene su propio reloj, el de la mirada: entra cuando la persona
  // agarra su objeto, no cuando cambia el estado.
  const miraDesde = maquina.miraDesdeCuando();
  const transicion = calcularTransicionEscena({
    estado,
    transcurrido: enEstadoDesde,
    desdeLaMirada: miraDesde === null ? null : ahora - miraDesde,
    tiempos: CONFIG.tiempos,
  });

  // --- tablero y eleccion ---
  // El anillo se congela apenas empieza un sostenido —ancla y giro—: si
  // siguiera a los hombros, el gesto de estirar el brazo correria el blanco de
  // abajo de la propia mano; y si siguiera girando, elegir seria perseguir un
  // objeto que se escapa. Es la pausa del carrusel que pide la catedra.
  // Se elige una sola vez: con la carrera ya puesta el carrusel deja de girar
  // ahi mismo y se apaga desvaneciendose. Girando mientras se va se leeria como
  // que todavia hay algo que agarrar.
  const eleccionAbierta = estado === ESTADOS.EXPLORACION && !salida.carrera;
  const enEleccion = estado === ESTADOS.HUMO || estado === ESTADOS.EXPLORACION;

  // Con el carrusel ya apagado no hay nada que ubicar. Seguir moviendolo son
  // doce ubicaciones y un radio por cuadro que nadie dibuja, durante hasta tres
  // minutos y justo cuando la pose subio a `fpsConFondo` y la silueta necesita
  // esos milisegundos. En el humo si se mueve aunque no se vea: llega encendido.
  const carruselALaVista = estado === ESTADOS.HUMO || transicion.objetos > 0;
  if (enEleccion && carruselALaVista && ofrecidos.length > 0) {
    const puesto = tablero.actualizar({
      pose,
      rostro,
      disposicion,
      cantidad: ofrecidos.length,
      congelar: progresoDeEleccion > 0 || Boolean(salida.carrera),
      dt,
    });

    blancos = ofrecidos.map((ofrecido, i) => ({
      ...ofrecido,
      x: puesto.ubicaciones[i].x,
      y: puesto.ubicaciones[i].y,
      radio: puesto.radioObjeto,
      alfa: puesto.ubicaciones[i].alfa,
    }));
  }

  if (eleccionAbierta) {
    // Solo se puede agarrar lo que esta entero dentro de la ventana: una
    // ranura a medio entrar todavia no es una opcion.
    const paso = eleccion.actualizar({
      manos: manosSuaves,
      objetivos: blancos.filter((blanco) => blanco.alfa === 1),
      ahora,
    });
    progresoDeEleccion = paso.progreso;
    sobreQueBlanco = paso.sobre;
    // `elegido` se repite cuadro a cuadro mientras la mano no se mueva: la
    // maquina descarta el repetido, asi que aca no hace falta recordarlo.
    if (paso.elegido) atender(maquina.mirar(paso.elegido, ahora), ahora);
  } else if (progresoDeEleccion !== 0 || sobreQueBlanco !== null) {
    // Tambien al cerrarse la eleccion, no solo al salir del estado: sin esto el
    // anillo a medio llenar del ultimo cuadro se queda dibujado, apagandose
    // junto con el carrusel encima de un objeto que ya no se puede agarrar.
    // Una sola vez, en la transicion: repetirlo cada cuadro por el resto de la
    // sesion es reiniciar lo que ya esta en cero.
    progresoDeEleccion = 0;
    sobreQueBlanco = null;
    eleccion.reiniciar();
  }

  niebla.actualizar(dt, estado === ESTADOS.HUMO ? CONFIG.niebla.agitacionHumo : 1);

  // --- dibujo ---
  ctx.clearRect(0, 0, disposicion.ancho, disposicion.alto);

  const dormido = estado === ESTADOS.ATRACCION;
  if (video) {
    dibujarVideoEspejado(ctx, video, rectangulo, disposicion, {
      desenfoque: dormido ? 10 : 0,
      brillo: dormido ? 0.45 : 1,
    });
  } else {
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
  }

  // El fondo de la carrera entra por encima del espejo y la persona se vuelve a
  // dibujar arriba, recortada contra su silueta: asi queda DENTRO de su
  // ingenieria en vez de tapada por ella.
  //
  // Sin silueta —pose perdida, GPU lenta, modelo sin cargar— el fondo se dibuja
  // igual, mas tenue y con el espejo apagado debajo. Se pierde la profundidad,
  // pero nunca queda una pantalla en negro con publico delante.
  // Donde esta el objeto agarrado en este cuadro. Se usa en dos capas: detras
  // de la persona una vez apoyado, y por delante de todo mientras vuela.
  let apoyado = null;

  // Si hay una ingenieria a la vista y cual es su fondo: UNA sola vez, porque de
  // aca salen tanto el video que suena como lo que se dibuja. En dos condiciones
  // separadas, ajustar una y no la otra deja el video sonando detras de un fondo
  // apagado. `fondo` puede ser null igual —una carrera sin candidatos—, y ahi el
  // bloque de abajo cae al color plano.
  const hayIngenieria = transicion.fondo > 0 && Boolean(carrera);
  const fondo = hayIngenieria ? fondoActivo(carrera) : null;

  // Solo suena el video del fondo que se esta mostrando. Doce decodificando a la
  // vez no los aguanta ninguna placa, y once no se ven. Se llama en cada cuadro
  // con la misma ruta: repetir la que ya suena no hace nada.
  videosDeFondo.mostrar(fondo?.video ?? null);

  if (hayIngenieria) {
    const videoDeFondo = fondo?.video ? videosDeFondo.obtener(fondo.video) : null;
    const imagenDeFondo = fondo ? banco.obtener(fondo.img) : null;
    const hayRecorte = Boolean(video && lienzoDeSilueta);

    // Orden de preferencia, el mismo que el de los objetos: el video si esta
    // cargado, la foto si no, la escena vectorial despues, y el color plano como
    // ultimo recurso. Un degradado del color no le dice a nadie que es
    // Ingenieria Quimica; un laboratorio si.
    //
    // El video es siempre una MEJORA sobre la foto, nunca un reemplazo: la
    // `img` de un fondo con movimiento es un cuadro del propio video, asi que
    // mientras no cargo se ve la misma escena quieta y no se nota el cambio.
    const escena =
      videoDeFondo ??
      imagenDeFondo ??
      escenarios.obtener(carrera.id, disposicion.ancho, disposicion.alto, carrera.color);
    const alfaDelFondo = transicion.fondo * (hayRecorte ? 1 : CONFIG.fondo.opacidadSinMascara);

    // EL RECTANGULO SALE DE QUIEN DIBUJO, no de una segunda cuenta: el objeto se
    // apoya normalizado a el, y calcularlo aparte es como se separan los dos
    // caminos. Null quiere decir que no habia nada dibujable —ni foto, ni escena,
    // ni un video con su primer cuadro— y ahi entra el color plano.
    const dibujado = dibujarFondo(ctx, escena, disposicion, alfaDelFondo);

    if (!dibujado) {
      // Ni foto ni escena: el color de la carrera. Es feo pero es legible, y el
      // nombre sigue entrando: una carrera sin fondo no rompe nada.
      ctx.save();
      ctx.globalAlpha = transicion.fondo * 0.8;
      ctx.fillStyle = carrera.color;
      ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
      ctx.restore();
    }

    // El lugar del objeto va normalizado a la imagen que se dibujo (o al
    // lienzo entero si no se dibujo ninguna), asi cae siempre en el mismo sitio
    // de la escena sin importar el recorte. Y si el recorte lo deja fuera de la
    // pantalla —un monitor apaisado con fotos preparadas para el espejo
    // vertical— lugarEnPantalla lo corre lo justo para que se vea. El origen
    // del vuelo se capturo al agarrar; sin origen, el objeto crece en su lugar.
    const rectanguloDelFondo =
      dibujado ?? { x: 0, y: 0, ancho: disposicion.ancho, alto: disposicion.alto };
    const destino = lugarEnPantalla(
      fondo?.lugar ?? CONFIG.fondo.lugarPorDefecto,
      rectanguloDelFondo,
      disposicion,
      CONFIG.fondo.margenDelLugar,
    );
    const enVuelo = posicionEnVuelo({ origen: origenDelVuelo, destino, t: transicion.vuelo });
    const aterrizo = transicion.vuelo >= 1;
    const flota = aterrizo ? flotacion(ahora, enVuelo.radio, CONFIG.fondo.flotar) : { dy: 0, giro: 0 };
    apoyado = {
      definicion: objetoMostrado,
      x: enVuelo.x,
      y: enVuelo.y + flota.dy,
      radio: enVuelo.radio,
      giro: flota.giro,
      aterrizo,
    };

    // Apoyado, va DETRAS de la persona: integrado a la escena. Si la persona se
    // inclina sobre ese punto lo tapa, que es lo correcto.
    if (aterrizo) {
      dibujarObjetoApoyado(
        ctx,
        { ...apoyado, alfa: transicion.elegido, halo: CONFIG.fondo.haloDelLugar },
        banco,
        carrera.color,
      );
    }

    if (hayRecorte) {
      ctx.save();
      ctx.globalAlpha = transicion.fondo;
      dibujarPersonaRecortada(ctx, {
        capa: persona,
        video,
        rectangulo,
        silueta: lienzoDeSilueta,
        disposicion,
      });
      ctx.restore();
    }
  }

  // Diagnostico: la malla facial completa. Si los puntos caen sobre la cara el
  // mapeo esta bien; si estan corridos, el rectangulo del video y el del mapeo
  // se separaron.
  if (verMalla && modo !== 'demo') {
    // Los puntos crudos vienen normalizados sobre el RECORTE, no sobre el cuadro
    // de la camara, asi que se mapean sobre la pantalla entera.
    dibujarPersona(ctx, pose, rostro, rectDeteccion, carrera?.color ?? '#FFD23F');
    const puntos = detector.puntosCrudos();
    if (puntos) {
      ctx.fillStyle = 'rgba(80,200,255,0.75)';
      for (const punto of puntos) {
        ctx.fillRect(
          rectDeteccion.x + (1 - punto.x) * rectDeteccion.ancho - 1,
          rectDeteccion.y + punto.y * rectDeteccion.alto - 1,
          2.5,
          2.5,
        );
      }
    }

    // Los 21 puntos de cada mano y su circulo de radio real. Si los puntos caen
    // sobre tus dedos, el problema no es la deteccion.
    ctx.fillStyle = '#FFD23F';
    ctx.strokeStyle = '#FFD23F';
    ctx.lineWidth = 2;
    for (const mano of manos) {
      for (const punto of mano.puntos ?? []) {
        ctx.fillRect(
          rectDeteccion.x + (1 - punto.x) * rectDeteccion.ancho - 2,
          rectDeteccion.y + punto.y * rectDeteccion.alto - 2,
          4,
          4,
        );
      }
      ctx.beginPath();
      ctx.arc(mano.palma.x, mano.palma.y, mano.radio, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // --- el carrusel ---
  // VA POR DELANTE DEL FONDO Y SE APAGA AL ELEGIR. Se elige una sola vez: una
  // vez que la ingenieria esta puesta, dejar los objetos girando seria ofrecer
  // algo que ya no se puede agarrar, y la primera que estire la mano y no pase
  // nada va a creer que el espejo se colgo. Se van con el vuelo del elegido, asi
  // que el anillo termina de vaciarse cuando el objeto aterriza en su lugar.
  //
  // Cada ranura se dibuja con su alfa de ventana: las que estan detras del marco
  // no se ven. El que se esta mostrando se queda con su anillo lleno mientras
  // dura el apagado: es la confirmacion de que lo que se ve atras salio de ese
  // objeto.
  if (transicion.objetos > 0) {
    for (const blanco of blancos) {
      if (blanco.alfa <= 0) continue;
      const esElMostrado = blanco.id === salida.carrera;

      // La ranura del objeto mostrado queda vacia con su anillo lleno: el
      // objeto se fue a vivir al fondo, y la marca dice cual fue.
      if (!esElMostrado) {
        dibujarObjeto(
          ctx,
          {
            definicion: blanco.definicion,
            x: blanco.x,
            y: blanco.y,
            radio: blanco.radio,
            alfa: transicion.objetos * blanco.alfa,
          },
          banco,
          blanco.carrera.color,
        );
      }

      const progresoDelAnillo = esElMostrado
        ? 1
        : blanco.id === sobreQueBlanco
          ? progresoDeEleccion
          : 0;

      if (progresoDelAnillo > 0) {
        ctx.save();
        ctx.globalAlpha = transicion.objetos * blanco.alfa;
        dibujarAnilloDeProgreso(ctx, {
          x: blanco.x,
          y: blanco.y,
          radio: blanco.radio,
          progreso: progresoDelAnillo,
          color: blanco.carrera.color,
        });
        ctx.restore();
      }
    }
  }

  // Mientras vuela, el objeto va por delante de todo: sale de su ranura, cruza
  // la pantalla y recien al aterrizar pasa detras de la persona. Va con
  // `elegido` y no con `objetos` porque el carrusel se esta apagando
  // exactamente en ese rato: con el alfa del carrusel, el objeto se
  // desvaneceria en pleno vuelo.
  if (apoyado && !apoyado.aterrizo) {
    dibujarObjeto(
      ctx,
      {
        definicion: apoyado.definicion,
        x: apoyado.x,
        y: apoyado.y,
        radio: apoyado.radio,
        alfa: transicion.elegido,
      },
      banco,
      carrera.color,
    );
  }

  // La señal de las manos: donde registra el sistema tu palma. Es lo unico que
  // le enseña al publico que puede estirarlas, y sin ella el sostenido es a
  // ciegas. Solo mientras la eleccion sigue abierta: despues las manos no hacen
  // nada, y una señal que sigue encendida promete algo que ya no pasa.
  if (eleccionAbierta) {
    dibujarManos(ctx, manosSuaves, '#ffffff', CONFIG.manos.senal);
  }

  dibujarNombreDeCarrera(ctx, carrera, disposicion, transicion.contenido);

  // El humo va encima de todo: su trabajo es justamente tapar el momento en que
  // las nubes se abren y los objetos se ponen en su lugar.
  dibujarHumo(
    ctx,
    videoDeHumo,
    disposicion,
    alfaDeHumo({ estado, transcurrido: enEstadoDesde, tiempos: CONFIG.tiempos, humo: CONFIG.humo }),
    CONFIG.humo.opacidad,
  );

  nieblaActual = acercarNiebla(
    nieblaActual,
    objetivoDeNiebla(estado),
    dt,
    CONFIG.niebla.velocidades,
  );
  if (nieblaActual.apertura < 1) {
    ctxNiebla.clearRect(0, 0, disposicion.ancho, disposicion.alto);
    niebla.dibujar(ctxNiebla, disposicion, nieblaActual);
    ctx.drawImage(capaNiebla, 0, 0);
  }

  // Aviso permanente del modo manual. No es para el operador: es para que nadie
  // llegue al dia del evento con el modo puesto sin darse cuenta.
  if (maquina.esManual()) {
    ctx.save();
    ctx.fillStyle = '#FFD23F';
    ctx.font = `600 ${Math.round(disposicion.texto.tamanoFrase * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.85;
    ctx.fillText(
      'MODO MANUAL — ESPACIO para avanzar, A para automático',
      disposicion.ancho - 24,
      36,
    );
    ctx.restore();
  }

  if (estado === ESTADOS.ATRACCION) {
    // Tambien cuando no hay camara: el publico ve la invitacion, nunca un error.
    // 700 ms era un parpadeo, no una respiracion: apurado, se leia como un
    // aviso de error mas que como una invitacion.
    dibujarInvitacion(ctx, disposicion, (Math.sin(ahora / 1400) + 1) / 2);
  }
  // La consigna ensena el gesto, y es lo unico que lo hace. Se apaga con el
  // carrusel: una vez elegida la ingenieria no hay gesto que ensenar, y dejarla
  // puesta seria pedir algo que ya no tiene efecto.
  if (estado === ESTADOS.EXPLORACION) {
    dibujarConsigna(ctx, disposicion, transicion.objetos);
  }
}

window.espejo = {
  maquina,
  contenido,
  banco,
  videosDeFondo,
  detector,
  puente,
  estadoDeCamara: () => estadoDeCamara,
  manos: () => manos,
  manosCrudas: () => detectorDeManos?.crudasDetectadas() ?? 0,
  pose: () => pose,
  poseCrudas: () => detectorDePose?.crudasDetectadas() ?? 0,
  ofrecidos: () => blancos,
  mostrada: () => mostrada,
  origenDelVuelo: () => origenDelVuelo,
  progresoDeEleccion: () => progresoDeEleccion,
  hayFondo: () => Boolean(videoDeHumo),
  modo: () => modo,
  cambiarModo: (nuevo) => {
    modo = nuevo;
    filtro.reiniciar();
  },
  alternarMalla: () => {
    verMalla = !verMalla;
  },
  // Los atajos tienen que pasar por atender(): si no, forzar una carrera con las
  // teclas no le avisa a MAITE y las tablets se quedan con la carrera anterior.
  avanzar: (ahora) => atender(maquina.avanzar(ahora), ahora),
  mirar: (id, ahora) => atender(maquina.mirar(id, ahora), ahora),
  forzarCarrera: (id, ahora) => atender(maquina.forzarCarrera(id, ahora), ahora),
  reiniciar: (ahora) => atender(maquina.reiniciar(ahora), ahora),
};

const operacion = instalarOperacion({ espejo: window.espejo, tiempos: CONFIG.operacion });

requestAnimationFrame(cuadro);

// Los fondos con movimiento, ya con el espejo andando y de a uno. Cada video que
// llega se usa desde el cuadro siguiente; los que no lleguen no se notan, porque
// la foto de ese mismo fondo ya esta puesta. Es a proposito que esto no se
// espere: un agregado opcional no puede decidir si el espejo arranca.
videosDeFondo.precargar(contenido.todosLosVideos()).then((informeDeVideos) => {
  if (informeDeVideos.faltantes.length > 0) {
    console.warn(
      `No cargaron ${informeDeVideos.faltantes.length} de ${informeDeVideos.total} fondos con movimiento. Se muestra su foto:`,
      informeDeVideos.faltantes,
    );
  }
});

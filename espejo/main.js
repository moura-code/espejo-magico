// Cableado de la experiencia. Aca se juntan todos los modulos anteriores.
//
// Este archivo no tiene logica propia: decide QUE modulo habla con cual y en
// que orden se dibuja. Todo lo que se puede probar vive en otro lado.

import { CONFIG } from './config.js';
import { cargarContenido, objetoDeCarrera } from './contenido.js';
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
import { crearPuente } from './maite.js';
import { alfaDeHumo, cargarVideoDelNavegador } from './humo.js';
import {
  crearNiebla,
  objetivoDeNiebla,
  acercarNiebla,
  calcularTransicionEscena,
} from './niebla.js';
import { figurasDisponibles } from './figuras.js';
import {
  calcularDisposicion,
  calcularRecorteVisible,
  calcularRectanguloVideo,
  dibujarVideoEspejado,
  dibujarFondo,
  dibujarPersonaRecortada,
  dibujarObjeto,
  dibujarAnilloDeProgreso,
  dibujarManos,
  dibujarPersona,
  dibujarFichaDePersona,
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
  videoDeHumo = await cargarVideoDelNavegador(`/contenido/${CONFIG.humo.ruta}`);
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
const sorteo = crearSorteo({ ids: jugables.length > 0 ? jugables : contenido.ids });
const maquina = crearMaquina({
  tiempos: CONFIG.tiempos,
  sortearOpciones: () => sorteo.siguientes(CONFIG.eleccion.cantidad),
  manual: CONFIG.avance.manual,
});
const eleccion = crearEleccion(CONFIG.eleccion);
const tablero = crearTablero(CONFIG.tablero);
const silueta = crearSilueta({ crearLienzo: () => document.createElement('canvas') });
const puente = crearPuente(CONFIG.maite);
const niebla = crearNiebla({ cantidad: CONFIG.niebla.cantidad });

// La niebla arranca cerrada. Su apertura cambia de forma continua aunque la
// maquina salte de estado, y solo desplaza nubes hacia los lados.
let nieblaActual = { apertura: 0 };

// Los cinco que se ofrecen, con el objeto que representa a cada carrera ya
// sorteado. Se arman una sola vez por sesion: sortear el objeto por cuadro haria
// que la imagen cambiara sola mientras la persona la mira.
let ofrecidos = [];
let blancos = [];
// El objeto elegido y de donde sale su viaje hacia el borde de arriba. Se fija
// UNA vez, al entrar a la revelacion: `objetoDeCarrera` sortea cuando la carrera
// no declara representante, asi que resolverlo por cuadro hacia que el objeto
// parpadeara entre PNG distintos. Se veia forzando una carrera con las teclas,
// que es el camino que no pasa por el tablero.
let elegido = null;

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
    if (evento.tipo !== 'entra') continue;

    if (evento.estado === ESTADOS.HUMO) {
      prepararOfrecidos(salida.opciones);
      eleccion.reiniciar();
      tablero.reiniciar();
      elegido = null;
    }

    if (evento.estado === ESTADOS.REVELACION) {
      const carrera = contenido.obtener(salida.carrera);
      // Donde estaba el objeto cuando lo eligieron: desde ahi viaja hasta su
      // lugar de arriba. Sin guardarlo, aparece de la nada en el borde superior
      // y se pierde la unica confirmacion visual de que lo que se eligio fue eso
      // y no otra cosa. Forzando una carrera con las teclas no hay tablero
      // detras, asi que arranca ya puesto en su lugar.
      const blanco = blancos.find((b) => b.id === salida.carrera);
      elegido = carrera && {
        definicion: blanco?.definicion ?? objetoDeCarrera(carrera),
        origen: blanco
          ? { x: blanco.x, y: blanco.y, radio: blanco.radio }
          : { ...disposicion.elegido },
      };

      puente.carrera(carrera?.maite ?? null);
    }

    if (evento.estado === ESTADOS.ATRACCION) {
      ofrecidos = [];
      blancos = [];
      elegido = null;
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

const conFondo = (estado) =>
  estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA || estado === ESTADOS.CIERRE;

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
  // mano de verdad. Solo se buscan durante la eleccion, que es el unico momento
  // en que sirven, porque es el detector mas caro del cuadro.
  const poseSirve = detectorDePose && video && modo !== 'demo';
  const manosSirven =
    detectorDeManos && video && modo !== 'demo' && estadoAnterior === ESTADOS.ELECCION;

  // La mascara ES la imagen mientras hay fondo: a 12 cuadros por segundo el
  // borde de la silueta va atras del cuerpo y se ve el fondo pegado al hombro.
  const intervaloPose =
    1000 / (conFondo(estadoAnterior) ? CONFIG.pose.fpsConFondo : CONFIG.pose.fps);

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
    lienzoDeSilueta = conFondo(estadoAnterior) ? silueta.actualizar(pose?.mascara) : null;
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
    maquina.actualizar({ puedeIniciar: hayRostroEstable, hayPersona, ahora }),
    ahora,
  );

  const estado = salida.estado;
  estadoAnterior = estado;
  const carrera = salida.carrera ? contenido.obtener(salida.carrera) : null;
  const enEstadoDesde = ahora - maquina.desdeCuando();
  const transicion = calcularTransicionEscena({
    estado,
    transcurrido: enEstadoDesde,
    tiempos: CONFIG.tiempos,
  });

  // --- tablero y eleccion ---
  // El arco se congela apenas empieza un sostenido: si siguiera a los hombros,
  // el gesto de estirar el brazo lo correria de abajo de la propia mano.
  const enEleccion = estado === ESTADOS.HUMO || estado === ESTADOS.ELECCION;
  if (enEleccion && ofrecidos.length > 0) {
    const puesto = tablero.actualizar({
      pose,
      rostro,
      disposicion,
      cantidad: ofrecidos.length,
      congelar: progresoDeEleccion > 0,
    });

    blancos = ofrecidos.map((ofrecido, i) => ({
      ...ofrecido,
      x: puesto.ubicaciones[i].x,
      y: puesto.ubicaciones[i].y,
      radio: puesto.radioObjeto,
    }));
  }

  if (estado === ESTADOS.ELECCION) {
    const paso = eleccion.actualizar({ manos: manosSuaves, objetivos: blancos, ahora });
    progresoDeEleccion = paso.progreso;
    sobreQueBlanco = paso.sobre;
    if (paso.elegido) atender(maquina.elegir(paso.elegido, ahora), ahora);
  } else if (!enEleccion) {
    progresoDeEleccion = 0;
    sobreQueBlanco = null;
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
  if (transicion.fondo > 0 && carrera) {
    const imagenDeFondo = carrera.fondo ? banco.obtener(carrera.fondo) : null;
    const hayRecorte = Boolean(video && lienzoDeSilueta);

    if (imagenDeFondo) {
      dibujarFondo(
        ctx,
        imagenDeFondo,
        disposicion,
        transicion.fondo * (hayRecorte ? 1 : CONFIG.fondo.opacidadSinMascara),
      );
    } else {
      // Sin imagen, el color de la carrera. Es feo pero es legible, y el nombre
      // y el texto siguen entrando: una carrera sin fondo no rompe la escena.
      ctx.save();
      ctx.globalAlpha = transicion.fondo * 0.8;
      ctx.fillStyle = carrera.color;
      ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
      ctx.restore();
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

  // --- los cinco que se ofrecen ---
  if (transicion.objetos > 0) {
    for (const blanco of blancos) {
      // El elegido no se dibuja aca: viaja aparte hacia su lugar de arriba.
      if (salida.carrera && blanco.id === salida.carrera) continue;

      dibujarObjeto(
        ctx,
        {
          definicion: blanco.definicion,
          x: blanco.x,
          y: blanco.y,
          radio: blanco.radio,
          alfa: transicion.objetos,
        },
        banco,
        blanco.carrera.color,
      );

      if (blanco.id === sobreQueBlanco && progresoDeEleccion > 0) {
        dibujarAnilloDeProgreso(ctx, {
          x: blanco.x,
          y: blanco.y,
          radio: blanco.radio,
          progreso: progresoDeEleccion,
          color: blanco.carrera.color,
        });
      }
    }
  }

  // --- el elegido, viajando a su lugar ---
  if (carrera && elegido && transicion.fondo > 0) {
    const t = transicion.fondo;

    dibujarObjeto(
      ctx,
      {
        definicion: elegido.definicion,
        x: mezclar(elegido.origen.x, disposicion.elegido.x, t),
        y: mezclar(elegido.origen.y, disposicion.elegido.y, t),
        radio: mezclar(elegido.origen.radio, disposicion.elegido.radio, t),
        alfa: 1,
      },
      banco,
      carrera.color,
    );
  }

  // La señal de las manos: donde registra el sistema tu palma. Es lo unico que
  // le enseña al publico que puede estirarlas, y sin ella el sostenido es a
  // ciegas. Solo durante la eleccion, que es cuando las manos hacen algo.
  if (estado === ESTADOS.ELECCION) {
    dibujarManos(ctx, manosSuaves, '#ffffff', CONFIG.manos.senal);
  }

  dibujarNombreDeCarrera(ctx, carrera, disposicion, transicion.contenido);
  dibujarFichaDePersona(ctx, carrera, disposicion, transicion.contenido);

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
    dibujarInvitacion(ctx, disposicion, (Math.sin(ahora / 700) + 1) / 2);
  }
  if (estado === ESTADOS.ELECCION) dibujarConsigna(ctx, disposicion, transicion.objetos);
}

window.espejo = {
  maquina,
  contenido,
  banco,
  detector,
  puente,
  estadoDeCamara: () => estadoDeCamara,
  manos: () => manos,
  manosCrudas: () => detectorDeManos?.crudasDetectadas() ?? 0,
  pose: () => pose,
  poseCrudas: () => detectorDePose?.crudasDetectadas() ?? 0,
  ofrecidos: () => blancos,
  elegido: () => elegido,
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
  elegir: (id, ahora) => atender(maquina.elegir(id, ahora), ahora),
  forzarCarrera: (id, ahora) => atender(maquina.forzarCarrera(id, ahora), ahora),
  reiniciar: (ahora) => atender(maquina.reiniciar(ahora), ahora),
};

const operacion = instalarOperacion({ espejo: window.espejo, tiempos: CONFIG.operacion });

requestAnimationFrame(cuadro);

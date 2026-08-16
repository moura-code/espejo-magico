// Cableado de la experiencia. Aca se juntan todos los modulos anteriores.
//
// Este archivo no tiene logica propia: decide QUE modulo habla con cual y en
// que orden se dibuja. Todo lo que se puede probar vive en otro lado.

import { CONFIG } from './config.js';
import { cargarContenido } from './contenido.js';
import { crearBanco, cargarImagenDelNavegador } from './imagenes.js';
import { abrirCamara, crearReintentador, dormir } from './camara.js';
import { crearDetectorMediaPipe, crearFuenteSintetica } from './rostro.js';
import { crearDetectorDeManosMediaPipe } from './manos.js';
import { crearDetectorDePoseMediaPipe } from './pose.js';
import {
  crearFiltroRostro,
  crearFiltroDeManos,
  crearHisteresis,
  crearRastreadorDeVelocidad,
} from './suavizado.js';
import { crearSorteo } from './sorteo.js';
import { crearMaquina, ESTADOS } from './maquina-estados.js';
import { crearPool, fuenteDeObjetos } from './objetos.js';
import { crearCuerpo } from './fisica.js';
import {
  crearNiebla,
  objetivoDeNiebla,
  acercarNiebla,
  calcularTransicionEscena,
} from './niebla.js';
import { crearEfecto, efectosDisponibles } from './efectos.js';
import { figurasDisponibles } from './figuras.js';
import {
  calcularDisposicion,
  calcularRecorteVisible,
  calcularRectanguloVideo,
  dibujarVideoEspejado,
  dibujarObjetos,
  dibujarFueraDeCara,
  dibujarManos,
  dibujarPersona,
  dibujarTextos,
  dibujarInvitacion,
} from './escena.js';
import { instalarOperacion } from './operacion.js';

// ---------- lienzos ----------
// La niebla va en su propia capa para componer todos los jirones laterales sin
// alterar el video ni los objetos que quedan debajo.
const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');
const capaNiebla = document.createElement('canvas');
const ctxNiebla = capaNiebla.getContext('2d');

let disposicion = calcularDisposicion(1, 1);

function ajustar() {
  lienzo.width = capaNiebla.width = window.innerWidth;
  lienzo.height = capaNiebla.height = window.innerHeight;
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
const contenido = await cargarContenido({
  figurasValidas: figurasDisponibles(),
  efectosValidos: efectosDisponibles(),
});
const banco = crearBanco({ cargar: cargarImagenDelNavegador, raiz: '/contenido/' });
const informe = await banco.precargar(contenido.todasLasImagenes());
if (informe.faltantes.length > 0) {
  console.warn(
    `Faltan ${informe.faltantes.length} de ${informe.total} imagenes. Se dibujan figuras del color de la carrera:`,
    informe.faltantes,
  );
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
  // Las manos son un agregado: si su modelo falta o no carga, el espejo sigue
  // andando con la cabeza sola. No vale la pena tirar toda la instalacion.
  console.warn('Deteccion de manos no disponible:', error);
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
const filtroDeManos = crearFiltroDeManos(CONFIG.manos.suavizadoDelIman);
// Dos histeresis sobre dos señales distintas. `histeresis` mira rostro O pose:
// es lo que SOSTIENE una sesion, y por eso los hombros alcanzan cuando la cara
// gira. `histeresisDeRostro` mira solo la cara: es lo que ARRANCA una sesion, y
// tiene que ser la mas exigente de las dos. Un falso positivo suelto destaparia
// el espejo frente a un sillon vacio durante varios segundos.
const histeresis = crearHisteresis(CONFIG.presencia);
const histeresisDeRostro = crearHisteresis(CONFIG.presencia);

// Velocidad de cada colisionador, para que pueda golpear y no solo hacer rebotar.
const opcionesVelocidad = {
  alfa: CONFIG.manos.alfaVelocidad,
  maxima: CONFIG.manos.velocidadMaxima,
};
const velocidadCabeza = crearRastreadorDeVelocidad(opcionesVelocidad);
const velocidadDeMano = new Map();

function seguirVelocidad(clave, x, y, ahora) {
  if (!velocidadDeMano.has(clave)) {
    velocidadDeMano.set(clave, crearRastreadorDeVelocidad(opcionesVelocidad));
  }
  return velocidadDeMano.get(clave).actualizar(x, y, ahora);
}

// ---------- logica ----------
const sorteo = crearSorteo({ ids: contenido.ids });
const maquina = crearMaquina({
  tiempos: CONFIG.tiempos,
  sortear: () => sorteo.siguiente(),
  manual: CONFIG.avance.manual,
});
const pool = crearPool(CONFIG.objetos);
const niebla = crearNiebla({ cantidad: CONFIG.niebla.cantidad });

// La niebla arranca cerrada. Su apertura cambia de forma continua aunque la
// maquina salte de estado, y solo desplaza nubes hacia los lados.
let nieblaActual = { apertura: 0 };

function atender(eventos) {
  for (const evento of eventos) {
    if (evento.tipo !== 'entra') continue;

    // Los dos vaciados que importan. En ATRACCION se limpia lo que quedo de la
    // escena que termino. En REVELACION se limpia lo de la escena anterior
    // cuando el operador fuerza una carrera con las teclas y salta ahi desde
    // una sesion en curso: la carrera nueva tiene que aparecer sola.
    if (evento.estado === ESTADOS.ATRACCION) pool.vaciar();
    if (evento.estado === ESTADOS.REVELACION) pool.vaciar();
  }
}

// ---------- aparicion de objetos ----------
let proximaAparicion = 0;

function aparecerObjeto(definicion, ahora) {
  const radio = (definicion.escala * disposicion.unidad) / 2;
  pool.aparecer(
    definicion,
    crearCuerpo({
      x: radio + Math.random() * Math.max(1, disposicion.ancho - radio * 2),
      y: -radio,
      vx: (Math.random() - 0.5) * 120,
      vy: 60 + Math.random() * 120,
      radio,
      giro: Math.random() * Math.PI * 2,
      velocidadGiro: (Math.random() - 0.5) * 2.5,
    }),
    ahora,
  );
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
let interaccionDeManos = CONFIG.manos.interaccion;
let verMalla = false;
let efecto = null;
let efectoDe = null;
let ultimaDeteccionManos = 0;
let ultimaDeteccionPose = 0;
let estadoAnterior = ESTADOS.ATRACCION;
const intervaloDeteccion = 1000 / CONFIG.deteccion.fpsObjetivo;
const intervaloManos = 1000 / CONFIG.manos.fps;
const intervaloPose = 1000 / CONFIG.pose.fps;
const intervaloDibujo = 1000 / CONFIG.render.fpsMaximo - CONFIG.render.margenMs;

function cuadro(ahora) {
  requestAnimationFrame(cuadro);

  // Tope de cuadros. Se saltea el dibujo sin tocar `anterior`, asi el dt se
  // acumula solo y la fisica no se entera del salteo.
  if (ahora - anterior < intervaloDibujo) return;

  operacion.registrarCuadro(ahora);

  // Se acota el dt: si el navegador se traba un instante, un salto grande
  // mandaria los objetos atravesando el piso de un cuadro al otro.
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
  // veces mas rapido y a 22 cuadros por segundo el circulo va siempre atras de la
  // mano de verdad. Solo se buscan cuando hay algo con que interactuar, porque es
  // el detector mas caro del cuadro.
  const poseSirve = detectorDePose && video && modo !== 'demo';
  const manosSirven =
    detectorDeManos &&
    video &&
    modo !== 'demo' &&
    (estadoAnterior === ESTADOS.REVELACION || estadoAnterior === ESTADOS.ESCENA);

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
  } else if (!poseSirve) {
    pose = null;
  }

  const habiaPresencia = hayPersona;
  hayPersona = histeresis.actualizar(Boolean(crudoRostro || pose), ahora);
  hayRostroEstable = histeresisDeRostro.actualizar(Boolean(crudoRostro), ahora);
  if (habiaPresencia && !hayPersona) {
    filtro.reiniciar();
    velocidadCabeza.reiniciar();
    velocidadDeMano.clear();
    crudoRostro = null;
    rostro = null;
    pose = null;
  }

  if (tocaManos && analisis) {
    ultimaDeteccionManos = ahora;
    manos = detectorDeManos.detectar(analisis, ahora, rectDeteccion);
    // La copia filtrada es solo para el iman: corta el temblor de la deteccion
    // sin meterle retardo al manotazo, que sigue usando la palma cruda.
    manosSuaves = filtroDeManos.filtrar(manos, ahora);
    manos = manos.map((mano, indice) => ({
      ...mano,
      idSeguimiento: manosSuaves[indice]?.idSeguimiento,
    }));
  } else if (!manosSirven) {
    manos = [];
    manosSuaves = [];
    filtroDeManos.reiniciar();
    velocidadDeMano.clear();
  }

  // --- estado ---
  const salida = maquina.actualizar({
    puedeIniciar: hayRostroEstable,
    hayPersona,
    ahora,
  });
  atender(salida.eventos);

  const estado = salida.estado;
  estadoAnterior = estado;
  const carrera = salida.carrera ? contenido.obtener(salida.carrera) : null;
  const enEstadoDesde = ahora - maquina.desdeCuando();
  const transicion = calcularTransicionEscena({
    estado,
    transcurrido: enEstadoDesde,
    tiempos: CONFIG.tiempos,
  });

  // --- fisica ---
  const fuente = fuenteDeObjetos(estado, carrera);
  if (fuente && fuente.length > 0 && ahora >= proximaAparicion) {
    proximaAparicion = ahora + CONFIG.objetos.intervaloAparicion;
    aparecerObjeto(fuente[Math.floor(Math.random() * fuente.length)], ahora);
  }

  // La cabeza es colisionador con velocidad propia: por eso golpea los objetos
  // en vez de solo hacerlos rebotar. Las manos cambian de papel segun el modo:
  // en golpe son colisionadores como la cabeza; en iman son SOLO atractores —
  // el anillo de reposo del campo mantiene los objetos fuera de la palma, y
  // sumarle el circulo duro hace vibrar el racimo.
  const colisionadores = [];
  const atractores = [];
  if (rostro) {
    const { vx, vy } = velocidadCabeza.actualizar(rostro.centro.x, rostro.centro.y, ahora);
    colisionadores.push({ x: rostro.centro.x, y: rostro.centro.y, radio: rostro.radio, vx, vy });
  }

  if (interaccionDeManos === 'atraer') {
    for (const mano of manosSuaves) {
      atractores.push({
        id: mano.idSeguimiento,
        x: mano.palma.x,
        y: mano.palma.y,
        alcance: mano.radio * CONFIG.manos.atraccion.alcanceFactor,
        alcanceArriba:
          mano.radio *
          (CONFIG.manos.atraccion.alcanceArribaFactor ?? CONFIG.manos.atraccion.alcanceFactor),
        reposo: mano.radio * CONFIG.manos.atraccion.reposoFactor,
      });
    }
  } else {
    // La velocidad solo la usa el modo golpe: en iman los atractores no la
    // miran, y calcularla igual seria trabajo por cuadro sin consumidor.
    for (const mano of manos) {
      const clave = mano.idSeguimiento ?? mano.lado;
      const { vx, vy } = seguirVelocidad(clave, mano.palma.x, mano.palma.y, ahora);
      colisionadores.push({ x: mano.palma.x, y: mano.palma.y, radio: mano.radio, vx, vy });
    }
  }

  pool.actualizar(dt, ahora, {
    ...CONFIG.fisica,
    caja: disposicion.caja,
    colisionadores,
    atractores,
    atraccion: CONFIG.manos.atraccion,
  });
  niebla.actualizar(dt, estado === ESTADOS.SORTEO ? CONFIG.niebla.agitacionSorteo : 1);

  // --- efecto de la carrera ---
  // Se arma al saberse la carrera (en SORTEO) y se tira al volver a atraccion.
  if (carrera && carrera.id !== efectoDe) {
    efecto = crearEfecto(carrera.efecto, { presupuesto: CONFIG.efectos.presupuesto });
    efectoDe = carrera.id;
  } else if (!carrera && efecto) {
    efecto = null;
    efectoDe = null;
  }

  const contextoEfecto = {
    ancho: disposicion.ancho,
    alto: disposicion.alto,
    color: carrera?.color ?? '#ffffff',
    rostro,
    ahora,
    alfa: transicion.efecto,
  };
  if (efecto) efecto.actualizar(dt, contextoEfecto);

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

  // El efecto va encima del video y debajo de los objetos, para que el
  // participante quede dentro de la escena y no tapado por ella.
  if (efecto && transicion.efecto > 0) {
    dibujarFueraDeCara(ctx, rostro, disposicion, () => efecto.dibujar(ctx, contextoEfecto));
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

    // Los 21 puntos de cada mano y su circulo de radio real, que es lo que la
    // fisica usa como colisionador en golpe y como base del alcance en iman. Si
    // los puntos caen sobre tus dedos, el problema no es la deteccion.
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

  dibujarObjetos(ctx, pool.vivos(), banco, carrera?.color ?? '#8899aa');

  // La señal de las manos se ve siempre que haya manos: es lo que le enseña al
  // publico que puede estirarlas. Se dibuja sobre la mano que manda segun el
  // modo — la filtrada en iman (donde esta el atractor), la cruda en golpe
  // (donde pega el manotazo).
  const atrae = interaccionDeManos === 'atraer';
  dibujarManos(ctx, atrae ? manosSuaves : manos, carrera?.color ?? '#ffffff', {
    ahora,
    alcanceFactor: CONFIG.manos.atraccion.alcanceFactor,
    atrae,
    senal: CONFIG.manos.senal,
  });

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
  dibujarTextos(ctx, carrera, disposicion, transicion.contenido);
}

window.espejo = {
  maquina,
  contenido,
  banco,
  pool,
  detector,
  estadoDeCamara: () => estadoDeCamara,
  manos: () => manos,
  manosCrudas: () => detectorDeManos?.crudasDetectadas() ?? 0,
  pose: () => pose,
  poseCrudas: () => detectorDePose?.crudasDetectadas() ?? 0,
  modo: () => modo,
  cambiarModo: (nuevo) => {
    modo = nuevo;
    filtro.reiniciar();
  },
  alternarMalla: () => {
    verMalla = !verMalla;
  },
  interaccionDeManos: () => interaccionDeManos,
  alternarInteraccion: () => {
    interaccionDeManos = interaccionDeManos === 'atraer' ? 'golpear' : 'atraer';
    filtroDeManos.reiniciar();
    velocidadDeMano.clear();
    return interaccionDeManos;
  },
  // Los atajos tienen que pasar por atender(): si no, forzar una carrera con las
  // teclas deja en pantalla los objetos de la sesion anterior.
  avanzar: (ahora) => atender(maquina.avanzar(ahora).eventos),
  forzarCarrera: (id, ahora) => atender(maquina.forzarCarrera(id, ahora).eventos),
  reiniciar: (ahora) => atender(maquina.reiniciar(ahora).eventos),
};

const operacion = instalarOperacion({ espejo: window.espejo, tiempos: CONFIG.operacion });

requestAnimationFrame(cuadro);

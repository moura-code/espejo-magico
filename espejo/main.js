// Cableado de la experiencia. Aca se juntan los once modulos anteriores.
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
  calcularRectanguloVideo,
  dibujarVideoEspejado,
  dibujarObjetos,
  dibujarFueraDeCara,
  dibujarAccesorio,
  dibujarManos,
  dibujarPersona,
  dibujarTextos,
  dibujarInvitacion,
} from './escena.js';
import { crearBus } from './bus.js';
import { instalarOperacion } from './operacion.js';
import { mensajeCarrera, mensajeHolaEspejo, mensajeReposo } from '../comun/protocolo.js';

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
const histeresis = crearHisteresis(CONFIG.presencia);

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
const instancia = crypto.randomUUID();

// La niebla arranca cerrada. Su apertura cambia de forma continua aunque la
// maquina salte de estado, y solo desplaza nubes hacia los lados.
let nieblaActual = { apertura: 0 };

let ultimoLatido = 0;
let ultimoAnuncio = mensajeReposo(instancia);

const bus = crearBus({
  url: `ws://${location.hostname}:${CONFIG.red.puerto}`,
  reconexionMs: CONFIG.red.reconexionMs,
  identidad: mensajeHolaEspejo(instancia),
  alEstado: (estado) => {
    console.log('bus:', estado);
    if (estado.conectado) bus.enviar(ultimoAnuncio);
  },
});

function atender(eventos, ahora) {
  for (const evento of eventos) {
    if (evento.tipo === 'carrera') {
      ultimoAnuncio = mensajeCarrera(evento.id, evento.sesion, instancia);
      bus.enviar(ultimoAnuncio);
    }
    if (evento.tipo === 'reposo') {
      ultimoAnuncio = mensajeReposo(instancia);
      bus.enviar(ultimoAnuncio);
    }
    if (evento.tipo !== 'entra') continue;

    // Al sentarse alguien, los objetos de la atraccion se desvanecen: el espejo
    // despierta limpio en vez de con una pila de la sesion anterior.
    if (evento.estado === ESTADOS.ENGANCHE) pool.retirar(ahora, 600);

    // Al entrar en la revelacion se vacia de golpe, pero eso pasa con la niebla
    // todavia cerrada, asi que nadie lo ve. Cuando la niebla se abre, en pantalla
    // hay exactamente los objetos de la carrera sorteada y nada mas.
    if (evento.estado === ESTADOS.REVELACION) pool.vaciar();

    if (evento.estado === ESTADOS.ATRACCION) pool.vaciar();
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

// ---------- bucle ----------
let anterior = performance.now();
let ultimaDeteccion = 0;
let rostro = null;
let crudoRostro = null;
let pose = null;
let hayPersona = false;
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

  // El MISMO rectangulo para dibujar el video y para mapear el rostro.
  const rectangulo = video
    ? calcularRectanguloVideo(
        video.videoWidth,
        video.videoHeight,
        disposicion.ancho,
        disposicion.alto,
      )
    : { x: 0, y: 0, ancho: disposicion.ancho, alto: disposicion.alto };

  // --- deteccion ---
  if (ahora - ultimaDeteccion >= intervaloDeteccion) {
    ultimaDeteccion = ahora;

    crudoRostro =
      modo === 'demo'
        ? sintetica.detectar(ahora, disposicion)
        : video
          ? detector.detectar(video, ahora, rectangulo)
          : null;

    rostro = crudoRostro ? filtro.filtrar(crudoRostro) : null;
  }

  const poseSirve = detectorDePose && video && modo !== 'demo';
  if (poseSirve && ahora - ultimaDeteccionPose >= intervaloPose) {
    ultimaDeteccionPose = ahora;
    pose = detectorDePose.detectar(video, ahora, rectangulo);
  } else if (!poseSirve) {
    pose = null;
  }

  const habiaPresencia = hayPersona;
  hayPersona = histeresis.actualizar(Boolean(crudoRostro || pose), ahora);
  if (habiaPresencia && !hayPersona) {
    filtro.reiniciar();
    velocidadCabeza.reiniciar();
    velocidadDeMano.clear();
    crudoRostro = null;
    rostro = null;
    pose = null;
  }

  // Las manos corren en su propio reloj, mas rapido que la cara: se mueven mucho
  // mas rapido y a 22 cuadros por segundo el circulo va siempre atras de la mano
  // de verdad. Solo se buscan cuando hay algo con que interactuar, porque es el
  // detector mas caro del cuadro.
  const manosSirven =
    detectorDeManos &&
    video &&
    modo !== 'demo' &&
    (estadoAnterior === ESTADOS.REVELACION || estadoAnterior === ESTADOS.ESCENA);

  if (manosSirven && ahora - ultimaDeteccionManos >= intervaloManos) {
    ultimaDeteccionManos = ahora;
    manos = detectorDeManos.detectar(video, ahora, rectangulo);
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
  const salida = maquina.actualizar({ hayRostro: hayPersona, ahora });
  atender(salida.eventos, ahora);

  if (ahora - ultimoLatido >= CONFIG.red.latidoMs) {
    ultimoLatido = ahora;
    if (ultimoAnuncio) bus.enviar(ultimoAnuncio);
  }

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
  const fuente = fuenteDeObjetos(estado, carrera, contenido.carreras);
  if (fuente && fuente.length > 0 && ahora >= proximaAparicion) {
    const intervalo =
      estado === ESTADOS.ATRACCION
        ? CONFIG.objetos.intervaloAparicion * 3
        : CONFIG.objetos.intervaloAparicion;
    proximaAparicion = ahora + intervalo;
    aparecerObjeto(fuente[Math.floor(Math.random() * fuente.length)], ahora);
  }

  // La cabeza es colisionador con velocidad propia: por eso golpea los objetos
  // en vez de solo hacerlos rebotar. Las manos cambian de papel segun el modo:
  // en golpe son colisionadores como la cabeza; en iman son SOLO atractores —
  // el anillo de reposo del campo mantiene los objetos fuera de la palma, y
  // sumarle el circulo duro hace vibrar el racimo.
  const colisionadores = [];
  const atractores = [];
  const velocidadesManos = new Map();
  if (rostro) {
    const { vx, vy } = velocidadCabeza.actualizar(rostro.centro.x, rostro.centro.y, ahora);
    colisionadores.push({ x: rostro.centro.x, y: rostro.centro.y, radio: rostro.radio, vx, vy });
  }
  for (const mano of manos) {
    const clave = mano.idSeguimiento ?? mano.lado;
    const velocidad = seguirVelocidad(clave, mano.palma.x, mano.palma.y, ahora);
    velocidadesManos.set(clave, velocidad);
  }

  if (interaccionDeManos === 'atraer') {
    for (const mano of manosSuaves) {
      atractores.push({
        id: mano.idSeguimiento,
        x: mano.palma.x,
        y: mano.palma.y,
        alcance: mano.radio * CONFIG.manos.atraccion.alcanceFactor,
        reposo: mano.radio * CONFIG.manos.atraccion.reposoFactor,
      });
    }
  } else {
    for (const mano of manos) {
      const { vx, vy } = velocidadesManos.get(mano.idSeguimiento ?? mano.lado);
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
    dibujarPersona(ctx, pose, rostro, rectangulo, carrera?.color ?? '#FFD23F');
    const puntos = detector.puntosCrudos();
    if (puntos) {
      ctx.fillStyle = 'rgba(80,200,255,0.75)';
      for (const punto of puntos) {
        ctx.fillRect(
          rectangulo.x + (1 - punto.x) * rectangulo.ancho - 1,
          rectangulo.y + punto.y * rectangulo.alto - 1,
          2.5,
          2.5,
        );
      }
    }

    // Los 21 puntos de cada mano y su circulo de colision. Si los puntos caen
    // sobre tus dedos, el problema no es la deteccion.
    ctx.fillStyle = '#FFD23F';
    for (const mano of manos) {
      for (const punto of mano.puntos ?? []) {
        ctx.fillRect(
          rectangulo.x + (1 - punto.x) * rectangulo.ancho - 2,
          rectangulo.y + punto.y * rectangulo.alto - 2,
          4,
          4,
        );
      }
    }
    dibujarManos(ctx, manos, '#FFD23F');
  }

  dibujarObjetos(ctx, pool.vivos(), banco, carrera?.color ?? '#8899aa');

  // Los aros de las manos se ven siempre: son la señal de que las manos
  // interactuan. Se dibuja la mano que manda segun el modo — la filtrada en
  // iman (donde esta el atractor), la cruda en golpe (donde pega el manotazo).
  dibujarManos(
    ctx,
    interaccionDeManos === 'atraer' ? manosSuaves : manos,
    carrera?.color ?? '#ffffff',
  );

  dibujarAccesorio(ctx, rostro, carrera, banco, transicion.contenido);

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
  bus,
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
  // teclas no le avisa a las tablets ni limpia los objetos de la sesion anterior.
  avanzar: (ahora) => atender(maquina.avanzar(ahora).eventos, ahora),
  forzarCarrera: (id, ahora) => atender(maquina.forzarCarrera(id, ahora).eventos, ahora),
  reiniciar: (ahora) => atender(maquina.reiniciar(ahora).eventos, ahora),
};

const operacion = instalarOperacion({ espejo: window.espejo, tiempos: CONFIG.operacion });

requestAnimationFrame(cuadro);

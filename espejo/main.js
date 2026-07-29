// Cableado de la experiencia. Aca se juntan los once modulos anteriores.
//
// Este archivo no tiene logica propia: decide QUE modulo habla con cual y en
// que orden se dibuja. Todo lo que se puede probar vive en otro lado.

import { CONFIG } from './config.js';
import { cargarContenido } from './contenido.js';
import { crearBanco, cargarImagenDelNavegador } from './imagenes.js';
import {
  abrirCamara,
  crearReintentador,
  crearSelectorDeCamara,
  dormir,
} from './camara.js';
import {
  crearDetectorMediaPipe,
  crearFuenteSintetica,
  generarPuntosRostroSintetico,
} from './rostro.js';
import {
  crearDetectorDeManosMediaPipe,
  crearFuenteDeManosSinteticas,
} from './manos.js';
import { crearFiltroRostro, crearHisteresis, crearRastreadorDeVelocidad } from './suavizado.js';
import { crearSorteo } from './sorteo.js';
import { crearMaquina, ESTADOS } from './maquina-estados.js';
import { crearControlDemo } from './demo.js';
import { calcularTemporizadorEstado } from './temporizador.js';
import {
  controlesParaEstado,
  ejecutarAccionRemota,
} from './controles-remotos.js';
import { crearPool, fuenteDeObjetos } from './objetos.js';
import { crearCuerpo } from './fisica.js';
import { crearNiebla, calcularNiebla } from './niebla.js';
import { crearEfecto, efectosDisponibles } from './efectos.js';
import { figurasDisponibles } from './figuras.js';
import { calcularCierreDeAusencia } from './interfaz-gestual.js';
import {
  calcularDisposicion,
  calcularRectanguloVideo,
  dibujarVideoEspejado,
  dibujarObjetos,
  dibujarAccesorio,
  dibujarManos,
  dibujarPuntosRostro,
  dibujarManosSinteticas,
  dibujarCierreDeAusencia,
  dibujarCierreConceptual,
  dibujarEncuentro,
  dibujarTextos,
  dibujarInvitacion,
  dibujarMensajeSorteo,
  dibujarReflexion,
  dibujarTemporizadorEstado,
} from './escena.js';
import { crearBus } from './bus.js';
import { instalarOperacion } from './operacion.js';
import { instalarPanelConfiguracion } from './panel-configuracion.js';
import { mensajeCarrera, mensajeReposo, TIPOS } from '../comun/protocolo.js';

// ---------- lienzos ----------
// La niebla va en su propia capa porque el agujero de la revelacion se abre
// borrando (destination-out), y si estuviera en el lienzo principal borraria
// tambien el video y los objetos.
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
const banco = crearBanco({ cargar: cargarImagenDelNavegador, raiz: '/' });
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

const CLAVE_CAMARA = 'espejo.camara';
const selectorDeCamara = crearSelectorDeCamara({
  abrir: (dispositivoId) =>
    abrirCamara({
      ancho: CONFIG.deteccion.anchoCamara,
      alto: CONFIG.deteccion.altoCamara,
      dispositivoId,
      obtenerMedia: (pedido) => navigator.mediaDevices.getUserMedia(pedido),
      alPerderse: () => camara?.perdida(),
    }),
  enumerarDispositivos: () => navigator.mediaDevices.enumerateDevices(),
  seleccionGuardada: localStorage.getItem(CLAVE_CAMARA),
  alGuardar: (dispositivoId) => {
    if (dispositivoId) localStorage.setItem(CLAVE_CAMARA, dispositivoId);
    else localStorage.removeItem(CLAVE_CAMARA);
  },
});

let camara = null;
camara = crearReintentador({
  abrir: () => selectorDeCamara.abrir(),
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

const sintetica = crearFuenteSintetica();
const manosSinteticas = crearFuenteDeManosSinteticas();
const filtro = crearFiltroRostro(CONFIG.suavizado);
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
const controlDemo = crearControlDemo({
  ids: contenido.ids,
  ...CONFIG.demo,
});
const maquina = crearMaquina({
  tiempos: CONFIG.tiempos,
  sortear: () => sorteo.siguiente(),
  manual: CONFIG.avance.manual,
});
const pool = crearPool(CONFIG.objetos);
const niebla = crearNiebla({ cantidad: 26 });

let accionRemotaPendiente = null;
let ultimoMensajeControles = null;
let estadoDeControles = null;

const bus = crearBus({
  url: `ws://${location.host}`,
  reconexionMs: CONFIG.red.reconexionMs,
  alMensaje: (mensaje) => {
    if (mensaje.tipo === TIPOS.ACCION) accionRemotaPendiente = mensaje.id;
  },
  alEstado: (estado) => console.log('bus:', estado),
});

let ultimoLatido = 0;
let ultimoAnuncio = null;

function atender(eventos, ahora) {
  controlDemo.registrar(eventos, ahora);

  for (const evento of eventos) {
    if (evento.tipo === 'carrera') {
      ultimoAnuncio = mensajeCarrera(evento.id, evento.sesion);
      bus.enviar(ultimoAnuncio);
    }
    if (evento.tipo === 'reposo') {
      ultimoAnuncio = mensajeReposo();
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

    if (evento.estado === ESTADOS.REFLEXION) pool.retirar(ahora, 600);

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
let manos = [];
let verMalla = false;
let efecto = null;
let efectoDe = null;
let ultimaDeteccionManos = 0;
let estadoAnterior = ESTADOS.ATRACCION;
let ausenciaVisualDesde = null;
const intervaloDeteccion = 1000 / CONFIG.deteccion.fpsObjetivo;
const intervaloManos = 1000 / CONFIG.manos.fps;
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

  if (accionRemotaPendiente) {
    const salidaRemota = ejecutarAccionRemota({
      id: accionRemotaPendiente,
      estado: maquina.estado(),
      maquina,
      ahora,
    });
    if (salidaRemota) atender(salidaRemota.eventos, ahora);
  }
  accionRemotaPendiente = null;

  const camaraLista = camara.obtener();
  const video = camaraLista?.video ?? null;
  const personaDemoVisible = controlDemo.personaVisible(ahora);

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

    const crudo =
      modo === 'demo'
        ? personaDemoVisible
          ? sintetica.detectar(ahora, disposicion)
          : null
        : video
          ? detector.detectar(video, ahora, rectangulo)
          : null;

    const habiaPresencia = histeresis.presente();
    const hayPresencia = histeresis.actualizar(Boolean(crudo), ahora);
    if (habiaPresencia && !hayPresencia) {
      filtro.reiniciar();
      velocidadCabeza.reiniciar();
      velocidadDeMano.clear();
    }

    rostro = hayPresencia ? filtro.filtrar(crudo) : null;
  }

  // Las manos corren en su propio reloj, mas rapido que la cara: se mueven mucho
  // mas rapido y a 22 cuadros por segundo el circulo va siempre atras de la mano
  // de verdad. Solo se buscan cuando hay algo con que interactuar, porque es el
  // detector mas caro del cuadro.
  const manosRealesSirven =
    detectorDeManos &&
    video &&
    modo !== 'demo' &&
    (estadoAnterior === ESTADOS.REVELACION ||
      estadoAnterior === ESTADOS.ESCENA);

  if (modo === 'demo' && ahora - ultimaDeteccionManos >= intervaloManos) {
    ultimaDeteccionManos = ahora;
    manos = personaDemoVisible
      ? manosSinteticas.detectar(ahora, disposicion)
      : [];
  } else if (manosRealesSirven && ahora - ultimaDeteccionManos >= intervaloManos) {
    ultimaDeteccionManos = ahora;
    manos = detectorDeManos.detectar(video, ahora, rectangulo);
  } else if (modo !== 'demo' && !manosRealesSirven) {
    manos = [];
    velocidadDeMano.clear();
  }

  // --- estado ---
  const salida = maquina.actualizar({ hayRostro: Boolean(rostro), ahora });
  atender(salida.eventos, ahora);

  const estado = salida.estado;
  estadoAnterior = estado;
  const claveDeControles = `${estado}:${maquina.esManual()}`;
  if (claveDeControles !== estadoDeControles) {
    estadoDeControles = claveDeControles;
    ultimoMensajeControles = controlesParaEstado(estado, {
      manual: maquina.esManual(),
    });
    bus.enviar(ultimoMensajeControles);
  }

  if (ahora - ultimoLatido >= CONFIG.red.latidoMs) {
    ultimoLatido = ahora;
    if (ultimoAnuncio) bus.enviar(ultimoAnuncio);
    if (ultimoMensajeControles) bus.enviar(ultimoMensajeControles);
  }

  const carrera = salida.carrera ? contenido.obtener(salida.carrera) : null;
  const enEstadoDesde = ahora - maquina.desdeCuando();
  const temporizadorEstado = calcularTemporizadorEstado({
    estado,
    transcurrido: enEstadoDesde,
    tiempos: CONFIG.tiempos,
    manual: maquina.esManual(),
  });
  if (estado === ESTADOS.ATRACCION && !rostro) {
    if (ausenciaVisualDesde === null) ausenciaVisualDesde = ahora;
  } else {
    ausenciaVisualDesde = null;
  }
  const cierreDeAusencia = calcularCierreDeAusencia({
    ahora,
    ausenciaDesde: ausenciaVisualDesde,
    ...CONFIG.interfazGestual.reposo,
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

  // La cabeza y las manos son colisionadores con velocidad propia: por eso
  // golpean los objetos en vez de solo hacerlos rebotar.
  const colisionadores = [];
  if (rostro) {
    const { vx, vy } = velocidadCabeza.actualizar(rostro.centro.x, rostro.centro.y, ahora);
    colisionadores.push({ x: rostro.centro.x, y: rostro.centro.y, radio: rostro.radio, vx, vy });
  }
  for (const mano of manos) {
    const { vx, vy } = seguirVelocidad(mano.lado, mano.palma.x, mano.palma.y, ahora);
    colisionadores.push({ x: mano.palma.x, y: mano.palma.y, radio: mano.radio, vx, vy });
  }

  pool.actualizar(estado === ESTADOS.REFLEXION ? 0 : dt, ahora, {
    ...CONFIG.fisica,
    caja: disposicion.caja,
    colisionadores,
  });
  niebla.actualizar(dt);

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
  if (efecto && (estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA)) {
    efecto.dibujar(ctx, contextoEfecto);
  }

  if (modo === 'demo' && rostro) {
    dibujarPuntosRostro(ctx, generarPuntosRostroSintetico(rostro), {
      radio: Math.max(2.5, rostro.radio * 0.018),
    });
    dibujarManosSinteticas(ctx, manos);
  }

  // Diagnostico: la malla facial completa. Si los puntos caen sobre la cara el
  // mapeo esta bien; si estan corridos, el rectangulo del video y el del mapeo
  // se separaron.
  if (verMalla && modo !== 'demo') {
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

  if (estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA) {
    dibujarAccesorio(ctx, rostro, carrera, banco);
  }

  const capa = calcularNiebla({ estado, transcurrido: enEstadoDesde, tiempos: CONFIG.tiempos });
  if (capa.cobertura > 0) {
    ctxNiebla.clearRect(0, 0, disposicion.ancho, disposicion.alto);
    niebla.dibujar(ctxNiebla, disposicion, { ...capa, centro: rostro?.centro });
    ctx.drawImage(capaNiebla, 0, 0);
  }

  if (modo === 'demo') {
    const resumenDemo = controlDemo.resumen();
    ctx.save();
    ctx.fillStyle = resumenDemo.completo ? '#7CFFB2' : '#FFD23F';
    ctx.font = `700 ${Math.round(disposicion.texto.tamanoFrase * 0.65)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.9;
    ctx.fillText(
      `DEMO AUTOMÁTICA · ${resumenDemo.carrerasVistas}/${resumenDemo.totalCarreras} CARRERAS`,
      24,
      96,
    );
    ctx.restore();
  }

  if (estado === ESTADOS.ATRACCION) {
    // Tambien cuando no hay camara: el publico ve la invitacion, nunca un error.
    dibujarInvitacion(ctx, disposicion, (Math.sin(ahora / 700) + 1) / 2);
  } else if (estado === ESTADOS.ENGANCHE) {
    dibujarEncuentro(ctx, disposicion);
  } else if (estado === ESTADOS.SORTEO) {
    dibujarMensajeSorteo(ctx, disposicion, (Math.sin(ahora / 500) + 1) / 2);
  } else if (estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA) {
    dibujarTextos(ctx, carrera, disposicion, 1);
  } else if (estado === ESTADOS.REFLEXION) {
    dibujarReflexion(ctx, carrera, disposicion);
  } else if (estado === ESTADOS.CIERRE) {
    const progresoDeCierre = enEstadoDesde / CONFIG.tiempos.cierre;
    const alfaDeCierre = Math.max(0, 1 - Math.max(0, progresoDeCierre - 0.75) / 0.25);
    dibujarCierreConceptual(
      ctx,
      disposicion,
      progresoDeCierre,
      alfaDeCierre,
    );
  }

  dibujarTemporizadorEstado(
    ctx,
    disposicion,
    temporizadorEstado,
    carrera?.color ?? '#62D8FF',
  );
  dibujarCierreDeAusencia(ctx, disposicion, cierreDeAusencia);
}

let cambioDeCamaraEnCurso = false;

async function cambiarDispositivoDeCamara(elegir) {
  if (cambioDeCamaraEnCurso) return false;
  cambioDeCamaraEnCurso = true;

  try {
    const dispositivoActual =
      camara.obtener()?.dispositivoId ?? selectorDeCamara.seleccionada();
    const siguiente = await elegir(dispositivoActual);
    if (!siguiente) return false;

    filtro.reiniciar();
    camara.reabrir();
    return true;
  } finally {
    cambioDeCamaraEnCurso = false;
  }
}

window.espejo = {
  maquina,
  contenido,
  banco,
  pool,
  bus,
  detector,
  estadoDeCamara: () => estadoDeCamara,
  listarCamaras: () => selectorDeCamara.disponibles(),
  cambiarCamara: () =>
    cambiarDispositivoDeCamara((dispositivoActual) =>
      selectorDeCamara.siguiente(dispositivoActual),
    ),
  seleccionarCamara: (dispositivoId) =>
    cambiarDispositivoDeCamara((dispositivoActual) =>
      selectorDeCamara.seleccionar(dispositivoId, dispositivoActual),
    ),
  manos: () => manos,
  manosCrudas: () => detectorDeManos?.crudasDetectadas() ?? 0,
  modo: () => modo,
  demo: () => controlDemo.resumen(),
  cambiarModo: (nuevo, ahora = performance.now()) => {
    if (nuevo === modo) return;
    modo = nuevo;
    const salida =
      nuevo === 'demo'
        ? controlDemo.activar({ maquina, ahora })
        : controlDemo.desactivar({ maquina, ahora });
    if (salida) atender(salida.eventos, ahora);
    filtro.reiniciar();
    histeresis.reiniciar();
    velocidadCabeza.reiniciar();
    velocidadDeMano.clear();
    manos = [];
  },
  establecerAvanceManual: (manual) =>
    modo === 'demo' ? false : maquina.establecerManual(manual),
  alternarAvanceManual: () =>
    modo === 'demo' ? false : maquina.establecerManual(!maquina.esManual()),
  alternarMalla: () => {
    verMalla = !verMalla;
  },
  mallaVisible: () => verMalla,
  // Los atajos tienen que pasar por atender(): si no, forzar una carrera con las
  // teclas no le avisa a las tablets ni limpia los objetos de la sesion anterior.
  avanzar: (ahora) => atender(maquina.avanzar(ahora).eventos, ahora),
  forzarCarrera: (id, ahora) => atender(maquina.forzarCarrera(id, ahora).eventos, ahora),
  reiniciar: (ahora) => atender(maquina.reiniciar(ahora).eventos, ahora),
};

instalarPanelConfiguracion({ espejo: window.espejo });
const operacion = instalarOperacion({ espejo: window.espejo, tiempos: CONFIG.operacion });

requestAnimationFrame(cuadro);

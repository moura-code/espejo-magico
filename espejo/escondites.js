// Los objetos del fondo: el que llega volando del carrusel y los que esperan
// escondidos. Donde va cada uno y como se mueven. Solo numeros: no dibuja, no
// sabe que es una ingenieria ni que existe un lienzo.
//
// Cada ingenieria trae cuatro objetos. El primero es el del carrusel: la
// persona lo agarra y vuela a `lugar`. Los otros tres ya estan en el fondo,
// cada uno en su escondite, integrados a la escena y meciendose apenas: ese
// movimiento es lo unico que los delata, y es el que pidio la catedra para
// que se los pueda encontrar.
//
// TODOS VAN EN LA PERIFERIA. En el medio de la pantalla esta la persona, y un
// objeto ahi le taparia la cara o quedaria tapado por ella. Donde queda cada
// escondite lo decide el contenido —cada foto tiene sus rincones—, y
// tests/integracion/fondos.test.js vigila que ninguno caiga en la zona de la
// persona ni en la del nombre.

import { flotacion } from './vuelo.js';

const GRADO = Math.PI / 180;

const suavizar = (valor) => {
  const t = Math.min(1, Math.max(0, valor));
  return t * t * (3 - 2 * t);
};

// El angulo aureo, en radianes. Separa las fases de los objetos de manera que
// ninguna se repite: con cuatro objetos no hay dos que arranquen juntos.
const DESFASE = 2.39996;

/**
 * Los lugares del fondo, normalizados a la imagen: primero el del objeto que
 * vuela desde el carrusel y despues los escondites, en su orden. Lo que el
 * fondo no declara sale de `porDefecto` (`{ lugar, escondites }`).
 *
 * Si el fondo declara sus escondites van solo esos, aunque sean menos:
 * completarlos con los de config podria poner dos objetos uno encima del otro.
 */
export function lugaresDelFondo(fondo, porDefecto) {
  return [fondo?.lugar ?? porDefecto.lugar, ...(fondo?.escondites ?? porDefecto.escondites)];
}

/**
 * Empareja los objetos escondidos con sus escondites, en orden. Un objeto sin
 * escondite no se muestra: meterlo en cualquier lado es arriesgarse a taparle
 * la cara a la persona, que es justo lo que la periferia existe para evitar.
 */
export function esconder(objetos, escondites) {
  return objetos
    .slice(0, escondites.length)
    .map((definicion, i) => ({ definicion, lugar: escondites[i] }));
}

/**
 * El vaiven de un objeto escondido: se inclina hasta `grados` a cada lado y
 * sube y baja `amplitud` radios, con un periodo de `periodoMs`.
 *
 * Cada uno a su ritmo —`variacion` mas lento que el anterior y arrancando en
 * otro punto del vaiven—: tres objetos meciendose al unisono se leen como una
 * animacion pegada encima del fondo, no como cosas que estan ahi. Y siempre
 * continuo: un movimiento a los saltos se lee como un parpadeo.
 */
export function balanceo(ahora, indice, radio, { grados, amplitud, periodoMs, variacion = 0.17 }) {
  const periodo = Math.max(1, periodoMs) * (1 + variacion * indice);
  const fase = (ahora / periodo) * Math.PI * 2 + indice * DESFASE;
  return {
    giro: Math.sin(fase) * grados * GRADO,
    dy: Math.cos(fase) * amplitud * radio,
  };
}

/**
 * Como se ve en este cuadro un objeto del fondo: cuanto se mueve, cuanto mide y
 * cuanto halo lleva. Lo usan el espejo y herramientas/fondos.html, que tiene que
 * mostrarle a la catedra exactamente lo que hace el espejo: con la cuenta
 * copiada en los dos lados, ajustar uno solo los separaba en silencio.
 *
 * - El que llego volando (`esElegido`) flota (`fondo.flotar`) sobre el halo de
 *   su lugar (`fondo.haloDelLugar`); los escondidos se mecen cada uno a su
 *   ritmo (`escondidos.balanceo`) sobre un halo tenue (`escondidos.halo`).
 * - El que se esta leyendo (`leyendo`, de 0 a 1: el alfa de su ficha) crece
 *   (`escondidos.resalte`), se calma (`escondidos.calmaAlLeer`) y se ilumina
 *   hasta `escondidos.haloAlLeer`: asi se sabe de cual habla la ficha.
 * - Al aterrizar, la flotacion y el halo del elegido arrancan de cero y entran
 *   en `fondo.msDeAterrizaje`. Llega volando sin halo y sin flotacion: si al
 *   tocar su lugar aparecieran enteros, el halo se prenderia de golpe y el
 *   objeto pegaria un salto, en el cuadro mas mirado de la experiencia.
 *
 * `config` es la CONFIG del espejo, o algo con su forma.
 */
export function aspectoDelObjeto(
  { ahora, indice = 0, radio, esElegido = false, leyendo = 0, desdeElAterrizaje = Infinity },
  { fondo, escondidos },
) {
  const lectura = Math.min(1, Math.max(0, leyendo));
  const entrada = esElegido ? suavizar(desdeElAterrizaje / Math.max(1, fondo.msDeAterrizaje)) : 1;
  const movimiento = esElegido
    ? flotacion(ahora, radio, fondo.flotar)
    : balanceo(ahora, indice, radio, escondidos.balanceo);
  const calma = (1 - escondidos.calmaAlLeer * lectura) * entrada;
  const haloEnReposo = esElegido ? fondo.haloDelLugar : escondidos.halo;

  return {
    dy: movimiento.dy * calma,
    giro: movimiento.giro * calma,
    radio: radio * (1 + escondidos.resalte * lectura),
    halo: (haloEnReposo + (escondidos.haloAlLeer - haloEnReposo) * lectura) * entrada,
  };
}

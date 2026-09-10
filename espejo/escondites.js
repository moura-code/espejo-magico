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

const GRADO = Math.PI / 180;

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
 * Cada uno a su ritmo —un poco mas lento que el anterior y arrancando en otro
 * punto del vaiven—: tres objetos meciendose al unisono se leen como una
 * animacion pegada encima del fondo, no como cosas que estan ahi. Y siempre
 * continuo: un movimiento a los saltos se lee como un parpadeo.
 */
export function balanceo(ahora, indice, radio, { grados, amplitud, periodoMs }) {
  const periodo = Math.max(1, periodoMs) * (1 + 0.17 * indice);
  const fase = (ahora / periodo) * Math.PI * 2 + indice * DESFASE;
  return {
    giro: Math.sin(fase) * grados * GRADO,
    dy: Math.cos(fase) * amplitud * radio,
  };
}

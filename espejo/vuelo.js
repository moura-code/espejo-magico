// El viaje del objeto desde su ranura del carrusel hasta su lugar en el fondo,
// y como flota una vez apoyado. Solo numeros: no dibuja, no sabe que es una
// carrera ni que existe un lienzo. Por eso se prueba entero en Node.
//
// El lugar viene normalizado a la IMAGEN del fondo (`x`, `y` en 0–1; `escala`
// es el diametro como fraccion del ancho dibujado). Como el fondo se dibuja
// cubriendo la pantalla y recortado, un punto normalizado a la imagen cae
// siempre en el mismo sitio de la escena —la mesa, la repisa— en cualquier
// resolucion. Normalizarlo a la pantalla lo haria caer en otro lado cada vez
// que cambia el recorte.

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/** Easing simetrico: arranca y frena suave, sin rebote. */
const suavizar = (valor) => {
  const t = acotar(valor, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Donde cae el lugar en pantalla. `rectangulo` es donde se dibujo el fondo
 * (el de calcularRectanguloVideo, que puede sobresalir del lienzo).
 */
export function lugarEnPantalla(lugar, rectangulo) {
  return {
    x: rectangulo.x + lugar.x * rectangulo.ancho,
    y: rectangulo.y + lugar.y * rectangulo.alto,
    radio: (lugar.escala * rectangulo.ancho) / 2,
  };
}

/**
 * Donde esta el objeto a mitad del viaje. `t` va de 0 (en la ranura) a 1 (en
 * su lugar); el tamaño se interpola a la vez, para que el objeto parezca
 * alejarse hacia la escena en vez de deslizarse por encima.
 *
 * Sin origen —la red de la fila, una carrera forzada por teclado— no hay
 * ranura de donde salir: el objeto crece en su lugar desde cero.
 */
export function posicionEnVuelo({ origen, destino, t }) {
  const avance = suavizar(t);
  const desde = origen ?? { x: destino.x, y: destino.y, radio: 0 };
  return {
    x: desde.x + (destino.x - desde.x) * avance,
    y: desde.y + (destino.y - desde.y) * avance,
    radio: desde.radio + (destino.radio - desde.radio) * avance,
  };
}

/**
 * La flotacion del objeto apoyado: sube y baja `amplitud` radios y se inclina
 * apenas, con el mismo periodo. Es la animacion integrada al fondo: suficiente
 * para que se lea vivo, poca para no competir con la persona.
 */
export function flotacion(ahora, radio, { amplitud, periodoMs }) {
  const fase = (ahora / Math.max(1, periodoMs)) * Math.PI * 2;
  return {
    dy: Math.sin(fase) * amplitud * radio,
    giro: Math.sin(fase + Math.PI / 3) * amplitud * 0.6,
  };
}

// El viaje del objeto desde su ranura del carrusel hasta su lugar en el fondo,
// y como flota una vez apoyado. Solo numeros: no dibuja, no sabe que es una
// carrera ni que existe un lienzo. Por eso se prueba entero en Node.
//
// Los lugares vienen normalizados a la IMAGEN del fondo (`x`, `y` en 0–1;
// `escala` es el diametro como fraccion del ancho de la foto). Las fotos se
// preparan en 1080x1920, la medida del espejo: ahi la foto entra justa y un
// punto normalizado a ella cae exactamente en el sitio de la escena que se
// eligio mirando —la repisa, el rincon oscuro—.

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/** Easing simetrico: arranca y frena suave, sin rebote. */
const suavizar = (valor) => {
  const t = acotar(valor, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Donde cae el lugar en pantalla. `rectangulo` es donde se dibujo el fondo (el
 * de calcularRectanguloVideo, que puede sobresalir del lienzo) y `pantalla` es
 * el lienzo, `{ancho, alto}`.
 *
 * EL LUGAR SE MIDE CONTRA LO QUE SE VE DE LA FOTO, no contra la foto entera. En
 * el espejo son lo mismo. En una pantalla de otra proporcion —un monitor
 * apaisado mientras se desarrolla— la foto entra al ancho y solo se ve su
 * franja del medio: medido contra la foto entera, un lugar de arriba caia por
 * encima del borde, y recortarlo contra el borde de a uno amontonaba ahi a
 * todos los objetos de ese costado. Medido contra lo que se ve, la composicion
 * entera se conserva —arriba sigue arriba, la periferia sigue siendo la
 * periferia— y nada se pisa que no se pisara en el espejo.
 *
 * El tamaño sale del ancho de la composicion vertical puesta a la altura de lo
 * que se ve: en apaisado la persona se ve 0,5625 veces mas chica que en el
 * espejo, y el objeto se achica igual. Si no, un objeto del fondo seria del
 * tamaño de una cabeza.
 *
 * `margen` es el seguro: si igual quedara pegado al borde, se corre lo justo
 * para que el objeto entre entero, con `margen` radios del centro al borde (1
 * es tocarlo; menos no vale, porque lo dejaria cortado).
 */
export function lugarEnPantalla(lugar, rectangulo, pantalla, margen = 1) {
  const x = Math.max(0, rectangulo.x);
  const y = Math.max(0, rectangulo.y);
  const visible = {
    x,
    y,
    ancho: Math.min(pantalla.ancho, rectangulo.x + rectangulo.ancho) - x,
    alto: Math.min(pantalla.alto, rectangulo.y + rectangulo.alto) - y,
  };

  const relacionAspecto = Math.min(rectangulo.ancho / rectangulo.alto, 9 / 16);
  const anchoDeLaComposicion = Math.min(
    visible.ancho,
    visible.alto * relacionAspecto,
  );
  const radio = (lugar.escala * anchoDeLaComposicion) / 2;
  const aire = radio * Math.max(1, margen);
  return {
    x: acotar(visible.x + lugar.x * visible.ancho, aire, pantalla.ancho - aire),
    y: acotar(visible.y + lugar.y * visible.alto, aire, pantalla.alto - aire),
    radio,
  };
}

/**
 * Donde cae un lugar que esta PINTADO ADENTRO de la foto (un fondo generado por
 * herramientas/escenas.py). Ahi no hay composicion que conservar: el objeto se
 * ve donde cae la foto y del tamaño con que se dibujo, y el blanco de la mano,
 * el latido y la ficha tienen que ir ahi. Es la misma cuenta que cajaEnPantalla
 * (escena.js) hace con la caja de su recorte, sobre el mismo `rectangulo`: el
 * que devolvio quien dibujo la foto.
 *
 * lugarEnPantalla no sirve para esto: recompone la escena vertical sobre lo que
 * se ve —es lo correcto para un PNG suelto, que se dibuja donde se lo ponga— y
 * fuera del 9:16 esa composicion ya no coincide con la foto. En la notebook el
 * blanco quedaba lejos del objeto que la persona veia, y la mano apoyada encima
 * no abria su ficha. En el espejo las dos cuentas dan lo mismo.
 *
 * No se corre contra el borde: el objeto pintado no se mueve, y un blanco
 * corrido seria un blanco al lado de lo que se ve.
 */
export function lugarEnLaFoto(lugar, rectangulo) {
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
 * Sin origen —una carrera forzada por teclado— no hay
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

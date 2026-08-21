// Donde se paran los objetos que se ofrecen. Solo geometria: no sabe que es una
// carrera ni quien los va a elegir.
//
// LOS OBJETOS NO VAN EN POSICIONES FIJAS DE LA PANTALLA. A dos metros de la
// camara el brazo de la persona alcanza apenas el tercio central del espejo:
// cinco objetos repartidos por el lienzo serian imposibles de tocar para quien
// esta lejos y quedarian encima de la cara de quien esta cerca. Van en arco
// alrededor de los hombros, y el radio sale del ancho de hombros, que es el
// mejor indicador de a que distancia esta sentada: mas lejos, todo mas chico y
// mas junto; mas cerca, todo mas grande y mas abierto. No hay ningun umbral que
// calibrar por distancia.

const GRADOS = Math.PI / 180;
const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/**
 * De donde cuelga el arco. Los hombros mandan; si no hay pose se deducen del
 * rostro, que es lo unico seguro que hay (un ancho de hombros son unos tres
 * radios de cara, y el centro cae un radio y medio mas abajo).
 *
 * Devuelve `{ x, y, escala }` en pixeles de pantalla, o null si no hay nada.
 */
export function calcularAncla({ pose, rostro, hombrosPorRostro = 3, caidaPorRostro = 1.5 }) {
  if (pose?.centroHombros && pose.anchoHombros > 0) {
    return { x: pose.centroHombros.x, y: pose.centroHombros.y, escala: pose.anchoHombros };
  }

  if (rostro?.centro && rostro.radio > 0) {
    return {
      x: rostro.centro.x,
      y: rostro.centro.y + rostro.radio * caidaPorRostro,
      escala: rostro.radio * hombrosPorRostro,
    };
  }

  return null;
}

/** Los angulos del arco, repartidos parejo. Con uno solo cae en el medio. */
export function angulosDelArco(cantidad, desde, hasta) {
  if (cantidad <= 0) return [];
  if (cantidad === 1) return [(desde + hasta) / 2];
  const paso = (hasta - desde) / (cantidad - 1);
  return Array.from({ length: cantidad }, (_, i) => desde + paso * i);
}

/**
 * El radio mas grande que deja el arco entero dentro del lienzo, con `margen`
 * de aire hasta el borde.
 *
 * Se achica el arco en vez de empujar los puntos de a uno: recortar cada punto
 * contra su borde deforma el arco y amontona dos objetos en la misma esquina,
 * que es justo lo que hace imposible elegir.
 */
export function radioQueEntra(angulos, ancla, disposicion, margen) {
  let maximo = Infinity;

  for (const grados of angulos) {
    const dx = Math.cos(grados * GRADOS);
    const dy = Math.sin(grados * GRADOS);

    if (dx < 0) maximo = Math.min(maximo, (ancla.x - margen) / -dx);
    else if (dx > 0) maximo = Math.min(maximo, (disposicion.ancho - margen - ancla.x) / dx);

    if (dy < 0) maximo = Math.min(maximo, (ancla.y - margen) / -dy);
    else if (dy > 0) maximo = Math.min(maximo, (disposicion.alto - margen - ancla.y) / dy);
  }

  return Math.max(0, maximo);
}

export function crearTablero({
  radioFactor,
  radioObjetoFactor,
  desde,
  hasta,
  suavizado,
  hombrosPorRostro,
  caidaPorRostro,
  margen,
}) {
  let suave = null;

  const mezclar = (actual, objetivo) => actual + suavizado * (objetivo - actual);

  return {
    /**
     * `congelar` deja el arco donde esta aunque la persona se mueva. Se pone en
     * true apenas empieza un sostenido: si el blanco siguiera a los hombros, el
     * gesto de estirar el brazo lo correria de abajo de la propia mano y elegir
     * seria perseguir un objeto que se escapa.
     */
    actualizar({ pose, rostro, disposicion, cantidad, congelar = false }) {
      const medido = calcularAncla({ pose, rostro, hombrosPorRostro, caidaPorRostro });

      if (!suave) {
        // Sin lectura todavia: el centro de la pantalla, con una escala derivada
        // del lienzo. Asi el tablero existe desde el primer cuadro y no aparece
        // de golpe cuando la pose engancha.
        suave = medido
          ? { ...medido }
          : { x: disposicion.ancho / 2, y: disposicion.alto * 0.62, escala: disposicion.ancho * 0.4 };
      } else if (medido && !congelar) {
        // Muy suavizado a proposito: seguir los hombros cuadro a cuadro haria
        // temblar los cinco blancos y apuntarles seria imposible.
        suave = {
          x: mezclar(suave.x, medido.x),
          y: mezclar(suave.y, medido.y),
          escala: mezclar(suave.escala, medido.escala),
        };
      }

      const radioObjeto = suave.escala * radioObjetoFactor;
      const angulos = angulosDelArco(cantidad, desde, hasta);
      const ancla = {
        // El ancla tambien se acota: con la persona pegada al borde del cuadro,
        // un centro fuera del lienzo dejaba radioQueEntra en cero y los cinco
        // objetos apilados en un punto.
        x: acotar(suave.x, radioObjeto, Math.max(radioObjeto, disposicion.ancho - radioObjeto)),
        y: acotar(suave.y, radioObjeto, Math.max(radioObjeto, disposicion.alto - radioObjeto)),
      };

      const radio = Math.min(
        suave.escala * radioFactor,
        radioQueEntra(angulos, ancla, disposicion, radioObjeto * margen),
      );

      return {
        ancla,
        escala: suave.escala,
        radioObjeto,
        ubicaciones: angulos.map((grados) => ({
          x: ancla.x + Math.cos(grados * GRADOS) * radio,
          y: ancla.y + Math.sin(grados * GRADOS) * radio,
        })),
      };
    },

    reiniciar() {
      suave = null;
    },
  };
}

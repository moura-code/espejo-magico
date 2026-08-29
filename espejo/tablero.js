// Donde se paran los objetos que se ofrecen. Solo geometria: no sabe que es una
// carrera ni quien los va a elegir.
//
// LOS OBJETOS NO VAN EN POSICIONES FIJAS DE LA PANTALLA. A dos metros de la
// camara el brazo de la persona alcanza apenas el tercio central del espejo:
// doce objetos repartidos por el lienzo serian imposibles de tocar para quien
// esta lejos y quedarian encima de la cara de quien esta cerca. Van en un anillo
// alrededor de los hombros, y el radio sale del ancho de hombros, que es el
// mejor indicador de a que distancia esta sentada: mas lejos, todo mas chico y
// mas junto; mas cerca, todo mas grande y mas abierto. No hay ningun umbral que
// calibrar por distancia.
//
// EL ANILLO ES UN CARRUSEL. Tiene una ranura por carrera y gira despacio; de el
// solo se ve la ventana de arriba (`desde` → `hasta`), unos cinco objetos. Los
// demas estan "detras del marco": existen, giran y no se dibujan, como en el
// boceto de la catedra. `congelar` detiene el giro ademas del ancla: es lo que
// hace que el carrusel se pare mientras se sostiene la mano sobre un objeto.

const GRADOS = Math.PI / 180;
const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));
const normalizar = (grados) => ((grados % 360) + 360) % 360;

/**
 * De donde cuelga el anillo. Los hombros mandan; si no hay pose se deducen del
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

/**
 * Los angulos de las ranuras, la vuelta entera repartida parejo a partir de
 * la fase. Siempre en [0, 360): la fase crece sin tope y aca se pliega.
 */
export function angulosDelAnillo(cantidad, fase) {
  if (cantidad <= 0) return [];
  const paso = 360 / cantidad;
  return Array.from({ length: cantidad }, (_, i) => normalizar(fase + paso * i));
}

/**
 * Cuanto se ve una ranura segun su angulo: 0 fuera de la ventana, 1 adentro y
 * una rampa de `fundido` grados en cada borde. Sin rampa nada se funde: los
 * objetos aparecen y desaparecen de golpe.
 */
export function alfaEnVentana(angulo, desde, hasta, fundido) {
  if (angulo < desde || angulo > hasta) return 0;
  if (fundido <= 0) return 1;
  return acotar(Math.min(angulo - desde, hasta - angulo) / fundido, 0, 1);
}

/**
 * La ventana muestreada de punta a punta. Es contra esto que se mide el radio
 * que entra en el lienzo: si se midiera contra las ranuras, el radio
 * respiraria cuadro a cuadro con el giro.
 */
export function angulosDeLaVentana(desde, hasta, paso = 5) {
  const angulos = [];
  for (let grados = desde; grados < hasta; grados += paso) angulos.push(grados);
  angulos.push(hasta);
  return angulos;
}

/**
 * El radio mas grande que deja los angulos dados dentro del lienzo, con
 * `margen` de aire hasta el borde.
 *
 * Se achica el anillo en vez de empujar los puntos de a uno: recortar cada
 * punto contra su borde deforma el anillo y amontona dos objetos en la misma
 * esquina, que es justo lo que hace imposible elegir.
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
  gradosPorSegundo = 0,
  gradosDeFundido = 0,
  aireEntreObjetos = 0,
}) {
  let suave = null;
  let fase = 0;
  const ventana = angulosDeLaVentana(desde, hasta);

  const mezclar = (actual, objetivo) => actual + suavizado * (objetivo - actual);

  return {
    /**
     * `dt` son los segundos desde el cuadro anterior: es lo que hace girar el
     * carrusel. `congelar` deja el anillo donde esta —ancla y fase— aunque la
     * persona se mueva. Se pone en true apenas empieza un sostenido: si el
     * blanco siguiera a los hombros, el gesto de estirar el brazo lo correria de
     * abajo de la propia mano, y si siguiera girando, elegir seria perseguir un
     * objeto que se escapa.
     */
    actualizar({ pose, rostro, disposicion, cantidad, congelar = false, dt = 0 }) {
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
        // temblar los blancos y apuntarles seria imposible.
        suave = {
          x: mezclar(suave.x, medido.x),
          y: mezclar(suave.y, medido.y),
          escala: mezclar(suave.escala, medido.escala),
        };
      }

      if (!congelar) fase = normalizar(fase + gradosPorSegundo * dt);

      const radioPedido = suave.escala * radioObjetoFactor;
      const ancla = {
        // El ancla tambien se acota: con la persona pegada al borde del cuadro,
        // un centro fuera del lienzo dejaba radioQueEntra en cero y todos los
        // objetos apilados en un punto.
        x: acotar(suave.x, radioPedido, Math.max(radioPedido, disposicion.ancho - radioPedido)),
        y: acotar(suave.y, radioPedido, Math.max(radioPedido, disposicion.alto - radioPedido)),
      };

      const radio = Math.min(
        suave.escala * radioFactor,
        radioQueEntra(ventana, ancla, disposicion, radioPedido * margen),
      );

      // La cuerda entre dos ranuras vecinas es lo maximo que puede medir un
      // objeto sin pisar al de al lado. Con pocos objetos no manda; con doce
      // y el radio achicado por el borde, si.
      const cuerda = cantidad > 1 ? radio * Math.sin(Math.PI / cantidad) : Infinity;
      const radioObjeto = Math.min(radioPedido, cuerda / (1 + aireEntreObjetos));

      return {
        ancla,
        escala: suave.escala,
        radioObjeto,
        fase,
        ubicaciones: angulosDelAnillo(cantidad, fase).map((angulo) => ({
          x: ancla.x + Math.cos(angulo * GRADOS) * radio,
          y: ancla.y + Math.sin(angulo * GRADOS) * radio,
          angulo,
          alfa: alfaEnVentana(angulo, desde, hasta, gradosDeFundido),
        })),
      };
    },

    reiniciar() {
      suave = null;
      fase = 0;
    },
  };
}

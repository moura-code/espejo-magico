// Recorte de la transparencia sobrante de una imagen rasterizada.
//
// El generador de PNG dibuja cada figura con margen de seguridad y despues
// recorta lo transparente. El recorte es simetrico alrededor del centro del
// lienzo a proposito: la figura se dibuja centrada en su origen, y conservar
// ese origen como centro del PNG mantiene el centro de giro cuando la escena
// rota el objeto. Ademas deja el arte al ras del lado mas largo, que es la
// medida que escena.js usa para escalar el dibujo al radio del cuerpo.

/**
 * Limites del contenido con alfa, en pixeles inclusive. Cuenta cualquier alfa
 * mayor que cero: el halo del antialias es parte del dibujo.
 *
 * `datos` es RGBA plano, como ImageData.data. Devuelve null si toda la imagen
 * es transparente.
 */
export function limitesOpacos({ ancho, alto, datos }) {
  let izquierda = ancho;
  let derecha = -1;
  let arriba = alto;
  let abajo = -1;

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (datos[(y * ancho + x) * 4 + 3] === 0) continue;
      if (x < izquierda) izquierda = x;
      if (x > derecha) derecha = x;
      if (y < arriba) arriba = y;
      if (y > abajo) abajo = y;
    }
  }

  return derecha === -1 ? null : { izquierda, derecha, arriba, abajo };
}

/**
 * Rectangulo de recorte centrado en el centro del lienzo que cubre los
 * limites. Hacia el lado corto sobra transparencia; nunca queda arte afuera.
 */
export function recorteSimetrico(limites, ancho, alto) {
  const centroX = ancho / 2;
  const centroY = alto / 2;
  const mitadX = Math.max(centroX - limites.izquierda, limites.derecha + 1 - centroX);
  const mitadY = Math.max(centroY - limites.arriba, limites.abajo + 1 - centroY);

  const x = Math.max(0, Math.floor(centroX - mitadX));
  const y = Math.max(0, Math.floor(centroY - mitadY));
  return {
    x,
    y,
    ancho: Math.min(ancho, Math.ceil(centroX + mitadX)) - x,
    alto: Math.min(alto, Math.ceil(centroY + mitadY)) - y,
  };
}

/** True si el arte llega al borde del lienzo: señal de que el margen quedo corto. */
export function tocaElBorde(limites, ancho, alto) {
  return (
    limites.izquierda === 0 ||
    limites.arriba === 0 ||
    limites.derecha === ancho - 1 ||
    limites.abajo === alto - 1
  );
}

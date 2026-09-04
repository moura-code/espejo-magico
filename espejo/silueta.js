// Convierte la mascara de segmentacion de MediaPipe en algo que el lienzo pueda
// usar para recortar: una imagen blanca cuyo CANAL ALFA es la confianza de que
// ahi hay una persona.
//
// Hace falta esta traduccion porque la mascara viene como un byte de confianza
// por pixel, sin alfa: dibujada tal cual, `destination-in` la ve opaca en todos
// lados y no recorta nada. Con el alfa puesto, recortar la persona del espejo
// para meter el fondo de la carrera atras es una sola operacion del lienzo.
//
// El borde queda suave porque la confianza tambien lo es, y eso es deseado: un
// recorte de borde duro delata el truco, uno difuso se lee como profundidad.

/**
 * Escribe en `destino` (RGBA) un blanco con alfa igual a la confianza.
 *
 * Se separa del lienzo a proposito: es la unica parte que se puede probar sin
 * navegador, y es donde estaria el error si la silueta saliera invertida.
 */
export function alfaDesdeConfianza(confianza, destino) {
  for (let i = 0, j = 0; i < confianza.length; i++, j += 4) {
    destino[j] = 255;
    destino[j + 1] = 255;
    destino[j + 2] = 255;
    destino[j + 3] = confianza[i];
  }
  return destino;
}

/**
 * `crearLienzo` se inyecta para poder probar esto sin DOM. En el navegador es
 * `() => document.createElement('canvas')`.
 */
export function crearSilueta({ crearLienzo }) {
  const lienzo = crearLienzo();
  const ctx = lienzo.getContext('2d');
  let imagen = null;

  return {
    /**
     * Devuelve el lienzo con la silueta lista para recortar, o null si no hay
     * mascara. El lienzo se reusa entre cuadros: crear uno nuevo por cuadro es
     * basura para el recolector cada 50 ms.
     *
     * Nunca lanza. Una mascara ya cerrada por MediaPipe —pasa cuando la pose se
     * pierde justo entre dos cuadros— tiene que degradar a "no hay silueta", no
     * tirar el bucle de dibujo entero.
     */
    actualizar(mascara) {
      if (!mascara?.getAsUint8Array) return null;

      let confianza;
      try {
        confianza = mascara.getAsUint8Array();
      } catch {
        return null;
      }

      const { width: ancho, height: alto } = mascara;
      if (!ancho || !alto || confianza.length < ancho * alto) return null;

      if (lienzo.width !== ancho || lienzo.height !== alto) {
        lienzo.width = ancho;
        lienzo.height = alto;
        imagen = null;
      }
      if (!imagen) imagen = ctx.createImageData(ancho, alto);

      alfaDesdeConfianza(confianza, imagen.data);
      ctx.putImageData(imagen, 0, 0);
      return lienzo;
    },

    lienzo: () => lienzo,
  };
}

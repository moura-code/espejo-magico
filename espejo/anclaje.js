// Coloca el accesorio de la carrera sobre la cabeza.
//
// Cada PNG declara donde estan los ojos DENTRO DE SU PROPIO DIBUJO, en
// coordenadas normalizadas. El codigo alinea esos dos puntos con los dos ojos
// detectados, y de ahi salen posicion, escala y rotacion de una sola forma para
// todas las carreras.
//
// Lo que importa de esto: quien dibuja no necesita saber nada de programacion,
// solo marcar donde van los ojos. Cambiar un casco no toca una linea de JS.
//
// Se dibuja asi:
//   translate(x, y) -> rotate(angulo) -> scale(escala) -> drawImage(img, -anclaX, -anclaY)

export function calcularAnclaje(rostro, accesorio, imagen) {
  if (!rostro || !accesorio || !imagen) return null;

  const dx = rostro.ojoDer.x - rostro.ojoIzq.x;
  const dy = rostro.ojoDer.y - rostro.ojoIzq.y;
  const distanciaOjos = Math.hypot(dx, dy);
  if (distanciaOjos === 0) return null;

  const anclaIzq = {
    x: accesorio.anclaOjoIzq[0] * imagen.ancho,
    y: accesorio.anclaOjoIzq[1] * imagen.alto,
  };
  const anclaDer = {
    x: accesorio.anclaOjoDer[0] * imagen.ancho,
    y: accesorio.anclaOjoDer[1] * imagen.alto,
  };
  const distanciaAnclas = Math.hypot(anclaDer.x - anclaIzq.x, anclaDer.y - anclaIzq.y);
  if (distanciaAnclas === 0) return null;

  const angulo = Math.atan2(dy, dx);

  // offsetY se mide en multiplos de la distancia entre ojos y se aplica sobre el
  // eje vertical DE LA CABEZA, no de la pantalla: la perpendicular al vector que
  // une los ojos es (-sen a, cos a), que con la cabeza derecha da (0, 1). Asi un
  // casco sigue quedando sobre la frente aunque la persona incline la cabeza.
  const desplazamiento = (accesorio.offsetY ?? 0) * distanciaOjos;

  const medioX = (rostro.ojoIzq.x + rostro.ojoDer.x) / 2;
  const medioY = (rostro.ojoIzq.y + rostro.ojoDer.y) / 2;

  return {
    x: medioX - Math.sin(angulo) * desplazamiento,
    y: medioY + Math.cos(angulo) * desplazamiento,
    angulo,
    escala: distanciaOjos / distanciaAnclas,
    anclaX: (anclaIzq.x + anclaDer.x) / 2,
    anclaY: (anclaIzq.y + anclaDer.y) / 2,
  };
}

export const TEXTOS_EXPERIENCIA = Object.freeze({
  esperaTitulo: '¿Cómo es la cara de la ingeniería?',
  encuentroTitulo: 'No vamos a adivinar quién sos.',
  encuentroBajada: 'Vamos a mostrarte una posibilidad.',
  sorteo: 'Entre muchos futuros posibles…',
  azarTitulo: 'Esta carrera fue sorteada.',
  azarDetalle: 'Ninguna característica visible determinó el resultado.',
  cierrePrediccionTitulo: 'No era una predicción.',
  cierrePrediccionBajada: 'Era una posibilidad.',
  cierreTitulo: 'La ingeniería tiene muchas caras.',
  cierreBajada: 'Una puede ser la tuya.',
});

export function tituloDeRevelacion(carrera) {
  return carrera?.nombre ? `Hoy podés verte en ${carrera.nombre}.` : '';
}

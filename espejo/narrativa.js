export const TEXTOS_EXPERIENCIA = Object.freeze({
  esperaTitulo: '¿Podés verte haciendo ingeniería?',
  esperaBajada: 'Acercate y descubrí una posibilidad.',
  sorteo: 'El espejo está buscando una posibilidad…',
  antesDeReflexionTitulo: 'Mirate por unos segundos.',
  antesDeReflexionPregunta: '¿Era esta la imagen que esperabas?',
  azarTitulo: 'Esta carrera fue sorteada.',
  azarDetalle: 'No usamos tu apariencia para elegirla ni evaluar tus capacidades.',
  devolucionTitulo: 'El espejo no adivina quién sos.',
  devolucionBajada: 'Revela qué esperábamos ver.',
  devolucion:
    'Aquello que nos sorprende también habla de las imágenes que aprendimos sobre quién puede ocupar determinados lugares.',
  cierreTitulo: 'La ingeniería no tiene un rostro único.',
  cierreBajada: 'Los estereotipos sí.',
});

export function tituloDeRevelacion(carrera) {
  return carrera?.nombre ? `Hoy te ves en ${carrera.nombre}` : '';
}

export function preguntaDeReflexion(carrera) {
  if (!carrera) return '';
  return carrera.preguntaReflexiva ?? `¿Te sorprendió verte en ${carrera.nombre}?`;
}

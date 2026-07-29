const suavizar = (valor) => valor * valor * (3 - 2 * valor);

export function calcularCierreDeAusencia({
  ahora,
  ausenciaDesde,
  esperaInicialMs,
  intervaloMs,
  cierreMs,
  cerradoMs,
  aperturaMs,
}) {
  if (ausenciaDesde === null) return 0;
  const transcurrido = ahora - ausenciaDesde - esperaInicialMs;
  if (transcurrido < 0) return 0;

  const duracionAnimacion = cierreMs + cerradoMs + aperturaMs;
  const fase = transcurrido % (duracionAnimacion + intervaloMs);
  if (fase < cierreMs) return suavizar(fase / cierreMs);
  if (fase < cierreMs + cerradoMs) return 1;
  if (fase < duracionAnimacion) {
    return 1 - suavizar((fase - cierreMs - cerradoMs) / aperturaMs);
  }
  return 0;
}

// Relojes independientes para los tres modelos de visión. Decide cuándo toca
// intentar cada uno, pero sólo avanza su reloj cuando main.js confirma que el
// detector se ejecutó: si el lienzo de análisis todavía no está listo, se
// vuelve a intentar en el cuadro siguiente.
export function crearPlanificadorDeDetectores() {
  const ultimas = { rostro: 0, manos: 0, pose: 0 };
  let intervalos = { rostro: Infinity, manos: Infinity, pose: Infinity };
  let escalonados = false;

  const intervalo = (fps) => (Number.isFinite(fps) && fps > 0 ? 1000 / fps : Infinity);

  return {
    pendientes({ ahora, frecuencias, habilitados }) {
      intervalos = {
        rostro: intervalo(frecuencias.rostro),
        manos: intervalo(frecuencias.manos),
        pose: intervalo(frecuencias.pose),
      };

      return {
        rostro:
          Boolean(habilitados.rostro) && ahora - ultimas.rostro >= intervalos.rostro,
        manos:
          escalonados &&
          Boolean(habilitados.manos) &&
          ahora - ultimas.manos >= intervalos.manos,
        pose:
          escalonados &&
          Boolean(habilitados.pose) &&
          ahora - ultimas.pose >= intervalos.pose,
      };
    },

    registrar(tipo, ahora) {
      if (!(tipo in ultimas)) return;
      ultimas[tipo] = ahora;

      if (tipo === 'rostro' && !escalonados) {
        escalonados = true;
        ultimas.pose = ahora;
        ultimas.manos = ahora - (intervalos.manos * 2) / 3;
      }
    },
  };
}

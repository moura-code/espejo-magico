import { ESTADOS } from './maquina-estados.js';

const CLAVE_DE_TIEMPO = {
  [ESTADOS.ENGANCHE]: 'enganche',
  [ESTADOS.SORTEO]: 'sorteo',
  [ESTADOS.REVELACION]: 'revelacion',
  [ESTADOS.ESCENA]: 'escena',
  [ESTADOS.REFLEXION]: 'reflexion',
  [ESTADOS.CIERRE]: 'cierre',
};

const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

export function calcularTemporizadorEstado({ estado, transcurrido, tiempos, manual }) {
  if (manual) return null;

  const clave = CLAVE_DE_TIEMPO[estado];
  const duracionMs = tiempos?.[clave];
  if (!clave || !Number.isFinite(duracionMs) || duracionMs <= 0) return null;

  const transcurridoSeguro = Number.isFinite(transcurrido) ? Math.max(0, transcurrido) : 0;
  const restanteMs = limitar(duracionMs - transcurridoSeguro, 0, duracionMs);
  return {
    duracionMs,
    restanteMs,
    segundosRestantes: Math.ceil(restanteMs / 1000),
    proporcionRestante: restanteMs / duracionMs,
  };
}

import { ACCIONES, mensajeControles } from '../comun/protocolo.js';
import { ESTADOS } from './maquina-estados.js';

const BOTON_CANCELAR = {
  id: ACCIONES.REINICIAR,
  etiqueta: 'CANCELAR',
  color: '#FF6B88',
};

const BOTON_AVANZAR = {
  id: ACCIONES.AVANZAR,
  etiqueta: 'AVANZAR',
  color: '#7CFFB2',
};

const ESTADOS_CON_AVANCE_VISIBLE = new Set([
  ESTADOS.ATRACCION,
  ESTADOS.ESCENA,
  ESTADOS.CIERRE,
]);

const BOTONES_POR_ESTADO = {
  [ESTADOS.ATRACCION]: [
    {
      id: ACCIONES.EMPEZAR,
      etiqueta: 'EMPEZAR',
      color: '#7CFFB2',
    },
  ],
  [ESTADOS.ENGANCHE]: [BOTON_CANCELAR],
  [ESTADOS.SORTEO]: [BOTON_CANCELAR],
  [ESTADOS.REVELACION]: [BOTON_CANCELAR],
  [ESTADOS.ESCENA]: [
    {
      id: ACCIONES.OTRA_CARRERA,
      etiqueta: 'OTRA CARRERA',
      color: '#62D8FF',
    },
    {
      id: ACCIONES.TERMINAR,
      etiqueta: 'TERMINAR',
      color: '#FFD23F',
    },
  ],
  [ESTADOS.REFLEXION]: [],
  [ESTADOS.CIERRE]: [
    {
      id: ACCIONES.REINICIAR,
      etiqueta: 'VOLVER AL INICIO',
      color: '#7CFFB2',
    },
  ],
};

export function botonesParaEstado(estado, { manual = false } = {}) {
  const botones = (BOTONES_POR_ESTADO[estado] ?? []).map((boton) => ({ ...boton }));

  if (manual && !ESTADOS_CON_AVANCE_VISIBLE.has(estado)) {
    botones.push({ ...BOTON_AVANZAR });
  }
  return botones;
}

export function controlesParaEstado(estado, opciones) {
  return mensajeControles(estado, botonesParaEstado(estado, opciones));
}

export function ejecutarAccionRemota({ id, estado, maquina, ahora }) {
  const manual = maquina.esManual?.() ?? false;
  const permitida = botonesParaEstado(estado, { manual }).some((boton) => boton.id === id);
  if (!permitida) return null;
  if (
    id === ACCIONES.EMPEZAR ||
    id === ACCIONES.AVANZAR ||
    id === ACCIONES.TERMINAR
  ) {
    return maquina.avanzar(ahora);
  }
  return maquina.reiniciar(ahora);
}

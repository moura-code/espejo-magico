import { ACCIONES, mensajeControles } from '../comun/protocolo.js';
import { ESTADOS } from './maquina-estados.js';

const BOTON_CANCELAR = {
  id: ACCIONES.REINICIAR,
  etiqueta: 'CANCELAR',
  color: '#FF6B88',
};

const BOTONES_POR_ESTADO = {
  [ESTADOS.ATRACCION]: [],
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
  [ESTADOS.CIERRE]: [
    {
      id: ACCIONES.REINICIAR,
      etiqueta: 'VOLVER AL INICIO',
      color: '#7CFFB2',
    },
  ],
};

export function botonesParaEstado(estado) {
  return (BOTONES_POR_ESTADO[estado] ?? []).map((boton) => ({ ...boton }));
}

export function controlesParaEstado(estado) {
  return mensajeControles(estado, botonesParaEstado(estado));
}

export function ejecutarAccionRemota({ id, estado, maquina, ahora }) {
  const permitida = botonesParaEstado(estado).some((boton) => boton.id === id);
  if (!permitida) return null;
  if (id === ACCIONES.TERMINAR) return maquina.avanzar(ahora);
  return maquina.reiniciar(ahora);
}

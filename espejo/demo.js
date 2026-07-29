import { ESTADOS } from './maquina-estados.js';

export function crearControlDemo({
  ids,
  pausaSinPersonaMs,
}) {
  const totalCarreras = new Set(ids).size;
  let activo = false;
  let manualAnterior = false;
  let sinPersonaHasta = 0;
  const carrerasVistas = new Set();

  function registrar(eventos, ahora) {
    if (!activo) return;

    for (const evento of eventos) {
      if (evento.tipo === 'carrera') carrerasVistas.add(evento.id);
      if (evento.tipo === 'entra' && evento.estado === ESTADOS.ATRACCION) {
        sinPersonaHasta = ahora + pausaSinPersonaMs;
      }
    }
  }

  return {
    activar({ maquina, ahora }) {
      if (activo) return null;
      activo = true;
      manualAnterior = maquina.esManual();
      maquina.establecerManual(false);
      carrerasVistas.clear();
      sinPersonaHasta = ahora + pausaSinPersonaMs;
      return maquina.reiniciar(ahora);
    },

    desactivar({ maquina, ahora }) {
      if (!activo) return null;
      activo = false;
      maquina.establecerManual(manualAnterior);
      return maquina.reiniciar(ahora);
    },

    registrar,
    activo: () => activo,
    personaVisible: (ahora) => !activo || ahora >= sinPersonaHasta,

    resumen() {
      return {
        activo,
        carrerasVistas: carrerasVistas.size,
        totalCarreras,
        completo: carrerasVistas.size === totalCarreras,
      };
    },
  };
}

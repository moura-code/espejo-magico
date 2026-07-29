import { ESTADOS } from './maquina-estados.js';

const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

export function crearControlDemo({
  ids,
  pausaSinPersonaMs,
  interaccionDesdeMs,
  transicionManoMs,
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

    objetivoDeMano({ estado, transcurrido, sesion, botones }) {
      if (!activo || estado !== ESTADOS.ESCENA || transcurrido < interaccionDesdeMs) {
        return null;
      }

      const id = sesion % 2 === 1 ? 'otra-carrera' : 'terminar';
      const boton = botones.find((candidato) => candidato.id === id);
      if (!boton) return null;

      return {
        id,
        x: boton.x + boton.ancho / 2,
        y: boton.y + boton.alto / 2,
        progreso: limitar((transcurrido - interaccionDesdeMs) / transicionManoMs, 0, 1),
      };
    },

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

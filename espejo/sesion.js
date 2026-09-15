// Logica de sesion para la seleccion aleatoria y distribucion de objetos.
//
// Al iniciar la sesion, para cada carrera ofrecida en el carrusel se elige
// aleatoriamente uno de sus objetos. Cuando la persona elige una carrera, los
// demas objetos se barajan y se asignan a los slots de escondites disponibles.
// Toda asignacion permanece inmutable durante el resto de la sesion.
//
// Recibe un generador de azar inyectable para posibilitar pruebas deterministas.

import { barajar } from './sorteo.js';

export function seleccionarObjetoDeCarrera(objetos, azar = Math.random) {
  if (!Array.isArray(objetos) || objetos.length === 0) return null;
  const indice = Math.floor(azar() * objetos.length);
  return objetos[Math.min(indice, objetos.length - 1)] ?? null;
}

export function distribuirEscondidosEnSlots({
  objetos,
  objetoElegido,
  slots,
  azar = Math.random,
}) {
  if (!Array.isArray(objetos) || !Array.isArray(slots)) return [];
  const restantes = objetoElegido
    ? objetos.filter((o) => (o.id !== undefined ? o.id !== objetoElegido.id : o !== objetoElegido))
    : [...objetos];

  const mezclados = barajar(restantes, azar);
  const cantidad = Math.min(mezclados.length, slots.length);

  return mezclados.slice(0, cantidad).map((definicion, indice) => ({
    definicion,
    lugar: slots[indice],
    indice,
  }));
}

export function crearSesionContenido({ contenido, azar = Math.random } = {}) {
  const representantes = new Map();
  const distribuciones = new Map();

  return {
    iniciar(opciones = []) {
      for (const id of opciones) {
        if (!representantes.has(id)) {
          const carrera = contenido.obtener(id);
          if (carrera?.objetos?.length) {
            representantes.set(id, seleccionarObjetoDeCarrera(carrera.objetos, azar));
          }
        }
      }
    },

    representanteDe(carreraId) {
      if (!representantes.has(carreraId)) {
        const carrera = contenido.obtener(carreraId);
        if (carrera?.objetos?.length) {
          representantes.set(carreraId, seleccionarObjetoDeCarrera(carrera.objetos, azar));
        }
      }
      return representantes.get(carreraId) ?? null;
    },

    disposicionDe(carreraId, fondo = null) {
      if (!distribuciones.has(carreraId)) {
        const carrera = contenido.obtener(carreraId);
        if (!carrera) return null;

        const elegido = this.representanteDe(carreraId);
        const f =
          fondo ??
          (carrera.fondos?.find((x) => x.id === carrera.fondoActivo) ?? carrera.fondos?.[0] ?? null);

        const escondidos = f?.escondites
          ? distribuirEscondidosEnSlots({
              objetos: carrera.objetos,
              objetoElegido: elegido,
              slots: f.escondites,
              azar,
            })
          : [];

        distribuciones.set(carreraId, { elegido, escondidos });
      }
      return distribuciones.get(carreraId);
    },

    reiniciar() {
      representantes.clear();
      distribuciones.clear();
    },
  };
}

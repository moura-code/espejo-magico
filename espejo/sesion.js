// Logica de sesion para la seleccion y distribucion de objetos.
//
// Al iniciar la sesion, para cada carrera ofrecida en el carrusel se elige uno
// de sus objetos. Cuando la persona elige una carrera, los demas se asignan a
// los escondites del fondo. Toda asignacion permanece inmutable durante el
// resto de la sesion.
//
// EL AZAR DEPENDE DEL FONDO, y no es un detalle: con un fondo generado los
// cinco objetos estan PINTADOS ADENTRO de la foto, cada uno en su sitio y con
// su mascara, y en una foto real estan FOTOGRAFIADOS adentro, con su PNG
// calzado encima. Barajarlos ahi pondria la ficha del matraz sobre la columna
// de destilacion, porque la foto no se baraja. Asi que con los objetos adentro
// de la foto el reparto es el que fijo el contenido —el primero al carrusel y
// los otros en orden— y el azar queda para los fondos con objetos sueltos,
// donde dos visitantes seguidos no ven lo mismo.
//
// Recibe un generador de azar inyectable para posibilitar pruebas deterministas.

import { barajar } from './sorteo.js';
import { fondoActivo, objetosEnLaFoto } from './contenido.js';

/** Si el fondo que se va a mostrar trae los objetos adentro de la foto. */
const conObjetosEnLaFoto = (fondo) => Boolean(objetosEnLaFoto(fondo));

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
  barajarlos = true,
}) {
  if (!Array.isArray(objetos) || !Array.isArray(slots)) return [];
  const restantes = objetoElegido
    ? objetos.filter((o) => (o.id !== undefined ? o.id !== objetoElegido.id : o !== objetoElegido))
    : [...objetos];

  const repartidos = barajarlos ? barajar(restantes, azar) : restantes;
  const cantidad = Math.min(repartidos.length, slots.length);

  return repartidos.slice(0, cantidad).map((definicion, indice) => ({
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
      for (const id of opciones) this.representanteDe(id);
    },

    representanteDe(carreraId) {
      if (!representantes.has(carreraId)) {
        const carrera = contenido.obtener(carreraId);
        if (carrera?.objetos?.length) {
          // Con los objetos adentro de la foto, el del carrusel es el primero:
          // es el que esta en el sitio al que va a volar.
          representantes.set(
            carreraId,
            conObjetosEnLaFoto(fondoActivo(carrera))
              ? carrera.objetos[0]
              : seleccionarObjetoDeCarrera(carrera.objetos, azar),
          );
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
              barajarlos: !conObjetosEnLaFoto(f),
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

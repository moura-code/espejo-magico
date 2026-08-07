// Pool de objetos con presupuesto fijo.
//
// El tope de objetos simultaneos es lo que hace que el rendimiento no dependa de
// cuanto tiempo lleve alguien sentado, que es lo que suele degradar estas
// instalaciones sobre el final del dia.

import { paso } from './fisica.js';
import { ESTADOS } from './maquina-estados.js';

const MS_DE_DESVANECIDO = 500;

/**
 * Que objetos caen en cada estado.
 *
 * En reposo no cae nada: las nubes son la invitacion. Desde la revelacion caen
 * SOLO los objetos de la carrera sorteada.
 *
 * El "en el medio no cae nada" es deliberado y costo una prueba con publico: los
 * objetos de todas las carreras que caian durante el enganche y el sorteo seguian
 * en pantalla cuando se abria la niebla, asi que la revelacion mostraba una pila
 * mezclada en vez de la carrera que le habia tocado al visitante.
 */
export function fuenteDeObjetos(estado, carrera, carreras) {
  if (estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA) {
    return carrera ? carrera.objetos : null;
  }
  return null;
}

export function crearPool({ maximo, vidaMs }) {
  const vivos = [];

  return {
    aparecer(definicion, cuerpo, ahora) {
      while (vivos.length >= maximo) vivos.shift();
      const objeto = { definicion, cuerpo, nacido: ahora, alfa: 1, retiro: null };
      vivos.push(objeto);
      return objeto;
    },

    actualizar(dt, ahora, mundo) {
      paso(
        vivos.map((objeto) => objeto.cuerpo),
        dt,
        mundo,
      );

      for (const objeto of vivos) {
        const restante = vidaMs - (ahora - objeto.nacido);
        const alfaNatural =
          restante >= MS_DE_DESVANECIDO ? 1 : Math.max(0, restante / MS_DE_DESVANECIDO);
        const alfaRetiro = objeto.retiro
          ? Math.max(
              0,
              (objeto.retiro.hasta - ahora) /
                Math.max(1, objeto.retiro.hasta - objeto.retiro.desde),
            )
          : 1;
        objeto.alfa = Math.min(alfaNatural, alfaRetiro);
      }

      for (let i = vivos.length - 1; i >= 0; i--) {
        const objeto = vivos[i];
        if (
          ahora - objeto.nacido >= vidaMs ||
          (objeto.retiro && ahora >= objeto.retiro.hasta)
        ) {
          vivos.splice(i, 1);
        }
      }
    },

    /**
     * Adelanta el final de todo lo que este vivo para que se vaya en `enMs`,
     * desvaneciendose. A diferencia de vaciar(), no los hace desaparecer de
     * golpe: eso se lee como un error del sistema, no como una transicion.
     */
    retirar(ahora, enMs = MS_DE_DESVANECIDO) {
      for (const objeto of vivos) {
        const muerteNatural = objeto.nacido + vidaMs;
        const hasta = Math.min(muerteNatural, ahora + enMs);
        if (!objeto.retiro || hasta < objeto.retiro.hasta) {
          objeto.retiro = { desde: ahora, hasta };
        }
      }
    },

    vivos: () => vivos,
    vaciar: () => {
      vivos.length = 0;
    },
  };
}

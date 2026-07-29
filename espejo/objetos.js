// Pool de objetos con presupuesto fijo.
//
// El tope de objetos simultaneos es lo que hace que el rendimiento no dependa de
// cuanto tiempo lleve alguien sentado, que es lo que suele degradar estas
// instalaciones sobre el final del dia.

import { paso } from './fisica.js';
import { ESTADOS } from './maquina-estados.js';

const MS_DE_DESVANECIDO = 500;

export const PLANOS_OBJETOS = Object.freeze({
  ATRAS: 'atras',
  PERSONA: 'persona',
  FRENTE: 'frente',
});

export const ORDEN_PLANOS_OBJETOS = Object.freeze([
  PLANOS_OBJETOS.ATRAS,
  PLANOS_OBJETOS.PERSONA,
  PLANOS_OBJETOS.FRENTE,
]);

/**
 * Que objetos caen en cada estado.
 *
 * En atraccion y sorteo caen los de todas las carreras. Desde la revelacion
 * caen SOLO los de la carrera sorteada.
 *
 * Al entrar en revelacion, main vacia el pool mientras la niebla sigue cerrada.
 * Asi el sorteo puede mostrar futuros diversos sin contaminar la escena elegida.
 */
export function fuenteDeObjetos(estado, carrera, carreras) {
  if (estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA) {
    return carrera ? carrera.objetos : null;
  }
  if (estado === ESTADOS.ATRACCION || estado === ESTADOS.SORTEO) {
    return carreras.flatMap((c) => c.objetos);
  }
  return null;
}

export function crearPool({ maximo, vidaMs }) {
  const vivos = [];
  let proximoPlano = 0;

  return {
    aparecer(definicion, cuerpo, ahora, plano = null) {
      while (vivos.length >= maximo) vivos.shift();
      const planoElegido = ORDEN_PLANOS_OBJETOS.includes(plano)
        ? plano
        : ORDEN_PLANOS_OBJETOS[proximoPlano++ % ORDEN_PLANOS_OBJETOS.length];
      const objeto = {
        definicion,
        cuerpo,
        nacido: ahora,
        alfa: 1,
        plano: planoElegido,
      };
      vivos.push(objeto);
      return objeto;
    },

    actualizar(dt, ahora, mundo) {
      for (const plano of ORDEN_PLANOS_OBJETOS) {
        paso(
          vivos
            .filter((objeto) => objeto.plano === plano)
            .map((objeto) => objeto.cuerpo),
          dt,
          {
            ...mundo,
            colisionadores:
              plano === PLANOS_OBJETOS.ATRAS
                ? []
                : mundo.colisionadores,
          },
        );
      }

      for (const objeto of vivos) {
        const restante = vidaMs - (ahora - objeto.nacido);
        objeto.alfa =
          restante >= MS_DE_DESVANECIDO ? 1 : Math.max(0, restante / MS_DE_DESVANECIDO);
      }

      for (let i = vivos.length - 1; i >= 0; i--) {
        if (ahora - vivos[i].nacido >= vidaMs) vivos.splice(i, 1);
      }
    },

    /**
     * Adelanta el final de todo lo que este vivo para que se vaya en `enMs`,
     * desvaneciendose. A diferencia de vaciar(), no los hace desaparecer de
     * golpe: eso se lee como un error del sistema, no como una transicion.
     */
    retirar(ahora, enMs = MS_DE_DESVANECIDO) {
      const nacimientoLimite = ahora + enMs - vidaMs;
      for (const objeto of vivos) {
        objeto.nacido = Math.min(objeto.nacido, nacimientoLimite);
      }
    },

    vivos: () => vivos,
    enPlano: (plano) => vivos.filter((objeto) => objeto.plano === plano),
    vaciar: () => {
      vivos.length = 0;
      proximoPlano = 0;
    },
  };
}

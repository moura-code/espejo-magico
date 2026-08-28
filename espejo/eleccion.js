// El sostenido: como se elige un objeto sin tocar nada.
//
// Entra "donde estan las manos" y "donde estan los objetos", sale "sobre cual
// esta la mano, cuanto lleva y si ya alcanzo". No sabe que es una carrera, no
// dibuja el anillo y no toca la maquina de estados: por eso se prueba entero sin
// camara y sin pantalla.
//
// Las dos decisiones que hacen que se sienta bien:
//
//   1. UNA PERDIDA CORTA NO CUESTA NADA, Y UNA LARGA VACIA DE A POCO. La
//      deteccion de manos se pierde varios cuadros por segundo con la mano de
//      costado o mal iluminada, que es lo normal en un stand. Con solo un olvido
//      gradual no alcanzaba: como vaciar es mas rapido que llenar, un 25% de
//      cuadros perdidos convertia 1,5 s de sostenido en doce. La gracia es la
//      misma idea que CONFIG.presencia.msParaSalir para el rostro — entrar
//      rapido, salir lento — aplicada a la mano.
//   2. CAMBIAR DE BLANCO SI EMPIEZA DE CERO. Mover el brazo a otro objeto es
//      deliberado: heredar lo acumulado haria que el segundo se eligiera casi
//      instantaneamente.

// Tope del salto de reloj entre dos llamadas. Si el navegador se traba un
// instante, un salto grande completaria un sostenido que nadie hizo.
const DT_MAXIMO = 250;

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/**
 * Sobre cual de los blancos esta la mano. Devuelve el id del mas cercano a su
 * centro entre los que la contienen, o null.
 *
 * Se mide contra el CENTRO del blanco y no contra el borde: dos blancos que se
 * superponen tienen que repartirse la mano por cercania, no por orden de lista.
 */
export function blancoBajoLaMano(manos, objetivos, radioFactor = 1) {
  let mejor = null;
  let mejorDistancia = Infinity;

  for (const objetivo of objetivos) {
    const alcance = objetivo.radio * radioFactor;
    for (const mano of manos) {
      const distancia = Math.hypot(mano.palma.x - objetivo.x, mano.palma.y - objetivo.y);
      if (distancia <= alcance && distancia < mejorDistancia) {
        mejor = objetivo.id;
        mejorDistancia = distancia;
      }
    }
  }

  return mejor;
}

export function crearEleccion({ msParaElegir, msDeOlvido, msDeGracia = 0, radioFactor = 1 }) {
  let sobre = null;
  let acumulado = 0;
  let elegido = null;
  let ultimoReloj = null;
  let fueraDesde = null;

  // Lo que se descuenta por milisegundo al sacar la mano, para que un anillo
  // lleno se vacie exactamente en `msDeOlvido`.
  const ritmoDeOlvido = msParaElegir / Math.max(1, msDeOlvido);

  const salida = () => ({
    sobre,
    progreso: acotar(acumulado / Math.max(1, msParaElegir), 0, 1),
    elegido,
  });

  return {
    /**
     * `objetivos` son `{ id, x, y, radio }` y `manos` son `{ palma: {x, y} }`.
     *
     * `elegido` es "sobre cual esta la mano ahora, ya sostenida", no "cual
     * eligio la persona para siempre". Se suelta cuando la mano se va o se
     * mueve a otro blanco, y eso es lo que hace posible recorrer las cinco
     * ingenierias en una sola sesion. Quien recibe el elegido tiene que
     * aguantar que se repita cuadro a cuadro mientras la mano no se mueva.
     */
    actualizar({ manos = [], objetivos = [], ahora }) {
      const dt = ultimoReloj === null ? 0 : acotar(ahora - ultimoReloj, 0, DT_MAXIMO);
      ultimoReloj = ahora;

      const ahoraSobre = blancoBajoLaMano(manos, objetivos, radioFactor);

      if (ahoraSobre === null) {
        if (fueraDesde === null) fueraDesde = ahora;

        // Dentro de la gracia el progreso se congela: no sube, pero tampoco
        // baja. Que no suba importa — si no, bastaria con apoyar la mano y
        // sacarla para que el anillo siguiera solo.
        if (ahora - fueraDesde >= msDeGracia) {
          acumulado = Math.max(0, acumulado - dt * ritmoDeOlvido);
          // El blanco se suelta recien cuando el anillo termina de vaciarse:
          // hasta ahi sigue siendo "el que estabas por elegir", y volver a poner
          // la mano continua desde donde iba.
          if (acumulado === 0) {
            sobre = null;
            elegido = null;
          }
        }
      } else {
        fueraDesde = null;
        if (ahoraSobre !== sobre) {
          // Mover el brazo a otro objeto es deliberado: heredar lo acumulado
          // haria que el segundo se eligiera casi instantaneamente, y pasar por
          // encima de uno camino a otro valdria por una eleccion.
          sobre = ahoraSobre;
          acumulado = 0;
          elegido = null;
        }
        acumulado += dt;
        if (acumulado >= msParaElegir) elegido = sobre;
      }

      return salida();
    },

    sobre: () => sobre,
    elegido: () => elegido,
    progreso: () => salida().progreso,

    reiniciar() {
      sobre = null;
      acumulado = 0;
      elegido = null;
      ultimoReloj = null;
      fueraDesde = null;
    },
  };
}

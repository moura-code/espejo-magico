// La ficha de cada objeto del fondo: que objeto se esta describiendo y cuanto
// se ve cada descripcion. Entra "donde estan las manos" y "donde estan los
// objetos", sale un alfa por objeto. No sabe que es una ingenieria, no dibuja
// y no toca la maquina de estados: por eso se prueba entero sin camara.
//
// Es el hermano tranquilo del sostenido (eleccion.js). Alla la mano elige, una
// sola vez y para siempre; aca solo pregunta "¿que es esto?", todas las veces
// que quiera. Las dos decisiones que lo hacen tranquilo:
//
//   1. ABRIR PIDE UN MOMENTO Y CERRAR PIDE OTRO, MAS LARGO. Una ficha que se
//      abre al primer cuadro se abre con cada mano que pasa camino a otro
//      lado, y una que se cierra al primero parpadea con cada deteccion
//      perdida. `msParaMostrar` filtra el paso; `msDeGracia` absorbe los
//      huecos de la deteccion y deja terminar de leer despues de bajar la mano.
//   2. NUNCA HAY UN SALTO. Cada ficha tiene su alfa y va hacia 1 o hacia 0 a
//      su ritmo (`msDeEntrada`, `msDeSalida`): pasar de un objeto a otro es un
//      fundido cruzado, no un corte. La catedra pidio evitar cosas que
//      parpadean; esto es lo que lo garantiza.

import { blancoBajoLaMano } from './eleccion.js';
// Lo mas que cuenta un cuadro: si el navegador se traba, una ficha se frena en
// vez de encenderse o apagarse de golpe.
import { DT_MAXIMO } from './suavizado.js';

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

export function crearFichas({ msParaMostrar, msDeGracia, msDeEntrada, msDeSalida, radioFactor = 1 }) {
  let candidata = null;
  let candidataDesde = null;
  let activa = null;
  let fueraDesde = null;
  let primera = null;
  let ultimoReloj = null;
  const alfas = new Map();

  return {
    /**
     * `objetivos` son `{ id, x, y, radio }` y `manos` son `{ palma: {x, y} }`.
     *
     * Devuelve `activa` —la ficha que se esta mostrando, o null—, `alfas` —el
     * de cada ficha que se ve, solo las que valen mas que cero— y `primera`, el
     * momento en que se abrio la primera ficha de la sesion: la consigna que
     * enseña a pasar la mano se apaga ahi, porque el gesto ya se aprendio.
     */
    actualizar({ manos = [], objetivos = [], ahora }) {
      const dt = ultimoReloj === null ? 0 : acotar(ahora - ultimoReloj, 0, DT_MAXIMO);
      ultimoReloj = ahora;

      // Un objeto que ya no esta —el fondo se esta yendo— no puede dejar su
      // ficha colgada en pantalla.
      if (activa !== null && !objetivos.some((objetivo) => objetivo.id === activa)) {
        activa = null;
      }

      const bajo = blancoBajoLaMano(manos, objetivos, radioFactor);

      if (bajo === null) {
        // Dentro de la gracia no se suelta nada: ni la ficha abierta ni la que
        // se estaba por abrir. Si cada hueco de la deteccion reiniciara la
        // espera, con la mano de costado no se abriria nunca.
        if (fueraDesde === null) fueraDesde = ahora;
        if (ahora - fueraDesde >= msDeGracia) {
          activa = null;
          candidata = null;
        }
      } else {
        fueraDesde = null;
        if (bajo !== candidata) {
          candidata = bajo;
          candidataDesde = ahora;
        }
        // La que ya estaba abierta sigue hasta que la nueva se gana su lugar,
        // igual que se lo gano la primera.
        if (bajo !== activa && ahora - candidataDesde >= msParaMostrar) {
          activa = bajo;
          primera ??= ahora;
        }
      }

      const ids = new Set(alfas.keys());
      if (activa !== null) ids.add(activa);
      for (const id of ids) {
        const actual = alfas.get(id) ?? 0;
        const siguiente =
          id === activa
            ? Math.min(1, actual + dt / Math.max(1, msDeEntrada))
            : Math.max(0, actual - dt / Math.max(1, msDeSalida));
        if (siguiente > 0) alfas.set(id, siguiente);
        else alfas.delete(id);
      }

      return { activa, alfas: Object.fromEntries(alfas), primera };
    },

    reiniciar() {
      candidata = null;
      candidataDesde = null;
      activa = null;
      fueraDesde = null;
      primera = null;
      ultimoReloj = null;
      alfas.clear();
    },
  };
}

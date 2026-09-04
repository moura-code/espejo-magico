import { describe, it, expect } from 'vitest';
import {
  objetivoDeNiebla,
  acercarNiebla,
  calcularTransicionEscena,
  posicionLateralNube,
  crearNiebla,
} from '../../espejo/niebla.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

// La transicion es deliberadamente lateral: una sola apertura mueve las nubes
// fuera del lienzo. No existe un segundo progreso para una mascara circular.
describe('objetivoDeNiebla', () => {
  it('el espejo descansa tapado y vuelve a taparse en el cierre', () => {
    expect(objetivoDeNiebla(ESTADOS.ATRACCION)).toEqual({ apertura: 0 });
    expect(objetivoDeNiebla(ESTADOS.CIERRE)).toEqual({ apertura: 0 });
  });

  it('empieza a despejarse apenas detecta a la persona', () => {
    for (const estado of [
      ESTADOS.ENGANCHE,
      ESTADOS.HUMO,
      ESTADOS.EXPLORACION,
    ]) {
      expect(objetivoDeNiebla(estado)).toEqual({ apertura: 1 });
    }
  });

  // El ciclo entero, sin nombrar los estados a mano: si aparece uno nuevo y
  // nadie decide si tapa o destapa, esto lo obliga a decidirlo. La version
  // anterior de esta prueba listaba ESTADOS.SORTEO, que dejo de existir, y
  // pasaba igual porque objetivoDeNiebla(undefined) cae en "abierto".
  it('cada estado del ciclo dice si tapa o destapa', () => {
    for (const [nombre, estado] of Object.entries(ESTADOS)) {
      expect(estado, `ESTADOS.${nombre} no existe`).toBeTypeOf('string');
      const tapado = estado === ESTADOS.ATRACCION || estado === ESTADOS.CIERRE;
      expect(objetivoDeNiebla(estado), nombre).toEqual({ apertura: tapado ? 0 : 1 });
    }
  });
});

describe('acercarNiebla', () => {
  const VELOCIDADES = { abrir: 2, cerrar: 0.8 };

  it('abre rapido con la velocidad configurada', () => {
    expect(acercarNiebla({ apertura: 0 }, { apertura: 1 }, 0.2, VELOCIDADES)).toEqual({
      apertura: 0.4,
    });
  });

  it('cierra con una velocidad independiente', () => {
    expect(acercarNiebla({ apertura: 1 }, { apertura: 0 }, 0.5, VELOCIDADES)).toEqual({
      apertura: 0.6,
    });
  });

  it('llega al objetivo sin pasarse', () => {
    expect(acercarNiebla({ apertura: 0.95 }, { apertura: 1 }, 1, VELOCIDADES)).toEqual({
      apertura: 1,
    });
    expect(acercarNiebla({ apertura: 0.05 }, { apertura: 0 }, 1, VELOCIDADES)).toEqual({
      apertura: 0,
    });
  });

  it('un cambio abrupto de estado mantiene acotado el paso por cuadro', () => {
    const dt = 1 / 60;
    const actual = { apertura: 1 };
    const siguiente = acercarNiebla(
      actual,
      objetivoDeNiebla(ESTADOS.CIERRE),
      dt,
      VELOCIDADES,
    );

    expect(actual.apertura - siguiente.apertura).toBeLessThanOrEqual(
      VELOCIDADES.cerrar * dt + 1e-9,
    );
  });
});

describe('posicionLateralNube', () => {
  it('manda las nubes de cada mitad hacia su lado', () => {
    expect(posicionLateralNube(0.25, 100, 1000, 0, -1)).toBe(250);
    expect(posicionLateralNube(0.75, 100, 1000, 0, 1)).toBe(750);
    expect(posicionLateralNube(0.25, 100, 1000, 1, -1)).toBe(-100);
    expect(posicionLateralNube(0.75, 100, 1000, 1, 1)).toBe(1100);
  });

  it('acota la apertura entre cerrado y abierto', () => {
    expect(posicionLateralNube(0.25, 100, 1000, -1, -1)).toBe(250);
    expect(posicionLateralNube(0.75, 100, 1000, 2, 1)).toBe(1100);
  });
});

describe('calcularTransicionEscena', () => {
  const tiempos = { enganche: 2000, humo: 3000, aparicion: 2000, vuelo: 1000, cierre: 4000 };
  const en = (estado, transcurrido, desdeLaMirada = null) =>
    calcularTransicionEscena({ estado, transcurrido, desdeLaMirada, tiempos });

  it('en reposo y en el enganche no se ve ninguna capa', () => {
    const nada = { objetos: 0, elegido: 0, fondo: 0, contenido: 0, vuelo: 0 };
    expect(en(ESTADOS.ATRACCION, 0)).toEqual(nada);
    expect(en(ESTADOS.ENGANCHE, 1000)).toEqual(nada);
  });

  // Los objetos estan puestos desde el principio del humo, pero encenderlos
  // antes de que el humo este espeso los deja verse a traves y arruina la
  // aparicion. Al terminar el estado ya estan enteros, tapados.
  it('enciende los objetos en la segunda mitad del humo', () => {
    expect(en(ESTADOS.HUMO, 0).objetos).toBe(0);
    expect(en(ESTADOS.HUMO, 1500).objetos).toBe(0);
    expect(en(ESTADOS.HUMO, 2250).objetos).toBeCloseTo(0.5);
    expect(en(ESTADOS.HUMO, 3000).objetos).toBe(1);
    expect(en(ESTADOS.HUMO, 2000).fondo).toBe(0);
  });

  it('sin nada agarrado se ven los objetos y nada mas', () => {
    const soloElCarrusel = { objetos: 1, elegido: 0, fondo: 0, contenido: 0, vuelo: 0 };
    expect(en(ESTADOS.EXPLORACION, 0)).toEqual(soloElCarrusel);
    expect(en(ESTADOS.EXPLORACION, 20000)).toEqual(soloElCarrusel);
  });

  // EL CARRUSEL SE APAGA AL ELEGIR. Se elige una sola vez, asi que dejar los
  // objetos puestos seria ofrecer algo que ya no se puede agarrar: quien
  // estirara la mano otra vez y no viera pasar nada creeria que se colgo.
  it('el carrusel se apaga mientras el fondo y el texto entran', () => {
    expect(en(ESTADOS.EXPLORACION, 5000, 0)).toEqual({
      objetos: 1,
      elegido: 1,
      fondo: 0,
      contenido: 0,
      vuelo: 0,
    });

    const medio = en(ESTADOS.EXPLORACION, 5500, 500);
    expect(medio.objetos).toBeCloseTo(0.5);
    expect(medio.elegido).toBe(1);

    const despues = en(ESTADOS.EXPLORACION, 6000, 1000);
    expect(despues.objetos).toBe(0);
    expect(despues.fondo).toBeCloseTo(0.5);
    expect(despues.contenido).toBeCloseTo(0.5);
    expect(despues.vuelo).toBe(1);
  });

  // El carrusel se vacia con el mismo plazo que dura el vuelo: el anillo termina
  // de apagarse justo cuando el objeto elegido aterriza en su lugar del fondo.
  it('el carrusel termina de apagarse cuando el objeto aterriza', () => {
    for (const t of [0, 250, 500, 750, 1000]) {
      const capa = en(ESTADOS.EXPLORACION, 5000 + t, t);
      expect(capa.objetos).toBeCloseTo(1 - capa.vuelo);
    }
  });

  // EL ELEGIDO NO SE VA CON EL CARRUSEL. Vuela a su lugar justo mientras el
  // carrusel se apaga: con el alfa del carrusel se desvaneceria en pleno vuelo,
  // que es exactamente el cuadro en el que la persona lo esta siguiendo.
  it('el objeto elegido se queda entero mientras el carrusel se va', () => {
    for (const t of [0, 250, 500, 750, 1000, 5000]) {
      expect(en(ESTADOS.EXPLORACION, 5000 + t, t).elegido).toBe(1);
    }
  });

  // La info se queda puesta hasta que la persona se va: con el brazo en alto no
  // se lee, y bajarlo no puede costar la ingenieria que se acaba de mostrar.
  it('la ingenieria se queda puesta el resto de la sesion', () => {
    expect(en(ESTADOS.EXPLORACION, 90000, 88000)).toEqual({
      objetos: 0,
      elegido: 1,
      fondo: 1,
      contenido: 1,
      vuelo: 1,
    });
  });

  // La aparicion tiene su propio reloj, el de la mirada, y no el del estado: la
  // ingenieria entra desde cero se haya elegido al segundo o al minuto.
  it('la aparicion arranca de cero se elija cuando se elija', () => {
    const recienElegida = en(ESTADOS.EXPLORACION, 90000, 0);
    expect(recienElegida.fondo).toBe(0);
    expect(recienElegida.objetos).toBe(1);
    expect(recienElegida.vuelo).toBe(0);
  });

  // El vuelo tiene su propio plazo, mas corto que la aparicion del fondo: el
  // objeto llega a su lugar mientras el fondo todavia esta entrando.
  it('el objeto vuela a su lugar en tiempos.vuelo', () => {
    expect(en(ESTADOS.EXPLORACION, 5000, 0).vuelo).toBe(0);
    expect(en(ESTADOS.EXPLORACION, 5500, 500).vuelo).toBeCloseTo(0.5);
    expect(en(ESTADOS.EXPLORACION, 6000, 1000).vuelo).toBe(1);
    expect(en(ESTADOS.EXPLORACION, 9000, 4000).vuelo).toBe(1);
  });

  // Sin elegir, el carrusel es lo unico que hay en pantalla y se va con todo lo
  // demas: es el caso de quien se levanta sin entender el gesto.
  it('desvanece todas las capas juntas durante el cierre', () => {
    expect(en(ESTADOS.CIERRE, 0)).toEqual({
      objetos: 1,
      elegido: 1,
      fondo: 1,
      contenido: 1,
      vuelo: 1,
    });
    expect(en(ESTADOS.CIERRE, 2000).objetos).toBe(0.5);
    expect(en(ESTADOS.CIERRE, 4000).objetos).toBe(0);
  });

  // Ya elegida, el carrusel hace rato que no esta: encenderlo para apagarlo
  // otra vez seria un parpadeo en el ultimo segundo de la sesion.
  it('el carrusel no reaparece en el cierre si ya se habia elegido', () => {
    for (const t of [0, 1000, 2000, 4000]) {
      expect(en(ESTADOS.CIERRE, t, 9000).objetos).toBe(0);
    }
    expect(en(ESTADOS.CIERRE, 2000, 9000).elegido).toBe(0.5);
    expect(en(ESTADOS.CIERRE, 2000, 9000).fondo).toBe(0.5);
  });

  it('ninguna capa se sale del rango, ni con tiempos raros', () => {
    for (const estado of Object.values(ESTADOS)) {
      for (const t of [-9000, -1, 0, 1, 999999]) {
        for (const valor of Object.values(en(estado, t))) {
          expect(valor).toBeGreaterThanOrEqual(0);
          expect(valor).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('crearNiebla', () => {
  const azarFijo = () => {
    let n = 0;
    return () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  };

  it('arma la cantidad de jirones pedida y les fija un lado', () => {
    const niebla = crearNiebla({ cantidad: 12, azar: azarFijo() });
    expect(niebla.jirones()).toHaveLength(12);
    expect(niebla.jirones().every((jiron) => [-1, 1].includes(jiron.lado))).toBe(true);
  });

  it('los jirones se mueven con el tiempo', () => {
    const niebla = crearNiebla({ cantidad: 5, azar: azarFijo() });
    const antes = niebla.jirones().map((j) => j.x);
    niebla.actualizar(1);
    expect(niebla.jirones().map((j) => j.x)).not.toEqual(antes);
  });

  it('la agitacion multiplica el movimiento de los jirones', () => {
    const calma = crearNiebla({ cantidad: 8, azar: azarFijo() });
    const agitada = crearNiebla({ cantidad: 8, azar: azarFijo() });
    const origen = calma.jirones().map((j) => j.x);

    calma.actualizar(0.1);
    agitada.actualizar(0.1, 4);

    const recorrido = (niebla) =>
      niebla.jirones().reduce((suma, j, i) => suma + Math.abs(j.x - origen[i]), 0);
    expect(recorrido(agitada)).toBeCloseTo(recorrido(calma) * 4);
  });

  it('cada jiron permanece en la mitad que determina su salida', () => {
    const niebla = crearNiebla({ cantidad: 20, azar: azarFijo() });
    for (let i = 0; i < 5000; i++) niebla.actualizar(1 / 60);

    for (const jiron of niebla.jirones()) {
      if (jiron.lado < 0) {
        expect(jiron.x).toBeGreaterThanOrEqual(-0.3);
        expect(jiron.x).toBeLessThanOrEqual(0.5);
      } else {
        expect(jiron.x).toBeGreaterThanOrEqual(0.5);
        expect(jiron.x).toBeLessThanOrEqual(1.3);
      }
    }
  });
});

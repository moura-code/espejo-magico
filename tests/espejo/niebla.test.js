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
      ESTADOS.SORTEO,
      ESTADOS.REVELACION,
      ESTADOS.ESCENA,
    ]) {
      expect(objetivoDeNiebla(estado)).toEqual({ apertura: 1 });
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
  const tiempos = { enganche: 2000, sorteo: 3000, revelacion: 2000, cierre: 4000 };
  const en = (estado, transcurrido) =>
    calcularTransicionEscena({ estado, transcurrido, tiempos });

  it('hace aparecer el contenido durante la revelacion', () => {
    expect(en(ESTADOS.REVELACION, 0).contenido).toBe(0);
    expect(en(ESTADOS.REVELACION, 1000).contenido).toBeCloseTo(0.5);
    expect(en(ESTADOS.REVELACION, 2000).contenido).toBe(1);
  });

  it('desvanece efecto y contenido juntos durante el cierre', () => {
    expect(en(ESTADOS.CIERRE, 0)).toEqual({ efecto: 1, contenido: 1 });
    expect(en(ESTADOS.CIERRE, 2000)).toEqual({ efecto: 0.5, contenido: 0.5 });
    expect(en(ESTADOS.CIERRE, 4000)).toEqual({ efecto: 0, contenido: 0 });
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

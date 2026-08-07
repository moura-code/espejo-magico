import { describe, it, expect } from 'vitest';
import { objetivoDeNiebla, acercarNiebla, crearNiebla } from '../../espejo/niebla.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

// El espejo descansa cubierto de nubes y se despeja con la persona: la niebla
// es el estado de reposo, no un efecto que aparece a mitad de la sesion
// (feedback de la primera prueba). objetivoDeNiebla dice a donde quiere ir cada
// estado; acercarNiebla se encarga de que se llegue sin saltos.
describe('objetivoDeNiebla', () => {
  it('el espejo descansa tapado: atraccion, enganche y sorteo van cubiertos', () => {
    for (const estado of [ESTADOS.ATRACCION, ESTADOS.ENGANCHE, ESTADOS.SORTEO]) {
      expect(objetivoDeNiebla(estado)).toEqual({ cobertura: 1, revelado: 0 });
    }
  });

  it('en la revelacion la niebla sigue puesta y el agujero se abre', () => {
    expect(objetivoDeNiebla(ESTADOS.REVELACION)).toEqual({ cobertura: 1, revelado: 1 });
  });

  it('en escena la niebla se despeja del todo', () => {
    expect(objetivoDeNiebla(ESTADOS.ESCENA)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('en el cierre las nubes vuelven a cerrarse sobre el espejo', () => {
    expect(objetivoDeNiebla(ESTADOS.CIERRE)).toEqual({ cobertura: 1, revelado: 0 });
  });
});

describe('acercarNiebla', () => {
  const VELOCIDADES = { cobertura: 0.8, revelado: 0.5 };

  it('avanza hacia el objetivo a la velocidad pedida', () => {
    const paso = acercarNiebla(
      { cobertura: 0, revelado: 0 },
      { cobertura: 1, revelado: 1 },
      0.5,
      VELOCIDADES,
    );
    expect(paso.cobertura).toBeCloseTo(0.4);
    expect(paso.revelado).toBeCloseTo(0.25);
  });

  it('no se pasa del objetivo', () => {
    const paso = acercarNiebla(
      { cobertura: 0.95, revelado: 1 },
      { cobertura: 1, revelado: 1 },
      1,
      VELOCIDADES,
    );
    expect(paso).toEqual({ cobertura: 1, revelado: 1 });
  });

  it('tambien sabe bajar', () => {
    const paso = acercarNiebla(
      { cobertura: 1, revelado: 1 },
      { cobertura: 0, revelado: 0 },
      0.5,
      VELOCIDADES,
    );
    expect(paso.cobertura).toBeCloseTo(0.6);
    expect(paso.revelado).toBeCloseTo(0.75);
  });

  // La razon de ser de esta funcion: si la persona se levanta en plena
  // revelacion, la maquina salta a cierre de un cuadro al otro, pero la niebla
  // tiene prohibido saltar con ella.
  it('un cambio abrupto de estado no pega saltos: el paso por cuadro esta acotado', () => {
    const dt = 1 / 60;
    let actual = { cobertura: 1, revelado: 1 };

    for (let i = 0; i < 200; i++) {
      const siguiente = acercarNiebla(actual, objetivoDeNiebla(ESTADOS.CIERRE), dt, VELOCIDADES);
      expect(Math.abs(siguiente.cobertura - actual.cobertura)).toBeLessThanOrEqual(
        VELOCIDADES.cobertura * dt + 1e-9,
      );
      expect(Math.abs(siguiente.revelado - actual.revelado)).toBeLessThanOrEqual(
        VELOCIDADES.revelado * dt + 1e-9,
      );
      actual = siguiente;
    }

    expect(actual).toEqual({ cobertura: 1, revelado: 0 });
  });

  it('quedarse en el objetivo no lo mueve', () => {
    const quieta = { cobertura: 1, revelado: 0 };
    expect(acercarNiebla(quieta, { cobertura: 1, revelado: 0 }, 1, VELOCIDADES)).toEqual(quieta);
  });
});

describe('crearNiebla', () => {
  const azarFijo = () => {
    let n = 0;
    return () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  };

  it('arma la cantidad de jirones pedida', () => {
    const niebla = crearNiebla({ cantidad: 12, azar: azarFijo() });
    expect(niebla.jirones()).toHaveLength(12);
  });

  it('los jirones se mueven con el tiempo', () => {
    const niebla = crearNiebla({ cantidad: 5, azar: azarFijo() });
    const antes = niebla.jirones().map((j) => j.x);
    niebla.actualizar(1);
    expect(niebla.jirones().map((j) => j.x)).not.toEqual(antes);
  });

  // El redoble del sorteo: la niebla ya esta puesta desde el reposo, asi que lo
  // que anuncia que algo pasa es que los jirones se agitan.
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

  it('los jirones nunca se van tan lejos que dejen un hueco', () => {
    const niebla = crearNiebla({ cantidad: 20, azar: azarFijo() });
    for (let i = 0; i < 5000; i++) niebla.actualizar(1 / 60);

    for (const jiron of niebla.jirones()) {
      expect(jiron.x).toBeGreaterThanOrEqual(-0.35);
      expect(jiron.x).toBeLessThanOrEqual(1.35);
    }
  });
});

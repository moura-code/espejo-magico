import { describe, expect, it } from 'vitest';
import { crearControlDemo } from '../../espejo/demo.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const IDS = ['civil', 'quimica', 'computacion'];

function crearMaquinaFalsa(manual = true) {
  let enManual = manual;
  let reinicios = 0;

  return {
    esManual: () => enManual,
    establecerManual(valor) {
      enManual = valor;
      return enManual;
    },
    reiniciar() {
      reinicios += 1;
      return {
        eventos: [{ tipo: 'entra', estado: ESTADOS.ATRACCION }],
      };
    },
    reinicios: () => reinicios,
  };
}

function crearControl() {
  return crearControlDemo({
    ids: IDS,
    pausaSinPersonaMs: 6000,
  });
}

describe('crearControlDemo', () => {
  it('fuerza avance automatico y restaura el ajuste anterior al salir', () => {
    const control = crearControl();
    const maquina = crearMaquinaFalsa(true);

    control.activar({ maquina, ahora: 100 });
    expect(maquina.esManual()).toBe(false);
    expect(maquina.reinicios()).toBe(1);

    control.desactivar({ maquina, ahora: 200 });
    expect(maquina.esManual()).toBe(true);
    expect(maquina.reinicios()).toBe(2);
  });

  it('simula una pantalla vacia antes de iniciar cada experiencia', () => {
    const control = crearControl();
    const maquina = crearMaquinaFalsa();
    control.activar({ maquina, ahora: 1000 });

    expect(control.personaVisible(6999)).toBe(false);
    expect(control.personaVisible(7000)).toBe(true);

    control.registrar([{ tipo: 'entra', estado: ESTADOS.ATRACCION }], 9000);
    expect(control.personaVisible(14999)).toBe(false);
    expect(control.personaVisible(15000)).toBe(true);
  });

  it('registra todas las carreras sin contar repeticiones', () => {
    const control = crearControl();
    control.activar({ maquina: crearMaquinaFalsa(), ahora: 0 });
    control.registrar(
      [
        { tipo: 'carrera', id: 'civil' },
        { tipo: 'carrera', id: 'civil' },
        { tipo: 'carrera', id: 'quimica' },
        { tipo: 'carrera', id: 'computacion' },
      ],
      100,
    );

    expect(control.resumen()).toEqual({
      activo: true,
      carrerasVistas: 3,
      totalCarreras: 3,
      completo: true,
    });
  });
});

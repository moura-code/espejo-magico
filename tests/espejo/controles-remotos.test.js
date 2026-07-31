import { describe, expect, it, vi } from 'vitest';
import { ACCIONES, TIPOS } from '../../comun/protocolo.js';
import {
  botonesParaEstado,
  controlesParaEstado,
  ejecutarAccionRemota,
} from '../../espejo/controles-remotos.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

describe('controles remotos', () => {
  it('solo muestra acciones utiles para el estado actual', () => {
    expect(botonesParaEstado(ESTADOS.ATRACCION).map((boton) => boton.id)).toEqual([
      ACCIONES.EMPEZAR,
    ]);
    expect(botonesParaEstado(ESTADOS.ENGANCHE).map((boton) => boton.id)).toEqual([
      ACCIONES.REINICIAR,
    ]);
    expect(botonesParaEstado(ESTADOS.ESCENA).map((boton) => boton.id)).toEqual([
      ACCIONES.OTRA_CARRERA,
      ACCIONES.TERMINAR,
    ]);
    expect(botonesParaEstado(ESTADOS.REFLEXION)).toEqual([]);
    expect(botonesParaEstado(ESTADOS.CIERRE)[0].etiqueta).toBe('VOLVER AL INICIO');
  });

  it('reemplaza el aviso de teclado por avanzar en la tablet durante el modo manual', () => {
    expect(
      botonesParaEstado(ESTADOS.SORTEO, { manual: true }).map((boton) => boton.id),
    ).toEqual([ACCIONES.REINICIAR]);
    expect(
      botonesParaEstado(ESTADOS.REFLEXION, {
        manual: true,
      }).map((boton) => boton.id),
    ).toEqual([ACCIONES.AVANZAR]);
    expect(
      botonesParaEstado(ESTADOS.SORTEO, { manual: false }).map((boton) => boton.id),
    ).not.toContain(ACCIONES.AVANZAR);
  });

  it('publica un mensaje de controles valido', () => {
    expect(controlesParaEstado(ESTADOS.ESCENA)).toMatchObject({
      tipo: TIPOS.CONTROLES,
      estado: ESTADOS.ESCENA,
      botones: [
        { id: ACCIONES.OTRA_CARRERA },
        { id: ACCIONES.TERMINAR },
      ],
    });
  });

  it('ejecuta terminar y reiniciar solamente cuando estan visibles', () => {
    const maquina = {
      avanzar: vi.fn(() => ({ eventos: ['avanza'] })),
      reiniciar: vi.fn(() => ({ eventos: ['reinicia'] })),
      esManual: vi.fn(() => false),
    };

    expect(
      ejecutarAccionRemota({
        id: ACCIONES.TERMINAR,
        estado: ESTADOS.ESCENA,
        maquina,
        ahora: 500,
      }),
    ).toEqual({ eventos: ['avanza'] });
    expect(maquina.avanzar).toHaveBeenCalledWith(500);

    expect(
      ejecutarAccionRemota({
        id: ACCIONES.EMPEZAR,
        estado: ESTADOS.ATRACCION,
        maquina,
        ahora: 600,
      }),
    ).toEqual({ eventos: ['avanza'] });
    expect(maquina.avanzar).toHaveBeenCalledWith(600);

    expect(
      ejecutarAccionRemota({
        id: ACCIONES.REINICIAR,
        estado: ESTADOS.SORTEO,
        maquina,
        ahora: 700,
      }),
    ).toEqual({ eventos: ['reinicia'] });
    expect(maquina.reiniciar).toHaveBeenCalledWith(700);

    expect(
      ejecutarAccionRemota({
        id: 'si-sorprendio',
        estado: ESTADOS.REFLEXION,
        maquina,
        ahora: 800,
      }),
    ).toBeNull();

    expect(
      ejecutarAccionRemota({
        id: ACCIONES.OTRA_CARRERA,
        estado: ESTADOS.ATRACCION,
        maquina,
        ahora: 900,
      }),
    ).toBeNull();
  });

  it('permite avanzar desde la tablet solamente en estados manuales que esperan', () => {
    const maquina = {
      avanzar: vi.fn(() => ({ eventos: ['avanza'] })),
      reiniciar: vi.fn(),
      esManual: vi.fn(() => true),
    };

    expect(
      ejecutarAccionRemota({
        id: ACCIONES.AVANZAR,
        estado: ESTADOS.REFLEXION,
        maquina,
        ahora: 1200,
      }),
    ).toEqual({ eventos: ['avanza'] });
    expect(maquina.avanzar).toHaveBeenCalledWith(1200);

    maquina.esManual.mockReturnValue(false);
    expect(
      ejecutarAccionRemota({
        id: ACCIONES.AVANZAR,
        estado: ESTADOS.REFLEXION,
        maquina,
        ahora: 1300,
      }),
    ).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  ACCIONES,
  TIPOS,
  mensajeAccion,
  mensajeCarrera,
  mensajeControles,
  mensajeReposo,
  esValido,
  interpretar,
} from '../../comun/protocolo.js';

describe('protocolo', () => {
  it('arma el mensaje de carrera', () => {
    expect(mensajeCarrera('civil', 12)).toEqual({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 12 });
  });

  it('arma el mensaje de reposo', () => {
    expect(mensajeReposo()).toEqual({ tipo: TIPOS.REPOSO });
  });

  it('acepta los mensajes de la experiencia', () => {
    expect(esValido(mensajeCarrera('civil', 1))).toBe(true);
    expect(esValido(mensajeReposo())).toBe(true);
  });

  it('arma y acepta controles dinamicos y acciones tactiles', () => {
    const controles = mensajeControles('ESCENA', [
      { id: ACCIONES.OTRA_CARRERA, etiqueta: 'OTRA CARRERA', color: '#62D8FF' },
      { id: ACCIONES.TERMINAR, etiqueta: 'TERMINAR', color: '#FFD23F' },
    ]);

    expect(esValido(controles)).toBe(true);
    expect(mensajeAccion(ACCIONES.TERMINAR)).toEqual({
      tipo: TIPOS.ACCION,
      id: ACCIONES.TERMINAR,
    });
    expect(esValido(mensajeAccion(ACCIONES.TERMINAR))).toBe(true);
    expect(esValido(mensajeAccion(ACCIONES.EMPEZAR))).toBe(true);
  });

  it('rechaza cualquier otra cosa', () => {
    expect(esValido(null)).toBe(false);
    expect(esValido('civil')).toBe(false);
    expect(esValido({ tipo: 'otra' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: '', sesion: 1 })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 0 })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 1.5 })).toBe(false);
    expect(esValido({ tipo: TIPOS.ACCION, id: 'inventada' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CONTROLES, estado: 'ESCENA', botones: [{}] })).toBe(false);
  });

  it('interpreta texto JSON y descarta lo que no sirve', () => {
    expect(interpretar('{"tipo":"reposo"}')).toEqual({ tipo: TIPOS.REPOSO });
    expect(interpretar('no es json')).toBeNull();
    expect(interpretar('{"tipo":"otra"}')).toBeNull();
    expect(interpretar('')).toBeNull();
    expect(interpretar('null')).toBeNull();
  });

  it('lo que se serializa vuelve igual', () => {
    const original = mensajeCarrera('fisico-matematico', 42);
    expect(interpretar(JSON.stringify(original))).toEqual(original);
  });
});

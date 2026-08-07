import { describe, it, expect } from 'vitest';
import {
  TIPOS,
  mensajeCarrera,
  mensajeHolaEspejo,
  mensajeHolaTablet,
  mensajeReposo,
  esValido,
  interpretar,
} from '../../comun/protocolo.js';

describe('protocolo', () => {
  it('identifica espejo y tablets', () => {
    expect(mensajeHolaEspejo('arranque-a')).toEqual({
      tipo: TIPOS.HOLA,
      rol: 'espejo',
      instancia: 'arranque-a',
    });
    expect(mensajeHolaTablet(2)).toEqual({ tipo: TIPOS.HOLA, rol: 'tablet', slot: 2 });
  });
  it('arma el mensaje de carrera', () => {
    expect(mensajeCarrera('civil', 12)).toEqual({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 12 });
  });

  it('arma el mensaje de reposo', () => {
    expect(mensajeReposo()).toEqual({ tipo: TIPOS.REPOSO });
  });

  it('incluye la instancia del arranque cuando se proporciona', () => {
    expect(mensajeCarrera('civil', 1, 'espejo-a')).toEqual({
      tipo: TIPOS.CARRERA,
      id: 'civil',
      sesion: 1,
      instancia: 'espejo-a',
    });
    expect(mensajeReposo('espejo-a')).toEqual({ tipo: TIPOS.REPOSO, instancia: 'espejo-a' });
  });

  it('acepta los dos mensajes del sistema', () => {
    expect(esValido(mensajeCarrera('civil', 1))).toBe(true);
    expect(esValido(mensajeReposo())).toBe(true);
    expect(esValido(mensajeHolaEspejo('arranque-a'))).toBe(true);
    expect(esValido(mensajeHolaTablet(0))).toBe(true);
  });

  it('rechaza cualquier otra cosa', () => {
    expect(esValido(null)).toBe(false);
    expect(esValido('civil')).toBe(false);
    expect(esValido({ tipo: 'otra' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: '', sesion: 1 })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 0 })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 1.5 })).toBe(false);
    expect(esValido({ tipo: TIPOS.REPOSO, instancia: '' })).toBe(false);
    expect(esValido({ tipo: TIPOS.HOLA, rol: 'tablet', slot: -1 })).toBe(false);
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

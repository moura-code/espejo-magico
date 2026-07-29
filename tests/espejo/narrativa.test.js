import { describe, expect, it } from 'vitest';
import {
  TEXTOS_EXPERIENCIA,
  tituloDeRevelacion,
} from '../../espejo/narrativa.js';

describe('narrativa de la experiencia', () => {
  const electrica = {
    nombre: 'Ingeniería Eléctrica',
  };

  it('activa una imagen mental antes del encuentro', () => {
    expect(TEXTOS_EXPERIENCIA.esperaTitulo).toBe('¿Cómo es la cara de la ingeniería?');
    expect(TEXTOS_EXPERIENCIA.encuentroTitulo).toBe(
      'No vamos a adivinar quién sos.',
    );
    expect(TEXTOS_EXPERIENCIA.encuentroBajada).toBe(
      'Vamos a mostrarte una posibilidad.',
    );
    expect(TEXTOS_EXPERIENCIA.sorteo).toBe('Entre muchos futuros posibles…');
  });

  it('no presenta la carrera sorteada como una identidad', () => {
    expect(tituloDeRevelacion(electrica)).toBe(
      'Hoy podés verte en Ingeniería Eléctrica.',
    );
  });

  it('explica el azar y cierra como una posibilidad', () => {
    expect(TEXTOS_EXPERIENCIA.azarTitulo).toBe('Esta carrera fue sorteada.');
    expect(TEXTOS_EXPERIENCIA.azarDetalle).toBe(
      'Ninguna característica visible determinó el resultado.',
    );
    expect(TEXTOS_EXPERIENCIA.cierrePrediccionTitulo).toBe(
      'No era una predicción.',
    );
    expect(TEXTOS_EXPERIENCIA.cierrePrediccionBajada).toBe('Era una posibilidad.');
    expect(TEXTOS_EXPERIENCIA.cierreTitulo).toBe(
      'La ingeniería tiene muchas caras.',
    );
    expect(TEXTOS_EXPERIENCIA.cierreBajada).toBe('Una puede ser la tuya.');
  });
});

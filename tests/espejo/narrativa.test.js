import { describe, expect, it } from 'vitest';
import {
  preguntaDeReflexion,
  TEXTOS_EXPERIENCIA,
  tituloDeRevelacion,
} from '../../espejo/narrativa.js';

describe('narrativa de la experiencia', () => {
  const electrica = {
    nombre: 'Ingeniería Eléctrica',
    preguntaReflexiva: '¿Te sorprendió verte en Ingeniería Eléctrica?',
  };

  it('presenta la espera como una posibilidad', () => {
    expect(TEXTOS_EXPERIENCIA.esperaTitulo).toBe('¿Podés verte haciendo ingeniería?');
    expect(TEXTOS_EXPERIENCIA.esperaBajada).toBe(
      'Acercate y descubrí una posibilidad.',
    );
    expect(TEXTOS_EXPERIENCIA.sorteo).toBe(
      'El espejo está buscando una posibilidad…',
    );
  });

  it('no presenta la carrera sorteada como una identidad', () => {
    expect(tituloDeRevelacion(electrica)).toBe(
      'Hoy te ves en Ingeniería Eléctrica',
    );
    expect(preguntaDeReflexion(electrica)).toBe(
      '¿Te sorprendió verte en Ingeniería Eléctrica?',
    );
  });

  it('explica el azar y cierra sobre los estereotipos', () => {
    expect(TEXTOS_EXPERIENCIA.azarTitulo).toBe('Esta carrera fue sorteada.');
    expect(TEXTOS_EXPERIENCIA.azarDetalle).toBe(
      'No usamos tu apariencia para elegirla ni evaluar tus capacidades.',
    );
    expect(TEXTOS_EXPERIENCIA.cierreTitulo).toBe(
      'La ingeniería no tiene un rostro único.',
    );
    expect(TEXTOS_EXPERIENCIA.cierreBajada).toBe('Los estereotipos sí.');
  });
});

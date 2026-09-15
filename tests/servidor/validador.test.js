import { describe, it, expect } from 'vitest';
import { validarEstructura } from '../../servidor/validador.js';

describe('validarEstructura', () => {
  const carreraValida = () => ({
    id: 'computacion',
    rutaRelativa: 'carreras/computacion',
    carreraJson: {
      nombre: 'Ingeniería en Computación',
      color: '#00E5A0',
      maite: 'sistemas',
      fondo: 'principal',
    },
    objetos: [
      {
        id: 'laptop',
        rutaImagen: 'carreras/computacion/objetos/laptop/imagen.png',
        metadata: { nombre: 'Laptop', descripcion: 'Una laptop para programar.', figura: 'laptop' },
      },
      {
        id: 'mouse',
        rutaImagen: 'carreras/computacion/objetos/mouse/imagen.png',
        metadata: { nombre: 'Mouse', descripcion: 'Un mouse óptico.', figura: 'chip' },
      },
    ],
    fondos: [
      {
        id: 'principal',
        rutaImagen: 'carreras/computacion/fondos/principal/imagen.jpg',
        rutaVideo: null,
        metadata: {
          lugar: { x: 0.834, y: 0.22, escala: 0.24 },
          escondites: [{ x: 0.166, y: 0.22, escala: 0.24 }],
        },
      },
    ],
  });

  it('acepta una estructura válida', () => {
    expect(validarEstructura([carreraValida()], { figurasValidas: ['laptop', 'chip'] })).toEqual([]);
  });

  it('detecta falta de carrera.json o error de sintaxis', () => {
    const c1 = carreraValida();
    c1.carreraJson = null;
    expect(validarEstructura([c1])).toContain('carreras/computacion: falta carrera.json');

    const c2 = carreraValida();
    c2.errorCarreraJson = 'Unexpected token';
    expect(validarEstructura([c2])).toContain(
      'carreras/computacion/carrera.json: JSON inválido (Unexpected token)',
    );
  });

  it('detecta campos inválidos en carrera.json', () => {
    const c = carreraValida();
    c.carreraJson.nombre = '';
    c.carreraJson.color = 'invalido';
    c.carreraJson.fondo = 'inexistente';
    const errores = validarEstructura([c]);
    expect(errores.some((e) => e.includes('falta "nombre"'))).toBe(true);
    expect(errores.some((e) => e.includes('"color" tiene que ser #rrggbb'))).toBe(true);
    expect(errores.some((e) => e.includes('el fondo activo "inexistente" no existe'))).toBe(true);
  });

  it('detecta IDs de maite repetidos o inválidos', () => {
    const c1 = carreraValida();
    const c2 = carreraValida();
    c2.id = 'civil';
    c2.rutaRelativa = 'carreras/civil';

    const errores1 = validarEstructura([c1, c2]);
    expect(errores1.some((e) => e.includes('"maite" repetido ("sistemas")'))).toBe(true);

    const c3 = carreraValida();
    c3.carreraJson.maite = 123;
    const errores2 = validarEstructura([c3]);
    expect(errores2.some((e) => e.includes('"maite" tiene que ser un texto o null'))).toBe(true);
  });

  it('detecta objetos sin imagen, sin metadata o con metadata rota', () => {
    const c = carreraValida();
    c.objetos[0].rutaImagen = null;
    c.objetos[1].metadata = null;
    const errores = validarEstructura([c]);
    expect(errores).toContain('carreras/computacion/objetos/laptop: falta imagen.png');
    expect(errores).toContain('carreras/computacion/objetos/mouse: falta metadata.json');

    const c2 = carreraValida();
    c2.objetos[0].errorMetadata = 'SyntaxError';
    expect(validarEstructura([c2])).toContain(
      'carreras/computacion/objetos/laptop/metadata.json: JSON inválido (SyntaxError)',
    );
  });

  it('detecta nombres y descripciones faltantes o descripciones demasiado largas', () => {
    const c = carreraValida();
    c.objetos[0].metadata.nombre = '';
    c.objetos[0].metadata.descripcion = 'A'.repeat(131);
    const errores = validarEstructura([c]);
    expect(errores.some((e) => e.includes('falta "nombre"'))).toBe(true);
    expect(errores.some((e) => e.includes('131 caracteres (máximo 130)'))).toBe(true);
  });

  it('detecta figura inexistente cuando se pasan figurasValidas', () => {
    const c = carreraValida();
    c.objetos[0].metadata.figura = 'desconocida';
    const errores = validarEstructura([c], { figurasValidas: ['laptop', 'chip'] });
    expect(errores.some((e) => e.includes('figura "desconocida", que no existe'))).toBe(true);
  });

  it('detecta fondos sin imagen, sin metadata o con metadata inválida', () => {
    const c = carreraValida();
    c.fondos[0].rutaImagen = null;
    c.fondos[0].metadata.lugar.x = 1.5;
    c.fondos[0].metadata.lugar.escala = -1;
    const errores = validarEstructura([c]);
    expect(errores.some((e) => e.includes('falta imagen estática'))).toBe(true);
    expect(errores.some((e) => e.includes('"lugar.x" tiene que estar entre 0 y 1'))).toBe(true);
    expect(errores.some((e) => e.includes('"lugar.escala" tiene que ser un número mayor que cero'))).toBe(true);
  });

  it('detecta fondos con cantidad insuficiente de escondites (menos de N - 1)', () => {
    const c = carreraValida();
    // 2 objetos necesitan al menos 2 - 1 = 1 escondite.
    c.fondos[0].metadata.escondites = [];
    const errores = validarEstructura([c]);
    expect(
      errores.some((e) =>
        e.includes('insuficientes escondites: declara 0 pero la carrera tiene 2 objetos (se necesitan al menos 1)'),
      ),
    ).toBe(true);
  });

  it('acumula múltiples errores sin cortar en el primero', () => {
    const c = carreraValida();
    c.carreraJson.nombre = '';
    c.objetos[0].rutaImagen = null;
    c.fondos[0].rutaImagen = null;
    const errores = validarEstructura([c]);
    expect(errores.length).toBeGreaterThanOrEqual(3);
  });
});

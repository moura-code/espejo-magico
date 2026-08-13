import { describe, it, expect } from 'vitest';
import { validarContenido, cargarContenido } from '../../espejo/contenido.js';

const carreraValida = () => ({
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  frase: 'Construís lo que queda de pie',
  objetos: [{ img: 'assets/civil/grua.png', escala: 0.2, peso: 1 }],
  referentes: [{ video: 'videos/civil/ana.mp4', nombre: 'Ana Pérez', detalle: 'Egresada' }],
});

const sinErrores = (datos) => expect(validarContenido(datos)).toEqual([]);
const conError = (datos, fragmento) =>
  expect(validarContenido(datos).join(' | ')).toContain(fragmento);

describe('validarContenido', () => {
  it('acepta una carrera bien formada', () => {
    sinErrores({ carreras: [carreraValida()] });
  });

  it('rechaza un archivo sin carreras', () => {
    conError({}, 'arreglo "carreras"');
    conError({ carreras: [] }, 'arreglo "carreras"');
    conError(null, 'arreglo "carreras"');
  });

  it('exige id, nombre y color', () => {
    conError({ carreras: [{ ...carreraValida(), id: undefined }] }, 'falta "id"');
    conError({ carreras: [{ ...carreraValida(), nombre: undefined }] }, 'falta "nombre"');
    conError({ carreras: [{ ...carreraValida(), color: 'naranja' }] }, '#rrggbb');
  });

  it('rechaza ids repetidos', () => {
    conError({ carreras: [carreraValida(), carreraValida()] }, 'repetido');
  });

  it('exige al menos un objeto con escala positiva', () => {
    conError({ carreras: [{ ...carreraValida(), objetos: [] }] }, '"objetos" vacio');
    conError(
      { carreras: [{ ...carreraValida(), objetos: [{ img: 'a.png', escala: 0 }] }] },
      'mayor que cero',
    );
  });

  it('exige al menos una referente con video y nombre', () => {
    conError({ carreras: [{ ...carreraValida(), referentes: [] }] }, '"referentes" vacio');
    conError({ carreras: [{ ...carreraValida(), referentes: [{ nombre: 'Ana' }] }] }, 'sin "video"');
    conError(
      { carreras: [{ ...carreraValida(), referentes: [{ video: 'a.mp4' }] }] },
      'sin "nombre"',
    );
  });

  it('nombra la carrera en el mensaje para que se sepa cual arreglar', () => {
    conError({ carreras: [{ ...carreraValida(), nombre: undefined }] }, '(civil)');
  });

  it('junta todos los problemas en vez de cortar en el primero', () => {
    const roto = { carreras: [{ ...carreraValida(), nombre: undefined, color: 'azul', objetos: [] }] };
    expect(validarContenido(roto).length).toBeGreaterThanOrEqual(3);
  });
});

describe('cargarContenido', () => {
  const traerCon = (datos, ok = true) => async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => datos,
  });

  it('devuelve las carreras y un buscador por id', async () => {
    const contenido = await cargarContenido({ traer: traerCon({ carreras: [carreraValida()] }) });
    expect(contenido.ids).toEqual(['civil']);
    expect(contenido.obtener('civil').nombre).toBe('Ingeniería Civil');
    expect(contenido.obtener('nada')).toBeNull();
  });

  it('junta todas las rutas de imagen para precargarlas', async () => {
    const contenido = await cargarContenido({ traer: traerCon({ carreras: [carreraValida()] }) });
    expect(contenido.todasLasImagenes()).toEqual(['assets/civil/grua.png']);
  });

  it('falla con un mensaje que enumera todos los problemas', async () => {
    const roto = { carreras: [{ ...carreraValida(), nombre: undefined, color: 'azul' }] };
    await expect(cargarContenido({ traer: traerCon(roto) })).rejects.toThrow(/falta "nombre"/);
    await expect(cargarContenido({ traer: traerCon(roto) })).rejects.toThrow(/#rrggbb/);
  });

  it('falla si el archivo no esta', async () => {
    await expect(cargarContenido({ traer: traerCon(null, false) })).rejects.toThrow(/404/);
  });
});

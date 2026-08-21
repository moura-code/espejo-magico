import { describe, it, expect } from 'vitest';
import {
  validarContenido,
  cargarContenido,
  objetoDeCarrera,
} from '../../espejo/contenido.js';

const carreraValida = () => ({
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  maite: 'civil',
  fondo: 'assets/fondos/civil.png',
  persona: { nombre: 'Ana Pérez', texto: 'Diseña puentes que aguantan cien años.' },
  objetos: [{ img: 'assets/civil/grua.png', escala: 0.2 }],
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
    conError({ carreras: [carreraValida(), carreraValida()] }, '"id" repetido');
  });

  it('exige al menos un objeto con escala positiva', () => {
    conError({ carreras: [{ ...carreraValida(), objetos: [] }] }, '"objetos" vacio');
    conError(
      { carreras: [{ ...carreraValida(), objetos: [{ img: 'a.png', escala: 0 }] }] },
      'mayor que cero',
    );
  });

  // La persona es lo unico que la pantalla muestra al elegir esa carrera: sin
  // nombre o sin texto, la revelacion queda vacia y nadie se entera hasta que
  // hay alguien sentado delante.
  it('exige la persona con nombre y texto', () => {
    conError({ carreras: [{ ...carreraValida(), persona: undefined }] }, 'falta "persona"');
    conError(
      { carreras: [{ ...carreraValida(), persona: { texto: 'algo' } }] },
      '"persona" sin "nombre"',
    );
    conError(
      { carreras: [{ ...carreraValida(), persona: { nombre: 'Ana' } }] },
      '"persona" sin "texto"',
    );
    conError(
      { carreras: [{ ...carreraValida(), persona: { nombre: '  ', texto: '  ' } }] },
      '"persona" sin "nombre"',
    );
  });

  // maite en null significa "todavia no hay gente filmada para esta
  // ingenieria". Es un estado valido y esperado: siete de las doce estan asi.
  it('acepta una carrera sin par en MAITE', () => {
    sinErrores({ carreras: [{ ...carreraValida(), maite: null }] });
    const sinCampo = carreraValida();
    delete sinCampo.maite;
    sinErrores({ carreras: [sinCampo] });
  });

  it('rechaza un maite que no sea un id', () => {
    conError({ carreras: [{ ...carreraValida(), maite: 7 }] }, '"maite" tiene que ser');
    conError({ carreras: [{ ...carreraValida(), maite: '' }] }, '"maite" tiene que ser');
  });

  // Dos carreras del espejo apuntando al mismo video dejarian a una de las dos
  // sin su gente, y en pantalla se veria bien: nadie lo notaria.
  it('rechaza dos carreras apuntando al mismo id de MAITE', () => {
    conError(
      {
        carreras: [
          carreraValida(),
          { ...carreraValida(), id: 'quimica', maite: 'civil' },
        ],
      },
      '"maite" repetido',
    );
  });

  it('el fondo es opcional pero tiene que ser una ruta', () => {
    const sinFondo = carreraValida();
    delete sinFondo.fondo;
    sinErrores({ carreras: [sinFondo] });
    conError({ carreras: [{ ...carreraValida(), fondo: 42 }] }, '"fondo" tiene que ser');
  });

  it('valida tambien el objeto representante, si esta declarado', () => {
    sinErrores({
      carreras: [{ ...carreraValida(), objeto: { img: 'assets/civil/grua.png', escala: 0.2 } }],
    });
    conError({ carreras: [{ ...carreraValida(), objeto: { escala: 0.2 } }] }, 'objeto sin "img"');
  });

  // Solo se comprueba cuando el llamador pasa el catalogo de figuras. Es lo que
  // hace que un error de tipeo aparezca al arrancar y no como un objeto que no
  // se dibuja nunca.
  it('detecta figuras que no existen, si se le da el catalogo', () => {
    const conFigura = (figura) => ({
      carreras: [{ ...carreraValida(), objetos: [{ img: 'a.png', escala: 0.2, figura }] }],
    });

    expect(
      validarContenido(conFigura('inventada'), { figurasValidas: ['grua'] }).join(' | '),
    ).toContain('que no existe');
    expect(validarContenido(conFigura('grua'), { figurasValidas: ['grua'] })).toEqual([]);
    // Sin catalogo no se opina: es el modo en que corren las otras pruebas.
    expect(validarContenido(conFigura('inventada'))).toEqual([]);
  });

  it('nombra la carrera en el mensaje para que se sepa cual arreglar', () => {
    conError({ carreras: [{ ...carreraValida(), nombre: undefined }] }, '(civil)');
  });

  it('junta todos los problemas en vez de cortar en el primero', () => {
    const roto = {
      carreras: [
        { ...carreraValida(), nombre: undefined, color: 'azul', objetos: [], persona: undefined },
      ],
    };
    expect(validarContenido(roto).length).toBeGreaterThanOrEqual(4);
  });
});

describe('objetoDeCarrera', () => {
  it('usa el representante declarado cuando esta', () => {
    const fijo = { img: 'assets/civil/casco.png', escala: 0.2 };
    const carrera = { ...carreraValida(), objeto: fijo };
    expect(objetoDeCarrera(carrera, () => 0.9)).toBe(fijo);
  });

  // Sin representante fijo, dos visitantes seguidos no ven exactamente la misma
  // pantalla. `azar` se inyecta para que la prueba no dependa de la suerte.
  it('sin representante sortea uno de la lista', () => {
    const carrera = {
      ...carreraValida(),
      objetos: [{ img: 'a.png', escala: 0.2 }, { img: 'b.png', escala: 0.2 }],
    };
    expect(objetoDeCarrera(carrera, () => 0).img).toBe('a.png');
    expect(objetoDeCarrera(carrera, () => 0.99).img).toBe('b.png');
  });

  it('no rompe con una carrera vacia', () => {
    expect(objetoDeCarrera(null)).toBeNull();
    expect(objetoDeCarrera({ objetos: [] })).toBeNull();
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

  // Una carrera sin par en MAITE se elige y las tablets se quedan en humo, que
  // se lee como que el sistema se rompio. Queda escrita y en silencio.
  it('solo son jugables las carreras con par en MAITE', async () => {
    const contenido = await cargarContenido({
      traer: traerCon({
        carreras: [
          carreraValida(),
          { ...carreraValida(), id: 'forestal', maite: null },
          { ...carreraValida(), id: 'naval', maite: 'naval' },
        ],
      }),
    });

    expect(contenido.ids).toEqual(['civil', 'forestal', 'naval']);
    expect(contenido.idsJugables()).toEqual(['civil', 'naval']);
  });

  it('junta objetos, representante y fondo para precargarlos', async () => {
    const contenido = await cargarContenido({
      traer: traerCon({
        carreras: [{ ...carreraValida(), objeto: { img: 'assets/civil/casco.png', escala: 0.2 } }],
      }),
    });
    expect(contenido.todasLasImagenes()).toEqual([
      'assets/civil/grua.png',
      'assets/civil/casco.png',
      'assets/fondos/civil.png',
    ]);
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

import { describe, it, expect, vi } from 'vitest';
import { circuloDeLoOpaco, circuloMinimo, crearBanco } from '../../espejo/imagenes.js';

// Un canal alfa de `ancho` x `alto`, opaco solo donde `opaco(x, y)` lo dice.
const alfaDe = (ancho, alto, opaco, valor = 255) => {
  const alfa = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) if (opaco(x, y)) alfa[y * ancho + x] = valor;
  }
  return { alfa, ancho, alto };
};

describe('circuloMinimo', () => {
  it('sin puntos no hay circulo', () => {
    expect(circuloMinimo([])).toBeNull();
  });

  it('un punto solo es un circulo sin radio', () => {
    expect(circuloMinimo([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4, radio: 0 });
  });

  it('dos puntos son el diametro', () => {
    const circulo = circuloMinimo([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(circulo.x).toBeCloseTo(2);
    expect(circulo.y).toBeCloseTo(0);
    expect(circulo.radio).toBeCloseTo(2);
  });

  // En un triangulo con un angulo obtuso, el circulo que pasa por los tres
  // vertices es enorme: el minimo tiene de diametro el lado mas largo.
  it('en un triangulo obtuso le alcanza con el lado mas largo', () => {
    const circulo = circuloMinimo([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 1 },
    ]);
    expect(circulo.x).toBeCloseTo(5);
    expect(circulo.y).toBeCloseTo(0);
    expect(circulo.radio).toBeCloseTo(5);
  });

  // En uno agudo hacen falta los tres: centro en (2, 5/6), radio 13/6.
  it('en un triangulo agudo pasa por los tres vertices', () => {
    const circulo = circuloMinimo([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 3 },
    ]);
    expect(circulo.x).toBeCloseTo(2);
    expect(circulo.y).toBeCloseTo(5 / 6);
    expect(circulo.radio).toBeCloseTo(13 / 6);
  });

  it('los puntos de adentro no lo cambian', () => {
    const circulo = circuloMinimo([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 0.5, y: 1.5 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(circulo.x).toBeCloseTo(1);
    expect(circulo.y).toBeCloseTo(1);
    expect(circulo.radio).toBeCloseTo(Math.SQRT2);
  });

  // La prueba de fondo: el mas chico de todos los circulos que pasan por dos
  // puntos (de diametro) o por tres, de los que contienen a todos.
  it('da lo mismo que probar todos los pares y los trios', () => {
    let semilla = 7;
    const azar = () => {
      semilla = (semilla * 1664525 + 1013904223) % 4294967296;
      return semilla / 4294967296;
    };
    const porDos = (a, b) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      radio: Math.hypot(a.x - b.x, a.y - b.y) / 2,
    });
    const porTres = (a, b, c) => {
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-9) return null;
      const [a2, b2, c2] = [a, b, c].map((p) => p.x * p.x + p.y * p.y);
      const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
      const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
      return { x, y, radio: Math.hypot(a.x - x, a.y - y) };
    };

    for (let vuelta = 0; vuelta < 20; vuelta++) {
      const puntos = Array.from({ length: 12 }, () => ({ x: azar() * 100, y: azar() * 60 }));
      const contiene = (c) =>
        puntos.every((p) => Math.hypot(p.x - c.x, p.y - c.y) <= c.radio + 1e-6);
      let mejor = Infinity;
      for (let i = 0; i < puntos.length; i++) {
        for (let j = i + 1; j < puntos.length; j++) {
          const c = porDos(puntos[i], puntos[j]);
          if (contiene(c)) mejor = Math.min(mejor, c.radio);
          for (let k = j + 1; k < puntos.length; k++) {
            const t = porTres(puntos[i], puntos[j], puntos[k]);
            if (t && contiene(t)) mejor = Math.min(mejor, t.radio);
          }
        }
      }

      const circulo = circuloMinimo(puntos);
      expect(contiene(circulo)).toBe(true);
      expect(circulo.radio).toBeCloseTo(mejor, 6);
    }
  });
});

// Lo que ocupa un objeto adentro de su PNG, normalizado al lado mas largo de
// la imagen y con el centro medido desde el centro de la imagen: es lo que hace
// falta para meterlo entero en el circulo del carrusel.
describe('circuloDeLoOpaco', () => {
  it('una imagen opaca entera: el circulo que pasa por sus cuatro esquinas', () => {
    const circulo = circuloDeLoOpaco(alfaDe(4, 2, () => true));
    expect(circulo.x).toBeCloseTo(0);
    expect(circulo.y).toBeCloseTo(0);
    expect(circulo.radio).toBeCloseTo(Math.hypot(4, 2) / 2 / 4);
  });

  // Un objeto que no llena su imagen: el circulo es el del objeto, corrido
  // hacia donde esta.
  it('lo transparente no cuenta', () => {
    const circulo = circuloDeLoOpaco(alfaDe(10, 10, (x, y) => x < 4 && y < 4));
    expect(circulo.x).toBeCloseTo(-0.3);
    expect(circulo.y).toBeCloseTo(-0.3);
    expect(circulo.radio).toBeCloseTo(Math.hypot(4, 4) / 2 / 10);
  });

  // Los PNG se recortan donde el alfa pasa de 8: lo que esta por debajo no se
  // ve, y contarlo achicaria al objeto por una sombra invisible.
  it('lo que casi no se ve no cuenta, y lo que se ve si', () => {
    const conPolvo = alfaDe(10, 10, (x, y) => x < 4 && y < 4);
    conPolvo.alfa[9 * 10 + 9] = 5;
    expect(circuloDeLoOpaco(conPolvo).radio).toBeCloseTo(Math.hypot(4, 4) / 2 / 10);

    conPolvo.alfa[9 * 10 + 9] = 200;
    expect(circuloDeLoOpaco(conPolvo).radio).toBeCloseTo(Math.hypot(10, 10) / 2 / 10);
  });

  it('sin nada que se vea no hay circulo', () => {
    expect(circuloDeLoOpaco(alfaDe(6, 6, () => false))).toBeNull();
  });
});

describe('crearBanco', () => {
  it('carga y devuelve lo que pidieron', async () => {
    const banco = crearBanco({ cargar: async (ruta) => ({ ruta }) });
    await banco.precargar(['a.png', 'b.png']);
    expect(banco.obtener('a.png')).toEqual({ ruta: 'a.png' });
  });

  it('devuelve null en vez de romperse cuando un archivo no esta', async () => {
    const banco = crearBanco({
      cargar: async (ruta) => {
        if (ruta === 'falta.png') throw new Error('404');
        return { ruta };
      },
    });
    const informe = await banco.precargar(['ok.png', 'falta.png']);

    expect(banco.obtener('falta.png')).toBeNull();
    expect(banco.obtener('ok.png')).toEqual({ ruta: 'ok.png' });
    expect(informe.faltantes).toEqual(['falta.png']);
    expect(informe.total).toBe(2);
  });

  it('no carga dos veces la misma ruta', async () => {
    const cargar = vi.fn(async (ruta) => ({ ruta }));
    const banco = crearBanco({ cargar });
    await banco.precargar(['a.png', 'a.png']);
    await banco.precargar(['a.png']);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('devuelve null para algo que nunca se pidio', () => {
    expect(crearBanco({ cargar: async () => ({}) }).obtener('nada.png')).toBeNull();
  });

  it('antepone la raiz al pedir el archivo pero guarda la ruta original como clave', async () => {
    const pedidas = [];
    const banco = crearBanco({
      cargar: async (ruta) => {
        pedidas.push(ruta);
        return { ruta };
      },
      raiz: '/contenido/',
    });
    await banco.precargar(['assets/civil/casco.png']);

    expect(pedidas).toEqual(['/contenido/assets/civil/casco.png']);
    expect(banco.obtener('assets/civil/casco.png')).toEqual({
      ruta: '/contenido/assets/civil/casco.png',
    });
  });

  it('lleva la lista de faltantes para el panel de operacion', async () => {
    const banco = crearBanco({
      cargar: async () => {
        throw new Error('no');
      },
    });
    await banco.precargar(['x.png', 'y.png']);
    expect(banco.faltantes().sort()).toEqual(['x.png', 'y.png']);
  });

  it('precargar sin rutas no se rompe', async () => {
    const banco = crearBanco({ cargar: async () => ({}) });
    const informe = await banco.precargar([]);
    expect(informe).toEqual({ total: 0, faltantes: [] });
  });
});

// Leer los pixeles de una imagen cuesta: se mide una sola vez y se guarda.
describe('crearBanco: el circulo de cada objeto', () => {
  // Un PNG de 10x10 con el objeto en el rincon de arriba a la izquierda.
  const enUnRincon = () => alfaDe(10, 10, (x, y) => x < 4 && y < 4);

  it('mide lo que ocupa cada imagen una sola vez', async () => {
    const leerAlfa = vi.fn(enUnRincon);
    const banco = crearBanco({ cargar: async (ruta) => ({ ruta }), leerAlfa });
    await banco.precargar(['a.png']);

    const circulo = banco.circuloDe('a.png');
    expect(circulo.x).toBeCloseTo(-0.3);
    expect(circulo.radio).toBeCloseTo(Math.hypot(4, 4) / 2 / 10);
    expect(banco.circuloDe('a.png')).toBe(circulo);
    expect(leerAlfa).toHaveBeenCalledTimes(1);
    expect(leerAlfa).toHaveBeenCalledWith({ ruta: 'a.png' });
  });

  // El carrusel pide el circulo en cada cuadro, aunque la imagen todavia no
  // haya llegado: eso no puede dejarla sin medir para siempre.
  it('antes de que la imagen cargue no hay circulo, y aparece cuando carga', async () => {
    const leerAlfa = vi.fn(enUnRincon);
    const banco = crearBanco({ cargar: async (ruta) => ({ ruta }), leerAlfa });

    expect(banco.circuloDe('a.png')).toBeNull();
    await banco.precargar(['a.png']);
    expect(banco.circuloDe('a.png')).not.toBeNull();
    expect(leerAlfa).toHaveBeenCalledTimes(1);
  });

  // Una imagen que no se deja leer —un lienzo que el navegador marco como
  // ajeno— no puede tirar una excepcion por cuadro: se queda sin circulo y el
  // dibujo usa el de la imagen entera.
  it('si no se puede leer la imagen se queda sin circulo, y no reintenta en cada cuadro', async () => {
    const leerAlfa = vi.fn(() => {
      throw new Error('SecurityError');
    });
    const banco = crearBanco({ cargar: async (ruta) => ({ ruta }), leerAlfa });
    await banco.precargar(['a.png']);

    expect(banco.circuloDe('a.png')).toBeNull();
    expect(banco.circuloDe('a.png')).toBeNull();
    expect(leerAlfa).toHaveBeenCalledTimes(1);
  });

  it('una imagen que falta no tiene circulo', async () => {
    const leerAlfa = vi.fn(enUnRincon);
    const banco = crearBanco({
      cargar: async () => {
        throw new Error('404');
      },
      leerAlfa,
    });
    await banco.precargar(['falta.png']);

    expect(banco.circuloDe('falta.png')).toBeNull();
    expect(leerAlfa).not.toHaveBeenCalled();
  });

  it('sin forma de leer pixeles no hay circulo', async () => {
    const banco = crearBanco({ cargar: async (ruta) => ({ ruta }) });
    await banco.precargar(['a.png']);
    expect(banco.circuloDe('a.png')).toBeNull();
  });
});

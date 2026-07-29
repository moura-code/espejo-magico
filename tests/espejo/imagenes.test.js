import { describe, it, expect, vi } from 'vitest';
import { crearBanco } from '../../espejo/imagenes.js';

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
      raiz: '/',
    });
    await banco.precargar(['assets/civil/casco.png']);

    expect(pedidas).toEqual(['/assets/civil/casco.png']);
    expect(banco.obtener('assets/civil/casco.png')).toEqual({
      ruta: '/assets/civil/casco.png',
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

import { describe, expect, it, vi } from 'vitest';
import { ACCIONES, mensajeControles } from '../../comun/protocolo.js';
import { crearTabletDeControles } from '../../tablet/controles.js';

describe('tablet de controles', () => {
  it('muestra los botones recibidos y envia la accion pulsada', () => {
    let pulsar = null;
    const pantalla = {
      mostrar: vi.fn((_estado, alPulsar) => {
        pulsar = alPulsar;
      }),
    };
    const enviar = vi.fn();
    const tablet = crearTabletDeControles({ pantalla, enviar });
    const mensaje = mensajeControles('ESCENA', [
      { id: ACCIONES.TERMINAR, etiqueta: 'TERMINAR', color: '#FFD23F' },
    ]);

    tablet.recibir(mensaje);
    pulsar(ACCIONES.TERMINAR);

    expect(pantalla.mostrar).toHaveBeenCalledWith({
      estado: 'ESCENA',
      botones: mensaje.botones,
      carrera: null,
    }, expect.any(Function));
    expect(enviar).toHaveBeenCalledWith({ tipo: 'accion', id: ACCIONES.TERMINAR });
  });

  it('no redibuja los latidos que no cambiaron', () => {
    const pantalla = { mostrar: vi.fn() };
    const tablet = crearTabletDeControles({ pantalla, enviar: vi.fn() });
    const mensaje = mensajeControles('ATRACCION', []);

    tablet.recibir(mensaje);
    tablet.recibir(mensaje);

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
  });

  it('guarda la carrera y la muestra solamente despues del sorteo', () => {
    const pantalla = { mostrar: vi.fn() };
    const carrera = {
      id: 'civil',
      nombre: 'Ingeniería Civil',
      color: '#FF8A3D',
      accesorio: { img: 'assets/civil/casco.png' },
    };
    const tablet = crearTabletDeControles({
      pantalla,
      enviar: vi.fn(),
      obtenerCarrera: () => carrera,
    });

    tablet.recibir(mensajeControles('SORTEO', []));
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });
    tablet.recibir(mensajeControles('REVELACION', []));

    expect(pantalla.mostrar).toHaveBeenNthCalledWith(1, {
      estado: 'SORTEO',
      botones: [],
      carrera: null,
    }, expect.any(Function));
    expect(pantalla.mostrar).toHaveBeenNthCalledWith(2, {
      estado: 'REVELACION',
      botones: [],
      carrera,
    }, expect.any(Function));
  });

  it('completa el simbolo al reconectar y no reanima los latidos repetidos', () => {
    const pantalla = { mostrar: vi.fn() };
    const carrera = { id: 'civil', nombre: 'Ingeniería Civil', color: '#FF8A3D' };
    const tablet = crearTabletDeControles({
      pantalla,
      enviar: vi.fn(),
      obtenerCarrera: () => carrera,
    });
    const controles = mensajeControles('ESCENA', []);
    const anuncio = { tipo: 'carrera', id: 'civil', sesion: 4 };

    tablet.recibir(controles);
    tablet.recibir(anuncio);
    tablet.recibir(anuncio);
    tablet.recibir(controles);

    expect(pantalla.mostrar).toHaveBeenCalledTimes(2);
    expect(pantalla.mostrar).toHaveBeenLastCalledWith({
      estado: 'ESCENA',
      botones: [],
      carrera,
    }, expect.any(Function));
  });
});

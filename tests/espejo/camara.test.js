import { describe, it, expect, vi } from 'vitest';
import {
  abrirCamara,
  crearReintentador,
  crearSelectorDeCamara,
  siguienteCamara,
} from '../../espejo/camara.js';

// Cede el turno al reloj de verdad. Con `Promise.resolve()` el bucle de reintento
// giraria en microtareas y ningun setTimeout del test llegaria a dispararse.
const yaMismo = () => new Promise((ok) => setTimeout(ok, 0));

describe('abrirCamara', () => {
  it('pide el dispositivo elegido y entrega sus datos', async () => {
    const pista = {
      kind: 'video',
      label: 'Camara lateral',
      addEventListener: vi.fn(),
      getSettings: () => ({ deviceId: 'lateral' }),
      stop: vi.fn(),
    };
    const obtenerMedia = vi.fn().mockResolvedValue({
      getTracks: () => [pista],
      getVideoTracks: () => [pista],
    });
    const video = { play: vi.fn().mockResolvedValue(), srcObject: null };

    const camara = await abrirCamara({
      ancho: 1280,
      alto: 720,
      dispositivoId: 'lateral',
      obtenerMedia,
      crearVideo: () => video,
    });

    expect(obtenerMedia).toHaveBeenCalledWith({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        deviceId: { exact: 'lateral' },
      },
      audio: false,
    });
    expect(camara.dispositivoId).toBe('lateral');
    expect(camara.nombre).toBe('Camara lateral');
    camara.detener();
    expect(pista.stop).toHaveBeenCalledOnce();
  });
});

describe('crearReintentador', () => {
  it('entrega la camara cuando abre a la primera', async () => {
    const camara = { video: 'falso', detener() {} };
    const reintentador = crearReintentador({
      abrir: vi.fn().mockResolvedValue(camara),
      reintentoMs: 1,
      alEstado: () => {},
      dormir: yaMismo,
    });

    await reintentador.listo();
    expect(reintentador.obtener()).toBe(camara);
  });

  it('reintenta hasta conseguirla y avisa cada fracaso', async () => {
    const camara = { video: 'falso', detener() {} };
    const abrir = vi
      .fn()
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockResolvedValue(camara);
    const estados = [];

    const reintentador = crearReintentador({
      abrir,
      reintentoMs: 1,
      alEstado: (e) => estados.push(e),
      dormir: yaMismo,
    });

    await reintentador.listo();
    expect(abrir).toHaveBeenCalledTimes(3);
    expect(reintentador.obtener()).toBe(camara);
    expect(estados.filter((e) => !e.lista)).toHaveLength(2);
    expect(estados.at(-1)).toEqual({ lista: true });
  });

  it('vuelve a abrir cuando se le avisa que la camara se perdio', async () => {
    const primera = { video: 'a', detener: vi.fn() };
    const segunda = { video: 'b', detener: vi.fn() };
    const abrir = vi.fn().mockResolvedValueOnce(primera).mockResolvedValueOnce(segunda);

    const reintentador = crearReintentador({
      abrir, reintentoMs: 1, alEstado: () => {}, dormir: yaMismo,
    });
    await reintentador.listo();

    reintentador.perdida();
    await reintentador.listo();

    expect(reintentador.obtener()).toBe(segunda);
    expect(abrir).toHaveBeenCalledTimes(2);
  });

  it('cierra la camara anterior antes de cambiarla', async () => {
    const primera = { video: 'a', detener: vi.fn() };
    const segunda = { video: 'b', detener: vi.fn() };
    const abrir = vi.fn().mockResolvedValueOnce(primera).mockResolvedValueOnce(segunda);
    const estados = [];
    const reintentador = crearReintentador({
      abrir, reintentoMs: 1, alEstado: (estado) => estados.push(estado), dormir: yaMismo,
    });
    await reintentador.listo();

    await reintentador.reabrir();

    expect(primera.detener).toHaveBeenCalledOnce();
    expect(reintentador.obtener()).toBe(segunda);
    expect(estados).toContainEqual({ lista: false, cambiando: true });
  });

  it('deja de reintentar despues de detener', async () => {
    const abrir = vi.fn().mockRejectedValue(new Error('sin camara'));
    const reintentador = crearReintentador({
      abrir, reintentoMs: 1, alEstado: () => {}, dormir: yaMismo,
    });

    await new Promise((ok) => setTimeout(ok, 10));
    reintentador.detener();
    const intentosAlDetener = abrir.mock.calls.length;

    await new Promise((ok) => setTimeout(ok, 10));
    expect(abrir.mock.calls.length).toBe(intentosAlDetener);
    expect(reintentador.obtener()).toBeNull();
  });

  it('cierra la camara que llego tarde si ya se detuvo', async () => {
    const camara = { video: 'tardia', detener: vi.fn() };
    let resolver;
    const abrir = vi.fn(() => new Promise((ok) => { resolver = ok; }));

    const reintentador = crearReintentador({
      abrir, reintentoMs: 1, alEstado: () => {}, dormir: yaMismo,
    });

    reintentador.detener();
    resolver(camara);
    await reintentador.listo();

    expect(camara.detener).toHaveBeenCalled();
    expect(reintentador.obtener()).toBeNull();
  });
});

describe('seleccion de camara', () => {
  const CAMARAS = [
    { id: 'frontal', nombre: 'Frontal' },
    { id: 'lateral', nombre: 'Lateral' },
  ];

  it('elige la siguiente y vuelve al principio', () => {
    expect(siguienteCamara(CAMARAS, 'frontal')).toEqual(CAMARAS[1]);
    expect(siguienteCamara(CAMARAS, 'lateral')).toEqual(CAMARAS[0]);
  });

  it('elige la primera si la camara actual ya no existe', () => {
    expect(siguienteCamara(CAMARAS, 'desconectada')).toEqual(CAMARAS[0]);
    expect(siguienteCamara([], 'desconectada')).toBeNull();
  });

  it('guarda la camara elegida al avanzar', async () => {
    const alGuardar = vi.fn();
    const selector = crearSelectorDeCamara({
      abrir: vi.fn(),
      enumerarDispositivos: vi.fn().mockResolvedValue([
        { kind: 'audioinput', deviceId: 'microfono', label: 'Microfono' },
        { kind: 'videoinput', deviceId: 'frontal', label: 'Frontal' },
        { kind: 'videoinput', deviceId: 'lateral', label: 'Lateral' },
      ]),
      alGuardar,
    });

    await expect(selector.siguiente('frontal')).resolves.toEqual(CAMARAS[1]);
    expect(selector.seleccionada()).toBe('lateral');
    expect(alGuardar).toHaveBeenCalledWith('lateral');
  });

  it('permite elegir directamente una camara disponible', async () => {
    const alGuardar = vi.fn();
    const selector = crearSelectorDeCamara({
      abrir: vi.fn(),
      enumerarDispositivos: vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'frontal', label: 'Frontal' },
        { kind: 'videoinput', deviceId: 'lateral', label: 'Lateral' },
      ]),
      alGuardar,
    });

    await expect(selector.seleccionar('lateral', 'frontal')).resolves.toEqual(CAMARAS[1]);
    expect(selector.seleccionada()).toBe('lateral');
    expect(alGuardar).toHaveBeenCalledWith('lateral');
  });

  it('rechaza una camara que desaparecio de la lista', async () => {
    const selector = crearSelectorDeCamara({
      abrir: vi.fn(),
      enumerarDispositivos: vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'frontal', label: 'Frontal' },
      ]),
    });

    await expect(selector.seleccionar('lateral', 'frontal')).rejects.toThrow(
      'ya no esta disponible',
    );
  });

  it('vuelve a la predeterminada si la seleccion guardada desaparecio', async () => {
    const error = Object.assign(new Error('no existe'), { name: 'NotFoundError' });
    const predeterminada = { video: 'predeterminada' };
    const abrir = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(predeterminada);
    const alGuardar = vi.fn();
    const selector = crearSelectorDeCamara({
      abrir,
      enumerarDispositivos: vi.fn(),
      seleccionGuardada: 'desconectada',
      alGuardar,
    });

    await expect(selector.abrir()).resolves.toBe(predeterminada);
    expect(abrir).toHaveBeenNthCalledWith(1, 'desconectada');
    expect(abrir).toHaveBeenNthCalledWith(2, null);
    expect(alGuardar).toHaveBeenCalledWith(null);
  });
});

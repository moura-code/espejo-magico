import { describe, it, expect, vi } from 'vitest';
import { crearReintentador, vigilarFlujo } from '../../espejo/camara.js';

// El reintentador sabe recuperarse, pero alguien tiene que avisarle. Sin esto,
// un cable USB pateado deja al espejo mirando una camara muerta para siempre:
// `obtener()` sigue devolviendo el flujo viejo y nadie vuelve a intentar.
describe('vigilarFlujo', () => {
  const pistaFalsa = () => {
    const oyentes = [];
    return {
      pista: { addEventListener: (evento, fn) => oyentes.push({ evento, fn }) },
      terminar: () => oyentes.filter((o) => o.evento === 'ended').forEach((o) => o.fn()),
    };
  };

  it('avisa cuando se corta una pista del flujo', () => {
    const { pista, terminar } = pistaFalsa();
    const avisos = [];

    vigilarFlujo({ getTracks: () => [pista] }, () => avisos.push('perdida'));
    expect(avisos).toEqual([]);

    terminar();
    expect(avisos).toEqual(['perdida']);
  });

  it('avisa una sola vez aunque terminen todas las pistas', () => {
    const primera = pistaFalsa();
    const segunda = pistaFalsa();
    const avisos = [];

    vigilarFlujo({ getTracks: () => [primera.pista, segunda.pista] }, () =>
      avisos.push('perdida'),
    );
    primera.terminar();
    segunda.terminar();

    expect(avisos).toEqual(['perdida']);
  });
});

// Cede el turno al reloj de verdad. Con `Promise.resolve()` el bucle de reintento
// giraria en microtareas y ningun setTimeout del test llegaria a dispararse.
const yaMismo = () => new Promise((ok) => setTimeout(ok, 0));

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

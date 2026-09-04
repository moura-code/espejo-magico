import { describe, it, expect, vi } from 'vitest';
import { crearPuente } from '../../espejo/maite.js';

const BASE = { url: 'http://localhost:3000', tiempoLimiteMs: 1500 };

/** Un fetch de mentira que anota lo que le piden. */
function espia(respuesta = { ok: true, status: 200 }) {
  const llamadas = [];
  const enviar = vi.fn(async (url, opciones) => {
    llamadas.push({ url, opciones });
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
  return { enviar, llamadas };
}

const callado = () => vi.fn();

describe('crearPuente', () => {
  it('le manda a MAITE el id de la carrera', async () => {
    const { enviar, llamadas } = espia();
    const puente = crearPuente({ ...BASE, enviar, avisar: callado() });

    const resultado = await puente.carrera('sistemas');

    expect(resultado.ok).toBe(true);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('http://localhost:3000/api/carrera');
    expect(llamadas[0].opciones.method).toBe('POST');
    expect(JSON.parse(llamadas[0].opciones.body)).toEqual({ carreraId: 'sistemas' });
  });

  it('pide volver al humo al terminar la sesion', async () => {
    const { enviar, llamadas } = espia();
    const puente = crearPuente({ ...BASE, enviar, avisar: callado() });

    await puente.humo();
    expect(llamadas[0].url).toBe('http://localhost:3000/api/humo');
  });

  // LA REGLA QUE NO SE NEGOCIA. Si esto lanzara, se llevaria puesto el bucle de
  // dibujo y el espejo quedaria congelado con publico delante porque una tablet
  // no contesto.
  it('no lanza cuando MAITE no esta levantado', async () => {
    const { enviar } = espia(new Error('ECONNREFUSED'));
    const avisar = callado();
    const puente = crearPuente({ ...BASE, enviar, avisar });

    const resultado = await puente.carrera('sistemas');
    expect(resultado.ok).toBe(false);
    expect(avisar).toHaveBeenCalled();
  });

  it('no lanza cuando MAITE contesta un error', async () => {
    const { enviar } = espia({ ok: false, status: 400 });
    const puente = crearPuente({ ...BASE, enviar, avisar: callado() });

    const resultado = await puente.carrera('inventada');
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain('400');
  });

  it('no lanza cuando la respuesta viene rota', async () => {
    const enviar = vi.fn(async () => undefined);
    const puente = crearPuente({ ...BASE, enviar, avisar: callado() });

    await expect(puente.carrera('sistemas')).resolves.toMatchObject({ ok: false });
  });

  // El tiempo limite es lo que impide que una tablet colgada deje al espejo
  // esperando: se corta el intento y se sigue.
  it('corta el intento al vencerse el tiempo limite', async () => {
    let abortada = false;

    // Una tablet colgada: nunca contesta. Se comporta como fetch de verdad, que
    // rechaza al toque si la señal ya venia abortada y si no espera el evento.
    const enviar = vi.fn(
      (_url, opciones) =>
        new Promise((_ok, falla) => {
          const cortar = () => {
            abortada = true;
            falla(new Error('abortado'));
          };
          if (opciones.signal.aborted) return cortar();
          opciones.signal.addEventListener('abort', cortar);
        }),
    );

    // El temporizador se dispara solo, sin esperar los 1500 ms de verdad.
    const puente = crearPuente({
      ...BASE,
      enviar,
      avisar: callado(),
      temporizador: (fn) => {
        fn();
        return 1;
      },
      cancelar: () => {},
    });

    const resultado = await puente.carrera('sistemas');
    expect(abortada).toBe(true);
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('sin respuesta');
  });

  it('cancela el temporizador cuando la respuesta llega a tiempo', async () => {
    const { enviar } = espia();
    const cancelar = vi.fn();
    const puente = crearPuente({
      ...BASE,
      enviar,
      avisar: callado(),
      temporizador: () => 7,
      cancelar,
    });

    await puente.carrera('sistemas');
    expect(cancelar).toHaveBeenCalledWith(7);
  });

  // Una carrera sin `maite` en carreras.json existe en el espejo pero todavia no
  // tiene gente filmada. No es un error y no hay a quien avisarle.
  it('no manda nada por una carrera sin par en MAITE', async () => {
    const { enviar, llamadas } = espia();
    const puente = crearPuente({ ...BASE, enviar, avisar: callado() });

    const resultado = await puente.carrera(null);
    expect(resultado.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
    expect(puente.ultimo().estado).toBe('sin-par-en-maite');
  });

  it('apagado no toca la red', async () => {
    const { enviar, llamadas } = espia();
    const puente = crearPuente({ ...BASE, activo: false, enviar, avisar: callado() });

    await puente.carrera('sistemas');
    await puente.humo();

    expect(llamadas).toHaveLength(0);
    expect(puente.activo()).toBe(false);
  });

  // El panel del stand lo lee: si las tablets no acompañan, dice de un vistazo
  // si el espejo llego a avisar o si el problema esta del otro lado.
  it('recuerda el ultimo envio para el panel', async () => {
    const { enviar } = espia();
    const puente = crearPuente({ ...BASE, enviar, avisar: callado() });
    expect(puente.ultimo().estado).toBe('sin-usar');

    await puente.carrera('civil');
    expect(puente.ultimo()).toEqual({ estado: 'carrera', enviado: 'civil', ok: true });

    await puente.humo();
    expect(puente.ultimo()).toEqual({ estado: 'humo', enviado: null, ok: true });
  });
});

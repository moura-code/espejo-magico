// El unico puente que sale de esta PC.
//
// Anota en el servidor del espejo (POST /estado.json) que carrera eligio la
// persona; MAITE (el proyecto de las tablets) lee ese JSON y las cuatro tablets
// muestran a la gente de esa ingenieria. Va y no vuelve: el espejo no lee nada
// de MAITE ni espera nada suyo.
//
// LA REGLA QUE NO SE NEGOCIA: ESTO NUNCA PUEDE ROMPER EL ESPEJO. Si MAITE no
// esta levantado, si tarda, si contesta cualquier cosa o si alguien desenchufo
// el cable, la experiencia sigue exactamente igual y lo unico que queda es un
// aviso en la consola. Por eso no hay reintentos, no hay cola y no hay estado
// compartido: un intento, un limite de tiempo corto, y seguir.
//
// El id que viaja es el de MAITE (`maite` en carreras.json), no el del espejo:
// los dos catalogos crecieron por separado y "computacion" aca es "sistemas"
// alla.

const NADA = { ok: false, motivo: 'apagado' };

export function crearPuente({
  url,
  activo = true,
  tiempoLimiteMs = 1500,
  enviar = fetch,
  avisar = console.warn,
  temporizador = setTimeout,
  cancelar = clearTimeout,
}) {
  let ultimo = { estado: 'sin-usar', enviado: null, ok: null };

  async function pegar(camino, cuerpo) {
    const corte = new AbortController();
    const reloj = temporizador(() => corte.abort(), tiempoLimiteMs);

    try {
      const respuesta = await enviar(`${url}${camino}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: corte.signal,
      });

      if (!respuesta?.ok) {
        avisar(`El aviso para MAITE contestó ${respuesta?.status ?? '?'} en ${camino}`);
        return { ok: false, motivo: `http ${respuesta?.status ?? '?'}` };
      }
      return { ok: true };
    } catch (error) {
      // Incluye el corte por tiempo, que es un abort. No se distingue a
      // proposito: para el espejo "no contesto a tiempo" y "no contesto" son
      // exactamente lo mismo.
      avisar(`El aviso para MAITE no llegó (${camino}):`, error?.message ?? error);
      return { ok: false, motivo: 'sin respuesta' };
    } finally {
      cancelar(reloj);
    }
  }

  return {
    /** La persona eligio esta ingenieria. `id` es el id DE MAITE. */
    async carrera(id) {
      if (!activo) return NADA;
      if (!id) {
        // Una carrera sin `maite` en carreras.json: existe en el espejo pero
        // todavia no tiene gente filmada del otro lado. No es un error.
        ultimo = { estado: 'sin-par-en-maite', enviado: null, ok: false };
        return { ok: false, motivo: 'la carrera no tiene id de MAITE' };
      }

      const resultado = await pegar('/estado.json', { mode: 'carrera', carreraId: id });
      ultimo = { estado: 'carrera', enviado: id, ok: resultado.ok };
      return resultado;
    },

    /**
     * Las tablets vuelven a su humo de reposo: al terminar la sesion y al
     * empezar una eleccion nueva. Si ya estan en humo no se repite, porque
     * cada aviso le reinicia a las tablets el video de humo.
     */
    async humo() {
      if (!activo) return NADA;
      if (ultimo.estado === 'humo' && ultimo.ok) return { ok: true, repetido: true };
      const resultado = await pegar('/estado.json', { mode: 'humo' });
      ultimo = { estado: 'humo', enviado: null, ok: resultado.ok };
      return resultado;
    },

    // Para el panel de diagnostico del stand (tecla P): si las tablets no
    // acompañan, esto dice en un vistazo si el espejo llego a avisar.
    ultimo: () => ultimo,
    activo: () => activo,
  };
}

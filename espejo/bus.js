// Cliente WebSocket con reconexion automatica.
//
// Si se cae el wifi durante el evento, nadie tiene que ir a tocar nada: cada
// cliente reintenta solo cada dos segundos hasta volver.

import { interpretar } from '../comun/protocolo.js';

const ABIERTO = 1;

export function crearBus({
  url,
  reconexionMs,
  alMensaje = () => {},
  alEstado = () => {},
  CrearSocket = WebSocket,
  programar = setTimeout,
  cancelar = clearTimeout,
}) {
  let socket = null;
  let vivo = true;
  let pendiente = null;

  function conectar() {
    pendiente = null;
    socket = new CrearSocket(url);

    socket.onopen = () => alEstado({ conectado: true });

    socket.onmessage = (evento) => {
      const mensaje = interpretar(
        typeof evento.data === 'string' ? evento.data : String(evento.data),
      );
      if (mensaje) alMensaje(mensaje);
    };

    socket.onclose = () => {
      socket = null;
      alEstado({ conectado: false });
      if (vivo) pendiente = programar(conectar, reconexionMs);
    };

    socket.onerror = () => {
      try {
        socket?.close();
      } catch {
        /* ya estaba cerrado */
      }
    };
  }

  conectar();

  return {
    enviar(mensaje) {
      if (socket && socket.readyState === ABIERTO) {
        socket.send(JSON.stringify(mensaje));
        return true;
      }
      return false;
    },

    conectado: () => Boolean(socket) && socket.readyState === ABIERTO,

    cerrar() {
      vivo = false;
      if (pendiente !== null) cancelar(pendiente);
      pendiente = null;

      // Se vacia `socket` ANTES de cerrarlo: el onclose que dispara encontraria
      // `vivo` en false igual, pero asi tampoco queda una referencia viva.
      const aCerrar = socket;
      socket = null;
      aCerrar?.close();
    },
  };
}

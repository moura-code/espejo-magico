import { mensajeAccion, TIPOS } from '../comun/protocolo.js';

export function crearTabletDeControles({ pantalla, enviar }) {
  let firmaAnterior = null;

  return {
    recibir(mensaje) {
      if (mensaje.tipo !== TIPOS.CONTROLES) return;
      const firma = JSON.stringify(mensaje);
      if (firma === firmaAnterior) return;
      firmaAnterior = firma;

      pantalla.mostrar(mensaje.botones, (id) => enviar(mensajeAccion(id)));
    },
  };
}

export function crearPantallaDeControles({ contenedor, documento = document }) {
  return {
    mostrar(botones, alPulsar) {
      const elementos = botones.map((boton) => {
        const elemento = documento.createElement('button');
        elemento.type = 'button';
        elemento.className = 'control';
        elemento.dataset.accion = boton.id;
        elemento.style.setProperty('--color', boton.color);
        elemento.textContent = boton.etiqueta;
        elemento.addEventListener('click', () => alPulsar(boton.id));
        return elemento;
      });

      contenedor.style.setProperty('--cantidad', Math.max(1, botones.length));
      contenedor.replaceChildren(...elementos);
      contenedor.classList.toggle('sin-controles', botones.length === 0);
    },
  };
}

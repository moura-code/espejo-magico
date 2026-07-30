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
      const elementos = botones.map((boton, indice) => {
        const elemento = documento.createElement('button');
        elemento.type = 'button';
        elemento.className = 'control';
        elemento.dataset.accion = boton.id;
        elemento.style.setProperty('--color', boton.color);
        elemento.style.setProperty('--indice', indice);
        elemento.textContent = boton.etiqueta;
        elemento.addEventListener('click', () => {
          elemento.classList.remove('pulsado');
          void elemento.offsetWidth;
          elemento.classList.add('pulsado');
          alPulsar(boton.id);
        });
        return elemento;
      });

      contenedor.style.setProperty('--cantidad', Math.max(1, botones.length));
      contenedor.dataset.cantidad = String(botones.length);
      contenedor.replaceChildren(...elementos);
      contenedor.classList.toggle('sin-controles', botones.length === 0);
    },
  };
}

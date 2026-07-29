// La tablet no decide nada: recibe un mensaje y reacciona. Toda la inteligencia
// esta en el espejo.
//
// La parte de DOM vive detras de `pantalla`, para que la logica se pruebe en Node.

export function elegirReferente(carrera, slot) {
  if (!carrera?.referentes?.length) return null;
  return carrera.referentes[slot % carrera.referentes.length];
}

export function crearTablet({ slot, contenido, pantalla }) {
  let ultimaSesion = null;

  return {
    recibir(mensaje) {
      if (mensaje.tipo === 'reposo') {
        pantalla.ocultar();
        return;
      }

      // El espejo reenvia su ultimo mensaje cada dos segundos para que una
      // tablet que se reconecta se ponga al dia. Sin este corte, el video
      // volveria a empezar en cada latido.
      if (mensaje.sesion === ultimaSesion) return;

      const carrera = contenido.obtener(mensaje.id);
      const referente = elegirReferente(carrera, slot);
      if (!referente) return;

      ultimaSesion = mensaje.sesion;
      pantalla.mostrar(referente, carrera);
    },
  };
}

export function crearPantallaDeVideo({ video, rotulo, nombre, detalle, cuerpo, raiz = '/contenido/' }) {
  return {
    mostrar(referente, carrera) {
      nombre.textContent = referente.nombre;
      detalle.textContent = referente.detalle ?? '';
      nombre.style.color = carrera.color;
      rotulo.style.borderBottomColor = carrera.color;

      const fuente = raiz + referente.video;
      if (!video.src.endsWith(referente.video)) video.src = fuente;
      video.currentTime = 0;
      video.play().catch(() => {
        /* el navegador lo rechazo; queda el rotulo con el nombre */
      });

      cuerpo.classList.add('encendida');
    },

    ocultar() {
      cuerpo.classList.remove('encendida');
      video.pause();
    },
  };
}

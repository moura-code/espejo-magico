// Las nubes del espejo: su estado de reposo, no un efecto de mitad de sesion.
//
// El espejo descansa cubierto; las nubes se abren desde la cara del visitante
// en la revelacion y se vuelven a cerrar cuando la persona se va. `cobertura`
// es cuanta niebla hay; `revelado` es cuanto se abrio el agujero alrededor de
// la cara. Separarlos deja que la revelacion se anime sin que la niebla
// desaparezca de golpe.
//
// objetivoDeNiebla dice a donde quiere llegar cada estado. acercarNiebla es
// quien la lleva, a velocidad acotada: la maquina puede saltar de estado de un
// cuadro al otro (alguien se levanta en plena revelacion), pero la niebla no
// salta nunca con ella.

import { ESTADOS } from './maquina-estados.js';

export function objetivoDeNiebla(estado) {
  switch (estado) {
    case ESTADOS.REVELACION:
      return { cobertura: 1, revelado: 1 };
    case ESTADOS.ESCENA:
      return { cobertura: 0, revelado: 1 };
    // ATRACCION, ENGANCHE, SORTEO y CIERRE: espejo tapado. El cierre es el
    // momento en que las nubes vuelven a cubrirlo.
    default:
      return { cobertura: 1, revelado: 0 };
  }
}

export function acercarNiebla(actual, objetivo, dt, velocidades) {
  const paso = (de, a, velocidad) => {
    const maximo = velocidad * dt;
    const delta = a - de;
    return Math.abs(delta) <= maximo ? a : de + Math.sign(delta) * maximo;
  };

  return {
    cobertura: paso(actual.cobertura, objetivo.cobertura, velocidades.cobertura),
    revelado: paso(actual.revelado, objetivo.revelado, velocidades.revelado),
  };
}

export function crearNiebla({ cantidad, azar = Math.random }) {
  const jirones = Array.from({ length: cantidad }, () => ({
    x: azar(),
    y: azar(),
    radio: 0.18 + azar() * 0.28,
    velocidad: (azar() - 0.5) * 0.06,
    fase: azar() * Math.PI * 2,
  }));

  let tiempo = 0;

  return {
    jirones: () => jirones,

    // La agitacion multiplica el movimiento: es el redoble del sorteo. Como la
    // niebla ya esta puesta desde el reposo, lo que anuncia que algo esta
    // pasando es que los jirones se agitan.
    actualizar(dt, agitacion = 1) {
      tiempo += dt * agitacion;
      for (const jiron of jirones) {
        jiron.x += jiron.velocidad * dt * agitacion;
        // Se envuelven a los costados. Los limites son mas anchos que la
        // pantalla para que un jiron no aparezca de la nada en el borde.
        if (jiron.x < -0.3) jiron.x = 1.3;
        else if (jiron.x > 1.3) jiron.x = -0.3;
      }
    },

    dibujar(ctx, disposicion, { cobertura, revelado, centro }) {
      if (cobertura <= 0) return;
      const { ancho, alto } = disposicion;

      ctx.save();
      ctx.globalAlpha = cobertura;

      for (const jiron of jirones) {
        const x = jiron.x * ancho;
        const y = (jiron.y + Math.sin(tiempo * 0.4 + jiron.fase) * 0.02) * alto;
        const radio = jiron.radio * Math.max(ancho, alto) * 0.6;

        const degradado = ctx.createRadialGradient(x, y, 0, x, y, radio);
        degradado.addColorStop(0, 'rgba(232,240,255,0.55)');
        degradado.addColorStop(1, 'rgba(232,240,255,0)');
        ctx.fillStyle = degradado;
        ctx.beginPath();
        ctx.arc(x, y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      // El agujero borra la niebla ya dibujada en vez de pintar encima. Por eso
      // la niebla va en su propia capa: asi el borrado no toca el video ni los
      // objetos que estan debajo.
      if (revelado > 0 && centro) {
        const maximo = Math.hypot(ancho, alto);
        const radio = Math.pow(revelado, 0.7) * maximo;

        ctx.globalCompositeOperation = 'destination-out';
        const agujero = ctx.createRadialGradient(
          centro.x,
          centro.y,
          radio * 0.6,
          centro.x,
          centro.y,
          radio,
        );
        agujero.addColorStop(0, 'rgba(0,0,0,1)');
        agujero.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = agujero;
        ctx.beginPath();
        ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
  };
}

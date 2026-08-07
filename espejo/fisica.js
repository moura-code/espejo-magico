// Fisica de los objetos que caen: gravedad, rebote contra la cabeza, piso y
// paredes. Escrita a mano, sin motor externo.
//
// Un motor como Matter.js daria apilamiento mas convincente, pero suma peso, una
// API que aprender y comportamientos dificiles de acotar. El contrato de este
// modulo esta pensado para permitir el reemplazo si algun dia sobra tiempo.
//
// dt va EN SEGUNDOS, no en milisegundos.

export function crearCuerpo({ x, y, vx = 0, vy = 0, radio, giro = 0, velocidadGiro = 0 }) {
  return { x, y, vx, vy, radio, giro, velocidadGiro };
}

export function integrar(cuerpo, dt, gravedad) {
  cuerpo.vy += gravedad * dt;
  cuerpo.x += cuerpo.vx * dt;
  cuerpo.y += cuerpo.vy * dt;
  cuerpo.giro += cuerpo.velocidadGiro * dt;
}

/**
 * El circulo puede traer su propia velocidad (`vx`, `vy`). Es lo que permite
 * manotear un objeto: se refleja la velocidad RELATIVA, no la absoluta, asi que
 * una mano quieta hace rebotar y una mano en movimiento golpea. Sin esto, mover
 * la mano contra un objeto se siente como chocar una pared.
 */
export function rebotarContraCirculo(cuerpo, circulo, restitucion) {
  const dx = cuerpo.x - circulo.x;
  const dy = cuerpo.y - circulo.y;
  const distancia = Math.hypot(dx, dy);
  const minima = circulo.radio + cuerpo.radio;
  if (distancia >= minima) return false;

  // Si cayo justo en el centro no hay direccion de salida: se lo manda arriba.
  const nx = distancia === 0 ? 0 : dx / distancia;
  const ny = distancia === 0 ? -1 : dy / distancia;

  cuerpo.x = circulo.x + nx * minima;
  cuerpo.y = circulo.y + ny * minima;

  const relativaX = cuerpo.vx - (circulo.vx ?? 0);
  const relativaY = cuerpo.vy - (circulo.vy ?? 0);

  // Solo se refleja si venia entrando. Un objeto que ya se aleja no se frena, y
  // una mano que se retira no lo arrastra con ella.
  const normal = relativaX * nx + relativaY * ny;
  if (normal < 0) {
    cuerpo.vx -= (1 + restitucion) * normal * nx;
    cuerpo.vy -= (1 + restitucion) * normal * ny;
  }
  return true;
}

export function atraerHaciaCirculo(cuerpo, circulo, dt) {
  const alcance = circulo.alcance ?? circulo.radio;
  const fuerza = circulo.fuerza ?? 0;
  if (alcance <= 0 || fuerza <= 0) return false;

  const dx = circulo.x - cuerpo.x;
  const dy = circulo.y - cuerpo.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia === 0 || distancia > alcance + cuerpo.radio) return false;

  const intensidad = 1 - distancia / (alcance + cuerpo.radio);
  const ax = (dx / distancia) * fuerza * intensidad;
  const ay = (dy / distancia) * fuerza * intensidad;

  cuerpo.vx += ax * dt;
  cuerpo.vy += ay * dt;
  return true;
}

export function limitarACaja(cuerpo, caja, restitucion, friccion) {
  let toco = false;

  if (cuerpo.x - cuerpo.radio < caja.x) {
    cuerpo.x = caja.x + cuerpo.radio;
    cuerpo.vx = -cuerpo.vx * restitucion;
    toco = true;
  } else if (cuerpo.x + cuerpo.radio > caja.x + caja.ancho) {
    cuerpo.x = caja.x + caja.ancho - cuerpo.radio;
    cuerpo.vx = -cuerpo.vx * restitucion;
    toco = true;
  }

  // El techo se deja abierto a proposito: los objetos entran cayendo desde arriba.
  if (cuerpo.y + cuerpo.radio > caja.y + caja.alto) {
    cuerpo.y = caja.y + caja.alto - cuerpo.radio;
    cuerpo.vy = -cuerpo.vy * restitucion;
    cuerpo.vx *= friccion;
    cuerpo.velocidadGiro *= friccion;
    toco = true;
  }

  return toco;
}

/** `mundo.colisionadores` son circulos con posicion, radio y velocidad opcional:
 *  la cabeza y las manos del visitante. */
export function paso(cuerpos, dt, mundo) {
  const colisionadores = mundo.colisionadores ?? [];

  for (const cuerpo of cuerpos) {
    if (cuerpo.fijo) continue;
    integrar(cuerpo, dt, mundo.gravedad);
    for (const circulo of colisionadores) {
      if (circulo.interaccion === 'atraer') {
        atraerHaciaCirculo(cuerpo, circulo, dt);
      } else {
        rebotarContraCirculo(cuerpo, circulo, mundo.restitucion);
      }
    }
    limitarACaja(cuerpo, mundo.caja, mundo.restitucion, mundo.friccion);
  }
}

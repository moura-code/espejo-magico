// Fisica de los objetos que caen: gravedad, rebote contra la cabeza, piso,
// paredes y campos de atraccion (el modo iman de las manos). Escrita a mano,
// sin motor externo.
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

/**
 * El modo iman: un resorte hacia un anillo de reposo alrededor de la palma.
 *
 * Cada cuerpo descansa a `atractor.reposo + su propio radio` del centro:
 * afuera de ese anillo el campo tira, adentro empuja. Tirar hacia el centro a
 * secas no sirve — todo lo capturado converge a un unico punto de equilibrio y
 * se encima — y combinarlo con la palma como colisionador tampoco: el tiron
 * continuo pelea con el rebote y el objeto vibra sin aquietarse nunca. El
 * anillo resuelve los dos frentes y ademas deja que cuerpos de distinto tamaño
 * se acomoden en capas.
 *
 * Dentro del campo la velocidad se amortigua: sin ese freno el objeto pasa de
 * largo como una honda. El freno es exponencial para no depender del paso.
 */
export function atraerHaciaCirculo(cuerpo, atractor, dt, campo) {
  const dx = atractor.x - cuerpo.x;
  const dy = atractor.y - cuerpo.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia >= atractor.alcance) return false;

  // Justo en el centro no hay direccion de resorte: solo se frena.
  if (distancia > 0) {
    const reposo = atractor.reposo + cuerpo.radio;
    const error = distancia - reposo;
    const factor = Math.max(-1, Math.min(1, error / Math.max(1, atractor.alcance - reposo)));
    const aceleracion = campo.fuerza * factor;
    cuerpo.vx += (dx / distancia) * aceleracion * dt;
    cuerpo.vy += (dy / distancia) * aceleracion * dt;
  }

  const freno = Math.exp(-campo.amortiguacion * dt);
  cuerpo.vx *= freno;
  cuerpo.vy *= freno;
  return true;
}

/** Elige un solo campo por cuerpo para que dos manos no tiren en sentidos opuestos. */
export function elegirAtractor(cuerpo, atractores) {
  let elegido = null;
  let mejorDistancia = Infinity;

  for (const atractor of atractores) {
    const distancia = Math.hypot(atractor.x - cuerpo.x, atractor.y - cuerpo.y);
    if (distancia >= atractor.alcance || distancia >= mejorDistancia) continue;
    elegido = atractor;
    mejorDistancia = distancia;
  }

  return elegido;
}

/**
 * Aparta de a poco los cuerpos solapados, para que el racimo del iman no sea
 * un bollo de objetos encimados.
 *
 * La correccion es posicional y ademas anula la velocidad de acercamiento del
 * par (contacto inelastico, sin rebote). Solo apartar posiciones no alcanza:
 * el resorte del iman reacelera lo corregido y el racimo hierve en vez de
 * asentarse. `rigidez` va en 1/s; la fraccion corregida por cuadro se deriva
 * con una exponencial para no depender del tamaño del paso.
 */
export function separarCuerpos(cuerpos, dt, rigidez) {
  const fraccion = 1 - Math.exp(-rigidez * dt);

  for (let i = 0; i < cuerpos.length; i++) {
    for (let j = i + 1; j < cuerpos.length; j++) {
      const a = cuerpos[i];
      const b = cuerpos[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distancia = Math.hypot(dx, dy);
      const minima = a.radio + b.radio;
      if (distancia >= minima) continue;

      // Exactamente encimados no hay direccion: se apartan en una fija.
      const nx = distancia === 0 ? 1 : dx / distancia;
      const ny = distancia === 0 ? 0 : dy / distancia;

      const corregir = ((minima - distancia) * fraccion) / 2;
      a.x -= nx * corregir;
      a.y -= ny * corregir;
      b.x += nx * corregir;
      b.y += ny * corregir;

      const acercamiento = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (acercamiento < 0) {
        const mitad = acercamiento / 2;
        a.vx += nx * mitad;
        a.vy += ny * mitad;
        b.vx -= nx * mitad;
        b.vy -= ny * mitad;
      }
    }
  }
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

/**
 * `mundo.colisionadores` son circulos con posicion, radio y velocidad opcional:
 * la cabeza y, en modo golpe, las manos del visitante. `mundo.atractores` son
 * campos de iman `{x, y, alcance, reposo}` que comparten los ajustes de
 * `mundo.atraccion`. Cada cuerpo responde solo al atractor mas cercano.
 *
 * Una mano en modo iman es SOLO atractor, no colisionador: el anillo de reposo
 * del propio campo mantiene los objetos fuera de la palma, y sumarle el
 * circulo duro hace vibrar el racimo. Los capturados ademas se separan entre
 * si, para que el racimo no sea un bollo.
 */
export function paso(cuerpos, dt, mundo) {
  const colisionadores = mundo.colisionadores ?? [];
  const atractores = mundo.atractores ?? [];
  const capturados = new Set();

  for (const cuerpo of cuerpos) {
    integrar(cuerpo, dt, mundo.gravedad);
    const atractor = elegirAtractor(cuerpo, atractores);
    if (atractor && atraerHaciaCirculo(cuerpo, atractor, dt, mundo.atraccion)) {
      capturados.add(cuerpo);
    }
    for (const circulo of colisionadores) {
      rebotarContraCirculo(cuerpo, circulo, mundo.restitucion);
    }
    limitarACaja(cuerpo, mundo.caja, mundo.restitucion, mundo.friccion);
  }

  if (capturados.size > 1) {
    separarCuerpos([...capturados], dt, mundo.atraccion.separacion);
    // La separacion tambien cambia posiciones. Se vuelven a aplicar los
    // limites para que el ultimo paso del cuadro nunca deje un objeto afuera.
    for (const cuerpo of capturados) {
      limitarACaja(cuerpo, mundo.caja, mundo.restitucion, mundo.friccion);
    }
  }
}

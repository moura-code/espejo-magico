// Fisica de los objetos que caen: gravedad, apilamiento, giro, reposo y golpes
// contra la cabeza y las manos. Escrita a mano, sin motor externo.
//
// dt va EN SEGUNDOS, no en milisegundos.

const PASO_MAXIMO = 1 / 120;
const SUBPASOS_MAXIMOS = 8;
const ITERACIONES_COLISION = 6;
const FRICCION_CONTACTO = 0.16;
const RESISTENCIA_AIRE = 0.08;
const RESISTENCIA_GIRO = 0.35;
const UMBRAL_REPOSO = 45;
const ACOPLE_RODADURA = 10;
const VELOCIDAD_MAXIMA = 5000;
const VELOCIDAD_GIRO_MAXIMA = 14;
const EPSILON = 1e-8;

function acotar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function inversaDeMasa(cuerpo) {
  return 1 / Math.max(EPSILON, cuerpo.masa ?? cuerpo.radio * cuerpo.radio);
}

function inversaDeInercia(cuerpo) {
  return (2 * inversaDeMasa(cuerpo)) / Math.max(EPSILON, cuerpo.radio * cuerpo.radio);
}

function limitarVelocidad(cuerpo, velocidadMaxima, velocidadGiroMaxima) {
  const rapidez = Math.hypot(cuerpo.vx, cuerpo.vy);
  if (rapidez > velocidadMaxima) {
    const factor = velocidadMaxima / rapidez;
    cuerpo.vx *= factor;
    cuerpo.vy *= factor;
  }
  cuerpo.velocidadGiro = acotar(
    cuerpo.velocidadGiro,
    -velocidadGiroMaxima,
    velocidadGiroMaxima,
  );
}

function amortiguar(cuerpo, dt, resistenciaAire, resistenciaGiro) {
  const factorLineal = Math.exp(-resistenciaAire * dt);
  cuerpo.vx *= factorLineal;
  cuerpo.vy *= factorLineal;
  cuerpo.velocidadGiro *= Math.exp(-resistenciaGiro * dt);
}

export function crearCuerpo({
  x,
  y,
  vx = 0,
  vy = 0,
  radio,
  giro = 0,
  velocidadGiro = 0,
  masa = radio * radio,
}) {
  return { x, y, vx, vy, radio, giro, velocidadGiro, masa };
}

export function integrar(cuerpo, dt, gravedad) {
  cuerpo.vy += gravedad * dt;
  cuerpo.x += cuerpo.vx * dt;
  cuerpo.y += cuerpo.vy * dt;
  cuerpo.giro += cuerpo.velocidadGiro * dt;
}

export function rebotarContraCirculo(
  cuerpo,
  circulo,
  restitucion,
  friccionContacto = FRICCION_CONTACTO,
) {
  const dx = cuerpo.x - circulo.x;
  const dy = cuerpo.y - circulo.y;
  const distancia = Math.hypot(dx, dy);
  const minima = circulo.radio + cuerpo.radio;
  if (distancia >= minima) return false;

  const nx = distancia <= EPSILON ? 0 : dx / distancia;
  const ny = distancia <= EPSILON ? -1 : dy / distancia;

  cuerpo.x = circulo.x + nx * minima;
  cuerpo.y = circulo.y + ny * minima;

  const relativaX = cuerpo.vx - (circulo.vx ?? 0);
  const relativaY = cuerpo.vy - (circulo.vy ?? 0);
  const velocidadNormal = relativaX * nx + relativaY * ny;
  if (velocidadNormal >= 0) return true;

  const restitucionEfectiva =
    Math.abs(velocidadNormal) <= UMBRAL_REPOSO ? 0 : restitucion;
  const cambioNormal = -(1 + restitucionEfectiva) * velocidadNormal;
  cuerpo.vx += cambioNormal * nx;
  cuerpo.vy += cambioNormal * ny;

  const tx = -ny;
  const ty = nx;
  const velocidadTangencial =
    relativaX * tx + relativaY * ty - cuerpo.velocidadGiro * cuerpo.radio;
  const cambioTangencial = acotar(
    -velocidadTangencial / 3,
    -friccionContacto * cambioNormal,
    friccionContacto * cambioNormal,
  );

  cuerpo.vx += cambioTangencial * tx;
  cuerpo.vy += cambioTangencial * ty;
  cuerpo.velocidadGiro -= (2 * cambioTangencial) / cuerpo.radio;
  return true;
}

export function rebotarEntreCuerpos(
  primero,
  segundo,
  restitucion,
  friccionContacto = FRICCION_CONTACTO,
) {
  const dx = primero.x - segundo.x;
  const dy = primero.y - segundo.y;
  const distancia = Math.hypot(dx, dy);
  const minima = primero.radio + segundo.radio;
  if (distancia >= minima) return false;

  const relativaInicialX = primero.vx - segundo.vx;
  const relativaInicialY = primero.vy - segundo.vy;
  const rapidezRelativa = Math.hypot(relativaInicialX, relativaInicialY);
  const nx =
    distancia > EPSILON
      ? dx / distancia
      : rapidezRelativa > EPSILON
        ? -relativaInicialX / rapidezRelativa
        : 1;
  const ny =
    distancia > EPSILON
      ? dy / distancia
      : rapidezRelativa > EPSILON
        ? -relativaInicialY / rapidezRelativa
        : 0;

  const inversaPrimero = inversaDeMasa(primero);
  const inversaSegundo = inversaDeMasa(segundo);
  const sumaInversas = inversaPrimero + inversaSegundo;
  const penetracion = minima - distancia;

  primero.x += nx * penetracion * (inversaPrimero / sumaInversas);
  primero.y += ny * penetracion * (inversaPrimero / sumaInversas);
  segundo.x -= nx * penetracion * (inversaSegundo / sumaInversas);
  segundo.y -= ny * penetracion * (inversaSegundo / sumaInversas);

  const velocidadNormal = relativaInicialX * nx + relativaInicialY * ny;
  if (velocidadNormal >= 0) return true;

  const restitucionEfectiva =
    Math.abs(velocidadNormal) <= UMBRAL_REPOSO ? 0 : restitucion;
  const impulsoNormal =
    (-(1 + restitucionEfectiva) * velocidadNormal) / sumaInversas;
  primero.vx += impulsoNormal * inversaPrimero * nx;
  primero.vy += impulsoNormal * inversaPrimero * ny;
  segundo.vx -= impulsoNormal * inversaSegundo * nx;
  segundo.vy -= impulsoNormal * inversaSegundo * ny;

  const tx = -ny;
  const ty = nx;
  const velocidadTangencial =
    (primero.vx - segundo.vx) * tx +
    (primero.vy - segundo.vy) * ty -
    primero.velocidadGiro * primero.radio -
    segundo.velocidadGiro * segundo.radio;
  const inversaInerciaPrimero = inversaDeInercia(primero);
  const inversaInerciaSegundo = inversaDeInercia(segundo);
  const masaTangencial =
    sumaInversas +
    primero.radio * primero.radio * inversaInerciaPrimero +
    segundo.radio * segundo.radio * inversaInerciaSegundo;
  const impulsoTangencial = acotar(
    -velocidadTangencial / masaTangencial,
    -friccionContacto * impulsoNormal,
    friccionContacto * impulsoNormal,
  );

  primero.vx += impulsoTangencial * inversaPrimero * tx;
  primero.vy += impulsoTangencial * inversaPrimero * ty;
  segundo.vx -= impulsoTangencial * inversaSegundo * tx;
  segundo.vy -= impulsoTangencial * inversaSegundo * ty;
  primero.velocidadGiro -=
    impulsoTangencial * primero.radio * inversaInerciaPrimero;
  segundo.velocidadGiro -=
    impulsoTangencial * segundo.radio * inversaInerciaSegundo;
  return true;
}

export function limitarACaja(
  cuerpo,
  caja,
  restitucion,
  friccion,
  dt = 1 / 60,
  { umbralReposo = UMBRAL_REPOSO, acopleRodadura = 0 } = {},
) {
  let toco = false;

  if (cuerpo.x - cuerpo.radio < caja.x) {
    cuerpo.x = caja.x + cuerpo.radio;
    if (cuerpo.vx < 0) cuerpo.vx = -cuerpo.vx * restitucion;
    toco = true;
  } else if (cuerpo.x + cuerpo.radio > caja.x + caja.ancho) {
    cuerpo.x = caja.x + caja.ancho - cuerpo.radio;
    if (cuerpo.vx > 0) cuerpo.vx = -cuerpo.vx * restitucion;
    toco = true;
  }

  if (cuerpo.y + cuerpo.radio > caja.y + caja.alto) {
    cuerpo.y = caja.y + caja.alto - cuerpo.radio;
    if (cuerpo.vy > 0) {
      cuerpo.vy =
        cuerpo.vy <= umbralReposo ? 0 : -cuerpo.vy * restitucion;
    }

    const factorFriccion = Math.pow(acotar(friccion, 0, 1), dt * 60);
    cuerpo.vx *= factorFriccion;
    cuerpo.velocidadGiro *= factorFriccion;

    if (acopleRodadura > 0) {
      const deslizamiento =
        cuerpo.vx - cuerpo.velocidadGiro * cuerpo.radio;
      const acople = 1 - Math.exp(-acopleRodadura * dt);
      const cambioTangencial = (-deslizamiento / 3) * acople;
      cuerpo.vx += cambioTangencial;
      cuerpo.velocidadGiro -= (2 * cambioTangencial) / cuerpo.radio;
    }
    toco = true;
  }

  return toco;
}

export function paso(cuerpos, dt, mundo) {
  if (!(dt > 0) || cuerpos.length === 0) return;

  const pasoMaximo = Math.max(EPSILON, mundo.pasoMaximo ?? PASO_MAXIMO);
  const subpasosMaximos = Math.max(
    1,
    Math.floor(mundo.subpasosMaximos ?? SUBPASOS_MAXIMOS),
  );
  const subpasos = Math.min(
    subpasosMaximos,
    Math.max(1, Math.ceil(dt / pasoMaximo)),
  );
  const dtSubpaso = dt / subpasos;
  const colisionadores = mundo.colisionadores ?? [];
  const iteraciones = Math.max(
    1,
    Math.floor(mundo.iteracionesColision ?? ITERACIONES_COLISION),
  );
  const restitucion = mundo.restitucion ?? 0.5;
  const friccion = mundo.friccion ?? 0.98;
  const friccionContacto = mundo.friccionContacto ?? FRICCION_CONTACTO;
  const resistenciaAire = mundo.resistenciaAire ?? RESISTENCIA_AIRE;
  const resistenciaGiro = mundo.resistenciaGiro ?? RESISTENCIA_GIRO;
  const velocidadMaxima = mundo.velocidadMaxima ?? VELOCIDAD_MAXIMA;
  const velocidadGiroMaxima =
    mundo.velocidadGiroMaxima ?? VELOCIDAD_GIRO_MAXIMA;

  for (let subpaso = 0; subpaso < subpasos; subpaso++) {
    for (const cuerpo of cuerpos) {
      integrar(cuerpo, dtSubpaso, mundo.gravedad ?? 0);
      amortiguar(cuerpo, dtSubpaso, resistenciaAire, resistenciaGiro);
    }

    for (let iteracion = 0; iteracion < iteraciones; iteracion++) {
      for (const cuerpo of cuerpos) {
        for (const circulo of colisionadores) {
          rebotarContraCirculo(
            cuerpo,
            circulo,
            restitucion,
            friccionContacto,
          );
        }
      }

      for (let indice = 0; indice < cuerpos.length; indice++) {
        for (let otro = indice + 1; otro < cuerpos.length; otro++) {
          rebotarEntreCuerpos(
            cuerpos[indice],
            cuerpos[otro],
            restitucion,
            friccionContacto,
          );
        }
      }

      for (const cuerpo of cuerpos) {
        limitarACaja(
          cuerpo,
          mundo.caja,
          restitucion,
          friccion,
          dtSubpaso,
          {
            umbralReposo: mundo.umbralReposo ?? UMBRAL_REPOSO,
            acopleRodadura: mundo.acopleRodadura ?? ACOPLE_RODADURA,
          },
        );
      }
    }

    for (const cuerpo of cuerpos) {
      limitarVelocidad(cuerpo, velocidadMaxima, velocidadGiroMaxima);
    }
  }
}

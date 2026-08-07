const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function estadoDeMano(mano, opciones) {
  const aperturaCerrada = opciones.aperturaCerrada ?? opciones.aperturaParaAgarrar;
  const aperturaAbierta = opciones.aperturaAbierta ?? opciones.aperturaParaSoltar;

  if (mano.apertura <= aperturaCerrada) return 'cerrada';
  if (mano.apertura >= aperturaAbierta) return 'abierta';
  return 'intermedia';
}

export function actualizarAgarres(objetos, manos, velocidades, opciones) {
  const porMano = new Map(manos.map((mano) => [mano.lado, mano]));
  const ocupadas = new Set();

  for (const objeto of objetos) {
    const mano = porMano.get(objeto.agarradoPor);
    if (!mano || estadoDeMano(mano, opciones) !== 'cerrada') {
      if (objeto.agarradoPor) soltar(objeto, velocidades.get(objeto.agarradoPor));
      continue;
    }

    ocupadas.add(mano.lado);
    pegarALaMano(objeto, mano, velocidades.get(mano.lado));
  }

  for (const mano of manos) {
    if (ocupadas.has(mano.lado) || estadoDeMano(mano, opciones) !== 'cerrada') continue;

    const alcance = mano.radio * opciones.alcance;
    let elegido = null;
    let mejorDistancia = Infinity;

    for (const objeto of objetos) {
      if (objeto.agarradoPor) continue;
      const d = distancia(mano.palma, objeto.cuerpo);
      if (d > alcance + objeto.cuerpo.radio || d >= mejorDistancia) continue;
      elegido = objeto;
      mejorDistancia = d;
    }

    if (elegido) {
      elegido.agarradoPor = mano.lado;
      pegarALaMano(elegido, mano, velocidades.get(mano.lado));
      ocupadas.add(mano.lado);
    }
  }
}

function pegarALaMano(objeto, mano, velocidad = {}) {
  objeto.cuerpo.fijo = true;
  objeto.cuerpo.x = mano.palma.x;
  objeto.cuerpo.y = mano.palma.y;
  objeto.cuerpo.vx = velocidad.vx ?? 0;
  objeto.cuerpo.vy = velocidad.vy ?? 0;
  objeto.cuerpo.velocidadGiro *= 0.8;
}

function soltar(objeto, velocidad = {}) {
  objeto.agarradoPor = null;
  objeto.cuerpo.fijo = false;
  objeto.cuerpo.vx = velocidad?.vx ?? objeto.cuerpo.vx;
  objeto.cuerpo.vy = velocidad?.vy ?? objeto.cuerpo.vy;
}

import { describe, it, expect } from 'vitest';
import {
  FAMILIA_TEXTO,
  FAMILIA_TITULO,
  PESO_TITULO,
  TITULO_SOLO,
  calcularDisposicion,
  calcularRecorteVisible,
  calcularRectanguloVideo,
  dibujarAnilloDeProgreso,
  dibujarConsigna,
  dibujarDiscoDeCarga,
  dibujarFicha,
  dibujarFondo,
  dibujarHumo,
  dibujarInvitacion,
  dibujarManos,
  dibujarNombreDeCarrera,
  dibujarObjeto,
  dibujarObjetoApoyado,
  dibujarObjetosDelante,
  dibujarPersonaRecortada,
  disponerFicha,
  medidasDe,
  partirEnLineas,
  tamanoQueEntra,
} from '../../espejo/escena.js';

// La letra de las fichas en estas pruebas. En el espejo sale de
// CONFIG.fichas.tipografia, y disponerFicha no la inventa si falta.
const TIPOGRAFIA_DE_FICHA = { texto: 1, titulo: 1.5 };

// Lienzo falso: registra las llamadas para poder afirmar sobre lo dibujado.
function crearCtxFalso() {
  const llamadas = [];
  // Un degradado es un objeto nuevo en cada llamada: se anota por su tipo, no
  // por su identidad, para que dos dibujos iguales sigan comparando iguales.
  const estilo = (valor) => (typeof valor === 'string' ? valor : 'degradado');
  const ctx = {
    llamadas,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    font: '',
    textAlign: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: '',
    shadowBlur: 0,
    filter: '',
    save: () => llamadas.push(['save']),
    restore: () => llamadas.push(['restore']),
    beginPath: () => llamadas.push(['beginPath']),
    closePath: () => llamadas.push(['closePath']),
    moveTo: (x, y) => llamadas.push(['moveTo', x, y]),
    lineTo: (x, y) => llamadas.push(['lineTo', x, y]),
    arc: (x, y, radio, desde, hasta) => llamadas.push(['arc', x, y, radio, desde, hasta]),
    ellipse: (...args) => llamadas.push(['ellipse', ...args]),
    rect: (...args) => llamadas.push(['rect', ...args]),
    fillRect: (...args) => llamadas.push(['fillRect', ...args]),
    // Los usan las figuras vectoriales, que son el respaldo cuando falta el PNG.
    strokeRect: (...args) => llamadas.push(['strokeRect', ...args]),
    strokeText: (...args) => llamadas.push(['strokeText', ...args]),
    quadraticCurveTo: (...args) => llamadas.push(['quadraticCurveTo', ...args]),
    clearRect: (...args) => llamadas.push(['clearRect', ...args]),
    // Trazo y relleno anotan con que color, que opacidad y que resplandor se
    // dibujaron: el color unico de la carga y su transparencia son lo que se
    // prueba.
    stroke: () =>
      llamadas.push(['stroke', estilo(ctx.strokeStyle), ctx.globalAlpha, ctx.shadowBlur]),
    fill: () => llamadas.push(['fill', estilo(ctx.fillStyle), ctx.globalAlpha]),
    roundRect: (...args) => llamadas.push(['roundRect', ...args]),
    arcTo: (...args) => llamadas.push(['arcTo', ...args]),
    clip: (...args) => llamadas.push(['clip', ...args]),
    translate: (x, y) => llamadas.push(['translate', x, y]),
    scale: (x, y) => llamadas.push(['scale', x, y]),
    rotate: (a) => llamadas.push(['rotate', a]),
    fillText: (texto, x, y) => llamadas.push(['fillText', texto, x, y, ctx.globalAlpha]),
    measureText: (texto) => ({ width: texto.length * 10 }),
    drawImage: (...args) => llamadas.push(['drawImage', ...args]),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  return ctx;
}

const soloDe = (ctx, nombre) => ctx.llamadas.filter(([que]) => que === nombre);

const bancoCon = (mapa = {}) => ({ obtener: (ruta) => mapa[ruta] ?? null });
const imagen = (ancho = 100, alto = 100) => ({ width: ancho, height: alto });
// Un <video>: sus medidas NO estan en width/height, que valen 0 hasta el primer
// cuadro. Es la trampa que medidasDe existe para tapar.
const videoDe = (ancho = 1080, alto = 1920) => ({
  width: 0,
  height: 0,
  videoWidth: ancho,
  videoHeight: alto,
});

describe('dibujarObjeto', () => {
  const definicion = { img: 'assets/civil/grua.png', figura: 'grua', escala: 0.2 };

  it('dibuja el PNG cuando esta en el banco', () => {
    const ctx = crearCtxFalso();
    dibujarObjeto(
      ctx,
      { definicion, x: 300, y: 400, radio: 60 },
      bancoCon({ 'assets/civil/grua.png': imagen() }),
      '#FF8A3D',
    );
    expect(soloDe(ctx, 'drawImage')).toHaveLength(1);
    expect(soloDe(ctx, 'translate')[0]).toEqual(['translate', 300, 400]);
  });

  // Un objeto que no se dibuja es una opcion que no se puede elegir: la persona
  // ve un hueco en el arco y no entiende por que ahi no pasa nada.
  it('sin PNG cae a la figura o al circulo del color, pero dibuja algo', () => {
    const ctx = crearCtxFalso();
    dibujarObjeto(ctx, { definicion, x: 300, y: 400, radio: 60 }, bancoCon(), '#FF8A3D');
    expect(ctx.llamadas.length).toBeGreaterThan(2);
    expect(soloDe(ctx, 'drawImage')).toHaveLength(0);
  });

  it('no dibuja nada invisible ni sin definicion', () => {
    for (const caso of [
      { definicion, x: 0, y: 0, radio: 60, alfa: 0 },
      { definicion, x: 0, y: 0, radio: 0 },
      { definicion: null, x: 0, y: 0, radio: 60 },
    ]) {
      const ctx = crearCtxFalso();
      dibujarObjeto(ctx, caso, bancoCon({ 'assets/civil/grua.png': imagen() }), '#fff');
      expect(ctx.llamadas).toEqual([]);
    }
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarObjeto(ctx, { definicion, x: 1, y: 1, radio: 10 }, bancoCon(), '#fff');
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

describe('dibujarAnilloDeProgreso', () => {
  const base = { x: 300, y: 400, radio: 60, color: '#00E5A0' };

  it('sin progreso no dibuja nada', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, progreso: 0 });
    expect(ctx.llamadas).toEqual([]);
  });

  // Es la unica señal de que el sostenido esta pasando. Si el arco no creciera
  // con el progreso, la persona no sabria si le falta mucho o nada.
  it('el arco crece con el progreso', () => {
    const barrido = (progreso) => {
      const ctx = crearCtxFalso();
      dibujarAnilloDeProgreso(ctx, { ...base, progreso });
      const [, , , , desde, hasta] = soloDe(ctx, 'arc').at(-1);
      return hasta - desde;
    };

    expect(barrido(0.25)).toBeGreaterThan(0);
    expect(barrido(0.5)).toBeGreaterThan(barrido(0.25));
    expect(barrido(1)).toBeCloseTo(Math.PI * 2);
  });

  it('un progreso pasado de rosca no da mas de una vuelta', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, progreso: 3 });
    const [, , , , desde, hasta] = soloDe(ctx, 'arc').at(-1);
    expect(hasta - desde).toBeCloseTo(Math.PI * 2);
  });

  // Arranca arriba y gira como un reloj: cualquiera entiende un reloj sin que
  // nadie se lo explique.
  it('arranca arriba del objeto', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, progreso: 0.5 });
    const [, , , , desde] = soloDe(ctx, 'arc').at(-1);
    expect(desde).toBeCloseTo(-Math.PI / 2);
  });

  it('el anillo rodea al objeto sin taparlo', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, progreso: 0.5 });
    for (const [, x, y, radio] of soloDe(ctx, 'arc')) {
      expect(x).toBe(base.x);
      expect(y).toBe(base.y);
      expect(radio).toBeGreaterThan(base.radio);
    }
  });

  // Un solo color de carga para las doce, con la transparencia que se le pida:
  // la pista de atras tenue y el trazo que avanza, mas firme.
  it('dibuja con el color y las opacidades que se le piden', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, color: '#f0dca0', progreso: 0.5, pista: 0.2, trazo: 0.8 });
    const trazos = soloDe(ctx, 'stroke');
    expect(trazos.map(([, color]) => color)).toEqual(['#f0dca0', '#f0dca0']);
    expect(trazos[0][2]).toBeCloseTo(0.2);
    expect(trazos[1][2]).toBeCloseTo(0.8);
  });

  // EL ANILLO SE APAGA CON QUIEN LO DIBUJA. La opacidad del carrusel que se
  // desvanece multiplica la del anillo. Si la pisara, el anillo del objeto
  // elegido se quedaba entero mientras el carrusel se apagaba y desaparecia de
  // golpe al final: un parpadeo en el momento mas mirado de la experiencia.
  it('su opacidad se multiplica por la de quien lo dibuja', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, progreso: 1, pista: 0.2, trazo: 0.8, alfa: 0.5 });
    const [pista, trazo] = soloDe(ctx, 'stroke');
    expect(pista[2]).toBeCloseTo(0.1);
    expect(trazo[2]).toBeCloseTo(0.4);
  });

  it('sin brillo no hay resplandor', () => {
    const ctx = crearCtxFalso();
    dibujarAnilloDeProgreso(ctx, { ...base, progreso: 0.5, brillo: 0 });
    expect(soloDe(ctx, 'stroke').map(([, , , desenfoque]) => desenfoque)).toEqual([0, 0]);
  });
});

describe('dibujarDiscoDeCarga', () => {
  const base = { x: 300, y: 400, radio: 60, color: '#f0dca0', opacidad: 0.3, radioFactor: 1.12 };

  it('sin progreso, sin opacidad o invisible no dibuja nada', () => {
    for (const caso of [{ progreso: 0 }, { progreso: 0.5, opacidad: 0 }, { progreso: 0.5, alfa: 0 }]) {
      const ctx = crearCtxFalso();
      dibujarDiscoDeCarga(ctx, { ...base, ...caso });
      expect(ctx.llamadas).toEqual([]);
    }
  });

  // Es un reloj que se llena detras del objeto: arranca arriba y barre en el
  // sentido de las agujas, igual que el anillo, y un poco mas grande que el
  // objeto para que se vea alrededor.
  it('es un sector que arranca arriba y crece con el progreso', () => {
    const barrido = (progreso) => {
      const ctx = crearCtxFalso();
      dibujarDiscoDeCarga(ctx, { ...base, progreso });
      const [, x, y, radio, desde, hasta] = soloDe(ctx, 'arc')[0];
      expect([x, y]).toEqual([300, 400]);
      expect(radio).toBeGreaterThan(60);
      expect(desde).toBeCloseTo(-Math.PI / 2);
      return hasta - desde;
    };
    expect(barrido(0.25)).toBeCloseTo(Math.PI / 2);
    expect(barrido(1)).toBeCloseTo(Math.PI * 2);
  });

  it('mide lo que se le pide, en radios del objeto', () => {
    const ctx = crearCtxFalso();
    dibujarDiscoDeCarga(ctx, { ...base, progreso: 0.5, radioFactor: 1.3 });
    const [, , , radio] = soloDe(ctx, 'arc')[0];
    expect(radio).toBeCloseTo(78);
  });

  it('se rellena con el color pedido y su transparencia', () => {
    const ctx = crearCtxFalso();
    dibujarDiscoDeCarga(ctx, { ...base, progreso: 0.5, alfa: 0.5 });
    const [[, color, opacidad]] = soloDe(ctx, 'fill');
    expect(color).toBe('#f0dca0');
    expect(opacidad).toBeCloseTo(0.15);
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarDiscoDeCarga(ctx, { ...base, progreso: 0.5 });
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

describe('dibujarManos', () => {
  const mano = { palma: { x: 300, y: 400 }, radio: 100 };

  it('todo lo que dibuja esta centrado en la palma', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [mano], '#ffffff', { resplandorFactor: 2.2, nucleoFactor: 0.22 });

    const arcos = soloDe(ctx, 'arc');
    expect(arcos.length).toBeGreaterThan(0);
    expect(arcos.every(([, x, y]) => x === mano.palma.x && y === mano.palma.y)).toBe(true);
  });

  // Antes se dibujaban la palma, los dedos y los nudillos: eso pintaba un
  // segundo par de manos encima de las que ya se ven en el espejo.
  it('no depende de los 21 puntos de la mano', () => {
    const puntos = Array.from({ length: 21 }, (_, i) => ({ x: 100 + i * 5, y: 200 + i * 5 }));
    const simple = crearCtxFalso();
    const conPuntos = crearCtxFalso();

    dibujarManos(simple, [mano], '#ffffff');
    dibujarManos(conPuntos, [{ ...mano, puntos, largoPalma: 60 }], '#ffffff');
    expect(conPuntos.llamadas).toEqual(simple.llamadas);
  });

  it('no toca el lienzo sin manos', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [], '#ffffff');
    dibujarManos(ctx, null, '#ffffff');
    expect(ctx.llamadas).toEqual([]);
  });

  // La señal no aparece ni desaparece de golpe: cada mano trae su alfa —el de
  // su desvanecedor— y quien dibuja pone el suyo, y los dos multiplican. Una
  // señal que se prende y se apaga con cada deteccion perdida es un parpadeo.
  it('se enciende con su alfa y con el de cada mano', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [{ ...mano, alfa: 0.5 }], '#ffffff', {}, 0.5);
    const opacidades = soloDe(ctx, 'fill').map(([, , opacidad]) => opacidad);
    expect(opacidades).toHaveLength(2);
    expect(opacidades[0]).toBeCloseTo(0.35 * 0.25);
    expect(opacidades[1]).toBeCloseTo(0.85 * 0.25);
  });

  it('no dibuja una mano apagada ni una señal sin alfa', () => {
    const apagada = crearCtxFalso();
    dibujarManos(apagada, [{ ...mano, alfa: 0 }], '#ffffff');
    expect(soloDe(apagada, 'fill')).toEqual([]);

    const sinAlfa = crearCtxFalso();
    dibujarManos(sinAlfa, [mano], '#ffffff', {}, 0);
    expect(sinAlfa.llamadas).toEqual([]);
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [mano, { palma: { x: 700, y: 200 }, radio: 80 }], '#ffffff');
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

describe('dibujarFondo', () => {
  const disposicion = calcularDisposicion(1080, 1920);

  it('no dibuja nada sin imagen o sin alfa', () => {
    const ctx = crearCtxFalso();
    expect(dibujarFondo(ctx, null, disposicion, 1)).toBeNull();
    expect(dibujarFondo(ctx, imagen(), disposicion, 0)).toBeNull();
    expect(ctx.llamadas).toEqual([]);
  });

  // El objeto agarrado se apoya normalizado a ESTE rectangulo. Devolverlo es lo
  // que evita que el llamador lo calcule por su cuenta y los dos se separen.
  it('devuelve el rectangulo que uso, el mismo con el que dibujo', () => {
    const ctx = crearCtxFalso();
    const rectangulo = dibujarFondo(ctx, imagen(1920, 1080), disposicion, 1);

    const [, , x, y, ancho, alto] = soloDe(ctx, 'drawImage')[0];
    expect(rectangulo).toEqual({ x, y, ancho, alto });
  });

  // El fondo se dibuja cubriendo, no estirado: una foto apaisada deformada para
  // entrar en una pantalla vertical se nota de lejos.
  it('cubre la pantalla conservando la relacion de la imagen', () => {
    const ctx = crearCtxFalso();
    expect(dibujarFondo(ctx, imagen(1920, 1080), disposicion, 1)).not.toBeNull();

    const [, , x, y, ancho, alto] = soloDe(ctx, 'drawImage')[0];
    expect(ancho / alto).toBeCloseTo(1920 / 1080, 3);
    expect(x).toBeLessThanOrEqual(0.001);
    expect(y).toBeLessThanOrEqual(0.001);
    expect(x + ancho).toBeGreaterThanOrEqual(1080 - 0.001);
    expect(y + alto).toBeGreaterThanOrEqual(1920 - 0.001);
  });

  // Un fondo con movimiento se dibuja igual que una foto. Si midiera por
  // `width` —que en un video es 0— el rectangulo saldria del tamaño de la
  // pantalla y el fondo quedaria estirado.
  it('un video se dibuja igual que una foto, por sus medidas de video', () => {
    const ctx = crearCtxFalso();
    expect(dibujarFondo(ctx, videoDe(1920, 1080), disposicion, 1)).not.toBeNull();

    const [, , , , ancho, alto] = soloDe(ctx, 'drawImage')[0];
    expect(ancho / alto).toBeCloseTo(1920 / 1080, 3);
  });

  // Sin cuadro decodificado, drawImage no dibuja nada y no avisa: el fondo
  // quedaria vacio. Diciendo que no, el que llama cae a la foto.
  it('no dibuja un video que todavia no tiene medidas', () => {
    const ctx = crearCtxFalso();
    expect(dibujarFondo(ctx, videoDe(0, 0), disposicion, 1)).toBeNull();
    expect(ctx.llamadas).toEqual([]);
  });
});

describe('medidasDe', () => {
  it('mide una foto por width y height', () => {
    expect(medidasDe(imagen(800, 600))).toEqual({ ancho: 800, alto: 600 });
  });

  it('mide un video por videoWidth y videoHeight', () => {
    expect(medidasDe(videoDe(1080, 1920))).toEqual({ ancho: 1080, alto: 1920 });
  });

  it('devuelve null cuando no hay nada que medir', () => {
    expect(medidasDe(null)).toBeNull();
    expect(medidasDe(videoDe(0, 0))).toBeNull();
    expect(medidasDe(imagen(0, 0))).toBeNull();
  });
});

describe('dibujarPersonaRecortada', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const capa = () => {
    const ctx = crearCtxFalso();
    return { canvas: { es: 'capa' }, ctx };
  };
  const rectangulo = { x: -300, y: 0, ancho: 1680, alto: 1920 };

  // Sin silueta, dibujar solo el fondo dejaria a la persona afuera de su propia
  // escena. El llamador tiene que enterarse para caer al fondo tenue.
  it('avisa que no pudo cuando falta la silueta, el video o la capa', () => {
    expect(
      dibujarPersonaRecortada(crearCtxFalso(), {
        capa: capa(),
        video: {},
        silueta: null,
        rectangulo,
        disposicion,
      }),
    ).toBe(false);

    expect(
      dibujarPersonaRecortada(crearCtxFalso(), {
        capa: capa(),
        video: null,
        silueta: {},
        rectangulo,
        disposicion,
      }),
    ).toBe(false);

    expect(
      dibujarPersonaRecortada(crearCtxFalso(), {
        capa: null,
        video: {},
        silueta: {},
        rectangulo,
        disposicion,
      }),
    ).toBe(false);
  });

  it('recorta el video contra la silueta y lo pega en el lienzo', () => {
    const ctx = crearCtxFalso();
    const lienzoAparte = capa();

    expect(
      dibujarPersonaRecortada(ctx, {
        capa: lienzoAparte,
        video: { es: 'video' },
        silueta: { es: 'silueta' },
        rectangulo,
        disposicion,
      }),
    ).toBe(true);

    // La capa se limpia, se dibuja el video y se recorta con destination-in.
    expect(soloDe(lienzoAparte.ctx, 'clearRect')).toHaveLength(1);
    const dibujados = soloDe(lienzoAparte.ctx, 'drawImage').map(([, fuente]) => fuente.es);
    expect(dibujados).toEqual(['video', 'silueta']);

    // Y recien ahi la capa entera va al lienzo principal, encima del fondo.
    expect(soloDe(ctx, 'drawImage')[0][1]).toEqual({ es: 'capa' });
  });

  // La silueta viene del lienzo de analisis, que NO esta espejado. Sin espejarla
  // el recorte cae del lado contrario y la persona desaparece.
  it('espeja la silueta igual que el video', () => {
    const lienzoAparte = capa();
    dibujarPersonaRecortada(crearCtxFalso(), {
      capa: lienzoAparte,
      video: { es: 'video' },
      silueta: { es: 'silueta' },
      rectangulo,
      disposicion,
    });
    expect(soloDe(lienzoAparte.ctx, 'scale').filter(([, x]) => x === -1)).toHaveLength(2);
  });
});

describe('dibujarObjetosDelante', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const imagen = { width: 100, height: 100 };
  const banco = { obtener: () => imagen };
  const persona = { canvas: { es: 'persona' } };
  const leido = { definicion: { img: 'probeta.png' }, x: 900, y: 600, radio: 60, giro: 0, alfa: 0.8 };
  // Una capa que anota tambien con que composicion se dibuja: el recorte contra
  // la persona es un destination-in.
  const capaQueAnota = () => {
    const ctx = crearCtxFalso();
    let compuesto = 'source-over';
    Object.defineProperty(ctx, 'globalCompositeOperation', {
      get: () => compuesto,
      set: (valor) => {
        compuesto = valor;
        ctx.llamadas.push(['compuesto', valor]);
      },
    });
    return { canvas: { es: 'capa' }, ctx };
  };

  it('sin nada que mostrar no dibuja nada', () => {
    const ctx = crearCtxFalso();
    const capa = capaQueAnota();
    dibujarObjetosDelante(ctx, { capa, persona, disposicion, objetos: [], banco, color: '#f0dca0' });
    expect(ctx.llamadas).toEqual([]);
    expect(capa.ctx.llamadas).toEqual([]);
  });

  // DONDE NADA LO TAPA NO CAMBIA NADA. Dibujado entero encima de si mismo, el
  // objeto duplicaba su sombra y engrosaba los bordes del PNG justo cuando se
  // lo estaba leyendo. Recortado contra la persona, aparece solo donde la mano
  // lo tapaba.
  it('dibuja los objetos en su capa, los recorta contra la persona y recien ahi los pega', () => {
    const ctx = crearCtxFalso();
    const capa = capaQueAnota();
    dibujarObjetosDelante(ctx, { capa, persona, disposicion, objetos: [leido], banco, color: '#f0dca0' });

    const pasos = capa.ctx.llamadas
      .filter(([que]) => que === 'clearRect' || que === 'drawImage' || que === 'compuesto')
      .map(([que, primero]) => (que === 'clearRect' ? 'limpia' : primero));
    expect(pasos).toEqual(['limpia', imagen, 'destination-in', persona.canvas]);
    expect(soloDe(ctx, 'drawImage').map(([, fuente]) => fuente)).toEqual([capa.canvas]);
  });
});

describe('dibujarHumo', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const video = { videoWidth: 1280, videoHeight: 720 };

  it('no dibuja nada sin video, sin alfa o sin tamaño', () => {
    for (const [v, alfa] of [
      [null, 1],
      [video, 0],
      [{ videoWidth: 0, videoHeight: 0 }, 1],
    ]) {
      const ctx = crearCtxFalso();
      dibujarHumo(ctx, v, disposicion, alfa);
      expect(ctx.llamadas).toEqual([]);
    }
  });

  // El video es blanco sobre negro y no tiene canal alfa: en `screen` el negro
  // desaparece solo. En cualquier otro modo taparia la pantalla con un
  // rectangulo gris.
  it('lo compone en screen para que el negro desaparezca', () => {
    const ctx = crearCtxFalso();
    dibujarHumo(ctx, video, disposicion, 1, 0.95);
    expect(ctx.globalCompositeOperation).toBe('screen');
    expect(soloDe(ctx, 'drawImage')).toHaveLength(1);
  });
});

describe('dibujarNombreDeCarrera', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const carrera = { nombre: 'Ingeniería Civil', color: '#FF8A3D' };

  it('escribe el nombre de la ingenieria al pie', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);

    const textos = soloDe(ctx, 'fillText');
    expect(textos.map(([, texto]) => texto).join(' ')).toBe('Ingeniería Civil');
    for (const [, , , y] of textos) {
      expect(y).toBeGreaterThan(1920 - disposicion.pie.alto);
      expect(y).toBeLessThanOrEqual(disposicion.pie.base);
    }
  });

  // "Ingenieria en Sistemas de Comunicacion" no entra en un renglon a tamaño
  // de titulo: se parte en dos antes que achicarse hasta lo ilegible.
  it('un nombre largo va en dos lineas, y la ultima queda en la base', () => {
    const ctx = crearCtxFalso();
    // Medida que escala con la letra, como la de verdad: a tamaño de pie el
    // nombre no entra en el ancho disponible.
    ctx.measureText = (texto) => ({
      width: texto.length * Number(ctx.font.match(/([\d.]+)px/)[1]) * 0.5,
    });
    dibujarNombreDeCarrera(
      ctx,
      { nombre: 'Ingeniería en Sistemas de Comunicación', color: '#E040FB' },
      disposicion,
      1,
    );

    const textos = soloDe(ctx, 'fillText');
    expect(textos).toHaveLength(2);
    expect(textos.map(([, texto]) => texto).join(' ')).toBe(
      'Ingeniería en Sistemas de Comunicación',
    );
    expect(textos[1][3]).toBeCloseTo(disposicion.pie.base);
    expect(textos[0][3]).toBeLessThan(textos[1][3]);
  });

  // El texto blanco o de color sobre un fondo con una zona clara es ilegible.
  // El degradado de abajo es lo unico que lo sostiene.
  it('pone el degradado que despega el nombre del fondo', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(soloDe(ctx, 'fillRect')).toHaveLength(1);
  });

  // La catedra pidio no distinguir las ingenierias por color: el nombre va en
  // el que se le pide —el de los nombres en las tablets de MAITE—, nunca en el
  // de la carrera.
  it('usa el color que se le pide, no el de la carrera', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1, '#f0dca0');
    expect(ctx.fillStyle).toBe('#f0dca0');
  });

  it('no dibuja nada sin carrera o sin alfa', () => {
    for (const [c, alfa] of [
      [carrera, 0],
      [null, 1],
    ]) {
      const ctx = crearCtxFalso();
      dibujarNombreDeCarrera(ctx, c, disposicion, alfa);
      expect(ctx.llamadas).toEqual([]);
    }
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

describe('dibujarObjetoApoyado', () => {
  const definicion = { img: 'assets/civil/grua.png', figura: 'grua', escala: 0.2 };
  const apoyado = { definicion, x: 240, y: 580, radio: 70, alfa: 1, giro: 0.02, halo: 0.35 };

  // El halo presenta el objeto sobre cualquier fondo, foto o escena vectorial,
  // sin pedirle a cada imagen que tenga una mesa justo ahi. Va debajo.
  it('dibuja el halo antes que el objeto', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, apoyado, bancoCon({ 'assets/civil/grua.png': imagen() }), '#FF8A3D');

    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('fill')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('fill')).toBeLessThan(orden.indexOf('drawImage'));
  });

  it('inclina el objeto con el giro pedido', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, apoyado, bancoCon({ 'assets/civil/grua.png': imagen() }), '#FF8A3D');
    expect(soloDe(ctx, 'rotate')).toEqual([['rotate', 0.02]]);
  });

  it('sin halo dibuja solo el objeto', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(
      ctx,
      { ...apoyado, halo: 0 },
      bancoCon({ 'assets/civil/grua.png': imagen() }),
      '#FF8A3D',
    );
    expect(soloDe(ctx, 'fill')).toHaveLength(0);
    expect(soloDe(ctx, 'drawImage')).toHaveLength(1);
  });

  it('no dibuja nada invisible', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, { ...apoyado, alfa: 0 }, bancoCon(), '#FF8A3D');
    expect(ctx.llamadas).toEqual([]);
  });
});

describe('partirEnLineas', () => {
  // Medida falsa: cada caracter mide 10.
  const medir = (texto) => texto.length * 10;

  it('deja el texto en una linea si ya entra', () => {
    expect(partirEnLineas('hola mundo', 1000, medir)).toEqual(['hola mundo']);
  });

  // El texto de cada persona son dos o tres renglones: sin cortarlo se sale de
  // la pantalla por los dos lados.
  it('corta por palabras hasta que cada linea entre', () => {
    const lineas = partirEnLineas('uno dos tres cuatro cinco', 100, medir);
    expect(lineas.length).toBeGreaterThan(1);
    for (const linea of lineas) expect(medir(linea)).toBeLessThanOrEqual(100);
    expect(lineas.join(' ')).toBe('uno dos tres cuatro cinco');
  });

  // Cortarla por la mitad se lee peor que dejarla sobresalir, y para eso esta
  // tamanoQueEntra.
  it('una palabra sola mas ancha que el renglon se deja igual', () => {
    expect(partirEnLineas('supercalifragilistico', 50, medir)).toEqual(['supercalifragilistico']);
  });

  it('no devuelve lineas vacias', () => {
    expect(partirEnLineas('', 100, medir)).toEqual([]);
    expect(partirEnLineas('   ', 100, medir)).toEqual([]);
    expect(partirEnLineas(null, 100, medir)).toEqual([]);
    expect(partirEnLineas('  hola   mundo  ', 1000, medir)).toEqual(['hola mundo']);
  });
});

describe('tamanoQueEntra', () => {
  // Medida falsa: cada caracter ocupa la mitad del tamaño de letra.
  const medir = (texto, tamano) => texto.length * tamano * 0.5;

  it('deja el tamaño pedido si el texto ya entra', () => {
    expect(tamanoQueEntra('corto', 40, 1000, medir)).toBe(40);
  });

  it('achica lo justo para que entre', () => {
    const frase = 'Procesos de transformación de la materia y la energía';
    const elegido = tamanoQueEntra(frase, 60, 500, medir);

    expect(elegido).toBeLessThan(60);
    expect(medir(frase, elegido)).toBeLessThanOrEqual(500);
  });

  it('nunca baja de un tamaño legible', () => {
    const kilometrico = 'x'.repeat(2000);
    expect(tamanoQueEntra(kilometrico, 60, 100, medir)).toBeGreaterThanOrEqual(8);
  });

  it('no divide por cero con un texto vacio', () => {
    expect(tamanoQueEntra('', 40, 500, () => 0)).toBe(40);
  });
});

describe('calcularDisposicion', () => {
  it('reconoce una pantalla vertical', () => {
    expect(calcularDisposicion(1080, 1920).vertical).toBe(true);
  });

  it('reconoce una pantalla apaisada', () => {
    expect(calcularDisposicion(1920, 1080).vertical).toBe(false);
  });

  // El nombre de la ingenieria va donde iba el de la persona: al pie, que es
  // el mismo lugar donde las tablets de MAITE ponen su texto. No puede quedar
  // al medio, que es donde esta la cara.
  it('el pie queda abajo, dentro de la pantalla y con margen a los costados', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
    ]) {
      const d = calcularDisposicion(ancho, alto);
      expect(d.pie.base).toBeGreaterThan(alto * 0.6);
      expect(d.pie.base).toBeLessThan(alto);
      expect(d.pie.base).toBeGreaterThan(alto - d.pie.alto);
      expect(d.pie.margen).toBeGreaterThan(0);
      expect(d.pie.margen * 2).toBeLessThan(ancho);
    }
  });

  it('escala la tipografia con el lado corto de la pantalla', () => {
    const chica = calcularDisposicion(540, 960);
    const grande = calcularDisposicion(1080, 1920);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(chica.texto.tamanoNombre * 1.9);
    expect(grande.texto.tamanoNombre).toBeLessThan(chica.texto.tamanoNombre * 2.1);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(grande.texto.tamanoFrase);
    // El nombre al pie es lo mas grande de la pantalla: mas que la consigna.
    expect(grande.pie.tamano).toBeGreaterThan(chica.pie.tamano * 1.9);
    expect(grande.pie.tamano).toBeGreaterThan(grande.texto.tamanoFrase);
  });

  it('da una unidad de referencia positiva en cualquier pantalla', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
    ]) {
      expect(calcularDisposicion(ancho, alto).unidad).toBeGreaterThan(0);
    }
  });
});

describe('calcularRectanguloVideo', () => {
  // Este rectangulo lo usan DOS cosas: donde se dibuja el video y donde se
  // mapean los puntos del rostro. Si se separan, los puntos se van de la cara.
  const casos = [
    ['camara apaisada en pantalla vertical', 1280, 720, 1080, 1920],
    ['camara apaisada en pantalla apaisada', 1280, 720, 1920, 1080],
    ['misma relacion exacta', 1280, 720, 2560, 1440],
    ['pantalla cuadrada', 1280, 720, 1000, 1000],
    ['camara vertical en pantalla apaisada', 720, 1280, 1920, 1080],
  ];

  it.each(casos)('cubre toda la pantalla: %s', (_, vAncho, vAlto, ancho, alto) => {
    const r = calcularRectanguloVideo(vAncho, vAlto, ancho, alto);

    expect(r.x).toBeLessThanOrEqual(0.001);
    expect(r.y).toBeLessThanOrEqual(0.001);
    expect(r.x + r.ancho).toBeGreaterThanOrEqual(ancho - 0.001);
    expect(r.y + r.alto).toBeGreaterThanOrEqual(alto - 0.001);
  });

  it.each(casos)('conserva la relacion de aspecto del video: %s', (_, vAncho, vAlto, ancho, alto) => {
    const r = calcularRectanguloVideo(vAncho, vAlto, ancho, alto);
    expect(r.ancho / r.alto).toBeCloseTo(vAncho / vAlto, 3);
  });

  it.each(casos)('queda centrado: %s', (_, vAncho, vAlto, ancho, alto) => {
    const r = calcularRectanguloVideo(vAncho, vAlto, ancho, alto);
    expect(r.x + r.ancho / 2).toBeCloseTo(ancho / 2);
    expect(r.y + r.alto / 2).toBeCloseTo(alto / 2);
  });

  it('con la misma relacion llena la pantalla sin recortar nada', () => {
    const r = calcularRectanguloVideo(1280, 720, 2560, 1440);
    expect(r).toEqual({ x: 0, y: 0, ancho: 2560, alto: 1440 });
  });

  it('recorta a los costados cuando la camara es mas ancha que la pantalla', () => {
    const r = calcularRectanguloVideo(1280, 720, 1080, 1920);
    expect(r.alto).toBeCloseTo(1920);
    expect(r.ancho).toBeGreaterThan(1080);
    expect(r.x).toBeLessThan(0);
  });

  it('cae a llenar la pantalla si el video todavia no reporta tamaño', () => {
    expect(calcularRectanguloVideo(0, 0, 1080, 1920)).toEqual({
      x: 0,
      y: 0,
      ancho: 1080,
      alto: 1920,
    });
  });
});

describe('calcularRecorteVisible', () => {
  const casos = [
    ['camara apaisada en pantalla vertical', 1280, 720, 1080, 1920],
    ['camara apaisada en pantalla apaisada', 1280, 720, 1920, 1080],
    ['misma relacion exacta', 1280, 720, 2560, 1440],
    ['pantalla cuadrada', 1280, 720, 1000, 1000],
    ['camara vertical en pantalla apaisada', 720, 1280, 1920, 1080],
    ['camara 1080p en pantalla vertical', 1920, 1080, 1080, 1920],
  ];

  const recorteDe = (vAncho, vAlto, ancho, alto) =>
    calcularRecorteVisible(
      vAncho,
      vAlto,
      calcularRectanguloVideo(vAncho, vAlto, ancho, alto),
      ancho,
      alto,
    );

  // ESTA es la prueba que importa. Analizar un recorte y mapear los puntos sobre
  // la pantalla entera tiene que dar exactamente el mismo pixel que analizar el
  // cuadro completo y mapearlo sobre el rectangulo dibujado. Si los dos caminos
  // se separan, los puntos se van de la cara — ya nos paso una vez.
  it.each(casos)('el recorte es el inverso exacto del rectangulo dibujado: %s', (_, vA, vB, ancho, alto) => {
    const rectangulo = calcularRectanguloVideo(vA, vB, ancho, alto);
    const r = recorteDe(vA, vB, ancho, alto);

    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      for (const v of [0, 0.5, 1]) {
        // Un punto (u, v) normalizado DENTRO del recorte, pasado a normalizado
        // del cuadro completo.
        const uCompleto = (r.sx + u * r.sAncho) / vA;
        const vCompleto = (r.sy + v * r.sAlto) / vB;

        // Camino viejo: analizar el cuadro entero y mapear sobre el rectangulo
        // dibujado. Camino nuevo: analizar el recorte y mapear sobre la pantalla
        // entera, o sea (u * ancho, v * alto). Tienen que dar el mismo pixel.
        expect(rectangulo.x + uCompleto * rectangulo.ancho).toBeCloseTo(u * ancho, 6);
        expect(rectangulo.y + vCompleto * rectangulo.alto).toBeCloseTo(v * alto, 6);
      }
    }
  });

  it.each(casos)('nunca se sale del cuadro de la camara: %s', (_, vA, vB, ancho, alto) => {
    const r = recorteDe(vA, vB, ancho, alto);

    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sAncho).toBeGreaterThan(0);
    expect(r.sAlto).toBeGreaterThan(0);
    expect(r.sx + r.sAncho).toBeLessThanOrEqual(vA + 0.001);
    expect(r.sy + r.sAlto).toBeLessThanOrEqual(vB + 0.001);
  });

  // El motivo de existir de todo esto: con una camara apaisada en una pantalla
  // vertical, dos tercios del ancho de la camara no se ven nunca. Analizarlos
  // gasta la resolucion del modelo en pixeles que nadie mira, y es lo que decide
  // si una cara lejana se encuentra.
  it('descarta lo que la pantalla vertical nunca muestra', () => {
    const r = recorteDe(1280, 720, 1080, 1920);

    expect(r.sAlto).toBeCloseTo(720);
    expect(r.sAncho).toBeCloseTo(405, 0);
    expect(r.sx).toBeCloseTo(437.5, 0);
    // La cara pasa de ocupar un tercio del ancho analizado a ocuparlo entero.
    expect(1280 / r.sAncho).toBeGreaterThan(3);
  });

  it('con la misma relacion no recorta nada', () => {
    const r = recorteDe(1280, 720, 2560, 1440);
    expect(r).toEqual({ sx: 0, sy: 0, sAncho: 1280, sAlto: 720 });
  });

  it('sobrevive a un video que todavia no reporta tamaño', () => {
    const r = calcularRecorteVisible(0, 0, { x: 0, y: 0, ancho: 1080, alto: 1920 }, 1080, 1920);
    expect(r).toBeNull();
  });
});

// La division entre las dos tipografias es la MISMA que hacen las tablets de
// MAITE: espejo y retratos estan a dos metros uno del otro en el stand. Si
// alguien "unifica" las fuentes sin saberlo, las dos piezas dejan de leerse como
// una sola instalacion y no lo va a ver hasta tener el stand montado.
describe('las dos tipografias', () => {
  const fuentesDe = (ctx) => ctx.llamadas.filter(([q]) => q === 'font').map(([, v]) => v);

  /** Un ctx que ademas anota cada asignacion de `font`. */
  function ctxQueAnotaFuentes() {
    const ctx = crearCtxFalso();
    let actual = '';
    Object.defineProperty(ctx, 'font', {
      get: () => actual,
      set: (v) => {
        actual = v;
        ctx.llamadas.push(['font', v]);
      },
    });
    return ctx;
  }

  const disposicion = calcularDisposicion(1080, 1920);
  const carrera = { nombre: 'Ingeniería en Computación', color: '#00E5A0' };

  it('el nombre de la carrera va en la tipografia de titulo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(fuentesDe(ctx).length).toBeGreaterThan(0);
    for (const fuente of fuentesDe(ctx)) expect(fuente).toContain(TITULO_SOLO);
  });

  it('el pie usa solo la tipografia de titulo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    for (const fuente of fuentesDe(ctx)) expect(fuente).toContain(TITULO_SOLO);
  });

  // La consigna es la unica instruccion de toda la experiencia: tiene que
  // entenderse de un vistazo, desde lejos y de costado.
  it('la consigna del sostenido va en la sans', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarConsigna(ctx, disposicion, 1);
    for (const fuente of fuentesDe(ctx)) expect(fuente).toContain(FAMILIA_TEXTO);
  });

  // Las nubes del reposo pasan por delante y a veces quedan blancas justo
  // detras del texto. Sin una sombra propia debajo, la invitacion desaparecia
  // cada vez que un jiron le pasaba por encima.
  it('la invitacion se apoya sobre su propia sombra', () => {
    const ctx = crearCtxFalso();

    dibujarInvitacion(ctx, disposicion, 0.5);

    const orden = ctx.llamadas.map(([que]) => que);
    const primerTexto = orden.indexOf('fillText');
    const primerFondo = orden.findIndex((que) => que === 'fill' || que === 'fillRect');
    expect(primerFondo).toBeGreaterThanOrEqual(0);
    expect(primerFondo).toBeLessThan(primerTexto);
  });

  // La invitacion entra y sale con su alfa: aparecer de golpe encima de las
  // nubes que se cierran, o irse de golpe cuando alguien se sienta, era un
  // golpe de luz.
  it('la invitacion se enciende con su alfa', () => {
    const apagada = crearCtxFalso();
    dibujarInvitacion(apagada, disposicion, 0.5, 0);
    expect(apagada.llamadas).toEqual([]);

    const ctx = crearCtxFalso();
    dibujarInvitacion(ctx, disposicion, 1, 0.5);
    const textos = soloDe(ctx, 'fillText');
    expect(textos.length).toBeGreaterThan(0);
    for (const [, , , , opacidad] of textos) expect(opacidad).toBeCloseTo(0.5);
  });

  // La consigna es la unica instruccion de la experiencia y no cambia: se elige
  // una sola vez, asi que despues no queda nada que enseñar.
  it('ensena el gesto', () => {
    const ctx = crearCtxFalso();

    dibujarConsigna(ctx, disposicion, 1);

    const dichos = soloDe(ctx, 'fillText').map(([, texto]) => texto);
    expect(dichos).toContain('Sostené la mano sobre un objeto');
  });

  // Despues de elegir, el gesto es otro: ya no se agarra, se explora. La frase
  // la decide quien dibuja.
  it('la consigna dice la frase que se le pide', () => {
    const ctx = crearCtxFalso();
    dibujarConsigna(ctx, disposicion, 1, 'Pasá la mano sobre los objetos del fondo');
    expect(soloDe(ctx, 'fillText').map(([, texto]) => texto)).toEqual([
      'Pasá la mano sobre los objetos del fondo',
    ]);
  });

  // La ficha mide su texto con la letra del lienzo. Si midiera antes de su
  // save, dejaria la letra cambiada para todo lo que se dibuja despues.
  it('la ficha no deja cambiada la letra del lienzo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarFicha(
      ctx,
      { x: 170, y: 330, radio: 59, alfa: 1, nombre: 'Rodamiento', descripcion: 'Gira sin rozar.' },
      disposicion,
      {
        hasta: 1920 * 0.14,
        colores: { titulo: '#f0dca0', texto: '#cdbfa0', panel: '#05050a', borde: '#8a7038' },
        tipografia: TIPOGRAFIA_DE_FICHA,
      },
    );
    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('font')).toBeGreaterThan(orden.indexOf('save'));
    expect(orden.lastIndexOf('font')).toBeLessThan(orden.lastIndexOf('restore'));
  });

  it('la ficha escribe el nombre en la de titulo y la descripcion en la sans', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarFicha(
      ctx,
      { x: 170, y: 330, radio: 59, alfa: 1, nombre: 'Rodamiento', descripcion: 'Gira sin rozar.' },
      disposicion,
      {
        hasta: 1920 * 0.14,
        colores: { titulo: '#f0dca0', texto: '#cdbfa0', panel: '#05050a', borde: '#8a7038' },
        tipografia: TIPOGRAFIA_DE_FICHA,
      },
    );
    const fuentes = fuentesDe(ctx);
    expect(fuentes.some((fuente) => fuente.includes(TITULO_SOLO))).toBe(true);
    expect(
      fuentes.some((fuente) => !fuente.includes(TITULO_SOLO) && fuente.includes(FAMILIA_TEXTO)),
    ).toBe(true);
    for (const fuente of fuentes) {
      if (fuente.includes(TITULO_SOLO)) expect(fuente).toMatch(new RegExp('^' + PESO_TITULO + '\\s'));
    }
  });

  // Muffaroo trae UNA sola variante. Pedirle 700 da un falso-bold que le
  // arruina las formas — y como ya es una letra pesada, no le hace falta.
  it('nunca se le pide negrita a la tipografia de titulo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    dibujarInvitacion(ctx, disposicion, 0.5);

    for (const fuente of fuentesDe(ctx)) {
      if (!fuente.includes(TITULO_SOLO)) continue;
      expect(fuente, fuente).toMatch(new RegExp(`^${PESO_TITULO}\\s`));
    }
    expect(PESO_TITULO).toBe(400);
  });

  // Muffaroo es una display condensada, en versales y sin serifas. Si el
  // archivo faltara, el cambio no puede pasar de un cambio de fuente: el
  // respaldo tiene que ser una sans condensada, no una serif ni la sans por
  // defecto del navegador.
  it('la tipografia de titulo es Muffaroo con un respaldo sans', () => {
    expect(TITULO_SOLO).toBe("'Muffaroo'");
    expect(FAMILIA_TITULO).toContain(TITULO_SOLO);
    expect(FAMILIA_TITULO).toMatch(/sans-serif\s*$/);
    expect(FAMILIA_TEXTO).not.toContain(TITULO_SOLO);
  });
});

describe('disponerFicha', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  // Medida falsa: cada caracter mide medio tamaño de letra.
  const medir = (texto, fuente) => texto.length * Number(fuente.match(/([\d.]+)px/)[1]) * 0.5;
  const px = (fuente) => Number(fuente.match(/([\d.]+)px/)[1]);
  const textos = {
    nombre: 'Rodamiento',
    descripcion: 'Bolillas de acero entre dos anillos: dejan girar un eje casi sin rozamiento.',
  };
  // Donde empieza la cabeza: el 14 % de arriba es la franja del cartel.
  const HASTA = 1920 * 0.14;
  const disponer = (conTextos = textos, opciones = {}) =>
    disponerFicha(conTextos, disposicion, medir, {
      hasta: HASTA,
      tipografia: TIPOGRAFIA_DE_FICHA,
      ...opciones,
    });

  // LA FICHA NO LE PUEDE TAPAR LA CARA A LA PERSONA, y al costado de su objeto
  // no entraba con letra grande: va arriba de la cabeza, a lo ancho.
  it('va arriba, a lo ancho y centrada, sin bajar hasta la cara', () => {
    const { caja } = disponer();
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.y + caja.alto).toBeLessThanOrEqual(HASTA);
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.ancho).toBeLessThanOrEqual(1080);
    expect(caja.ancho).toBeGreaterThan(1080 * 0.9);
    expect(caja.x).toBeCloseTo(1080 - caja.x - caja.ancho);
  });

  it('parte la descripcion en renglones que entran en la ficha', () => {
    const ficha = disponer({ ...textos, descripcion: textos.descripcion.repeat(2) });
    expect(ficha.lineas.length).toBeGreaterThan(1);
    expect(ficha.lineas.map((linea) => linea.texto).join(' ')).toBe(textos.descripcion.repeat(2));
    for (const linea of ficha.lineas) {
      expect(medir(linea.texto, ficha.fuenteTexto)).toBeLessThanOrEqual(
        ficha.caja.ancho - 2 * ficha.relleno,
      );
    }
  });

  // Una descripcion mucho mas larga que las del catalogo no puede bajar el
  // cartel hasta la cara: antes chica que encima de la cara.
  it('si no entra hasta la cara, achica la letra en vez de taparla', () => {
    const ficha = disponer({ nombre: 'Rodamiento', descripcion: textos.descripcion.repeat(8) });
    expect(ficha.caja.y + ficha.caja.alto).toBeLessThanOrEqual(HASTA);
    expect(px(ficha.fuenteTexto)).toBeLessThan(px(disponer().fuenteTexto));
  });

  // La letra de la ficha vive en CONFIG.fichas.tipografia: quien no la pasa se
  // entera en el acto, en vez de dibujar con una copia vieja de esos numeros.
  // Y sin saber donde empieza la cara, no hay donde ponerla.
  it('sin tipografia o sin saber hasta donde bajar, no inventa', () => {
    expect(() => disponerFicha(textos, disposicion, medir, { hasta: HASTA })).toThrow();
    expect(() => disponerFicha(textos, disposicion, medir, { tipografia: TIPOGRAFIA_DE_FICHA })).toThrow();
  });

  // Un nombre que no entra en un renglon va en dos antes que salirse del panel
  // —y de la pantalla—.
  it('un nombre largo va en dos renglones que entran en la ficha', () => {
    const nombre = 'Lector de código de barras con cable espiralado y base de apoyo';
    const ficha = disponer({ nombre, descripcion: textos.descripcion });
    const anchoUtil = ficha.caja.ancho - 2 * ficha.relleno;
    expect(ficha.titulo.lineas).toHaveLength(2);
    expect(ficha.titulo.lineas.map((linea) => linea.texto).join(' ')).toBe(nombre);
    for (const linea of ficha.titulo.lineas) {
      expect(medir(linea.texto, ficha.titulo.fuente)).toBeLessThanOrEqual(anchoUtil);
    }
    // Y la caja crece para los dos renglones: la descripcion arranca debajo.
    expect(ficha.lineas[0].y).toBeGreaterThan(ficha.titulo.lineas[1].y);
  });

  it('un nombre de una sola palabra que no entra se achica lo justo', () => {
    const palabra = 'Electroencefalografista'.repeat(3);
    const ficha = disponer({ nombre: palabra });
    expect(ficha.titulo.lineas.map((linea) => linea.texto)).toEqual([palabra]);
    expect(medir(palabra, ficha.titulo.fuente)).toBeLessThanOrEqual(
      ficha.caja.ancho - 2 * ficha.relleno,
    );
  });

  // La letra de la ficha se calibra en el stand, leyendo a dos metros: sale de
  // las opciones (CONFIG.fichas.tipografia), no de este archivo.
  it('el tamaño de la letra sale de las opciones', () => {
    const ficha = disponer(textos, { tipografia: { texto: 0.6, titulo: 1 } });
    expect(ficha.fuenteTexto).toContain(`${Math.round(disposicion.texto.tamanoFrase * 0.6)}px`);
    expect(ficha.titulo.fuente).toContain(`${disposicion.texto.tamanoFrase}px`);
  });

  // En un monitor apaisado la composicion vertical entra mas chica, a la altura
  // de la pantalla, en la franja del medio: el cartel va sobre ella, no a lo
  // ancho de la pantalla, y la letra se achica en la misma proporcion.
  it('en un monitor apaisado el cartel y la letra se achican con la composicion', () => {
    const tipografia = { texto: 1, titulo: 1.25 };
    const enElEspejo = disponer(textos, { tipografia });
    const apaisada = calcularDisposicion(1920, 1080);
    const enApaisado = disponerFicha(textos, apaisada, medir, { hasta: 1080 * 0.14, tipografia });

    const proporcion = apaisada.unidad / disposicion.unidad;
    expect(proporcion).toBeLessThan(1);
    expect(px(enApaisado.fuenteTexto)).toBe(Math.round(px(enElEspejo.fuenteTexto) * proporcion));
    expect(px(enApaisado.titulo.fuente)).toBe(Math.round(px(enElEspejo.titulo.fuente) * proporcion));
    expect(enApaisado.caja.ancho).toBeLessThanOrEqual(apaisada.unidad);
    expect(enApaisado.caja.x + enApaisado.caja.ancho / 2).toBeCloseTo(960);
    expect(enApaisado.caja.y + enApaisado.caja.alto).toBeLessThanOrEqual(1080 * 0.14);
  });

  it('sin descripcion va solo el nombre, y sin nada no hay ficha', () => {
    const soloNombre = disponer({ nombre: 'Casco' });
    expect(soloNombre.titulo.lineas.map((linea) => linea.texto)).toEqual(['Casco']);
    expect(soloNombre.lineas).toEqual([]);
    expect(disponer({})).toBeNull();
  });
});

describe('dibujarFicha', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const colores = {
    titulo: '#f0dca0',
    texto: '#cdbfa0',
    panel: 'rgba(5, 5, 10, 0.78)',
    borde: 'rgba(240, 220, 160, 0.3)',
  };
  const objeto = {
    nombre: 'Rodamiento',
    descripcion: 'Bolillas de acero entre dos anillos.',
  };
  const dibujar = (ctx, extra) =>
    dibujarFicha(ctx, { ...objeto, ...extra }, disposicion, {
      hasta: 1920 * 0.14,
      colores,
      tipografia: TIPOGRAFIA_DE_FICHA,
    });

  it('no dibuja nada invisible ni sin textos', () => {
    for (const extra of [{ alfa: 0 }, { alfa: 1, nombre: undefined, descripcion: undefined }]) {
      const ctx = crearCtxFalso();
      dibujar(ctx, extra);
      expect(ctx.llamadas).toEqual([]);
    }
  });

  it('escribe el nombre y despues la descripcion', () => {
    const ctx = crearCtxFalso();
    dibujar(ctx, { alfa: 1 });
    const dichos = soloDe(ctx, 'fillText').map(([, texto]) => texto);
    expect(dichos[0]).toBe('Rodamiento');
    expect(dichos.slice(1).join(' ')).toBe('Bolillas de acero entre dos anillos.');
  });

  // Sin un panel oscuro debajo, un texto claro sobre una zona clara de la foto
  // no se lee.
  it('el panel va debajo del texto', () => {
    const ctx = crearCtxFalso();
    dibujar(ctx, { alfa: 1 });
    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('fill')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('fill')).toBeLessThan(orden.indexOf('fillText'));
  });

  // Un solo trazo: con el borde en dos figuras, se le veia la union.
  it('el panel es un solo trazo', () => {
    const ctx = crearCtxFalso();
    dibujar(ctx, { alfa: 1 });
    expect(soloDe(ctx, 'roundRect')).toEqual([]);
    expect(soloDe(ctx, 'moveTo')).toHaveLength(1);
  });

  it('se enciende con su alfa', () => {
    const ctx = crearCtxFalso();
    dibujar(ctx, { alfa: 0.5 });
    const rellenos = soloDe(ctx, 'fill');
    expect(rellenos.length).toBeGreaterThan(0);
    for (const [, , opacidad] of rellenos) expect(opacidad).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujar(ctx, { alfa: 1 });
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

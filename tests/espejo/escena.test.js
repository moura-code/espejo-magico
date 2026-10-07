import { describe, it, expect } from 'vitest';
import {
  FAMILIA_TEXTO,
  FAMILIA_TITULO,
  PESO_TITULO,
  TITULO_SOLO,
  calcularDisposicion,
  calcularRecorteVisible,
  calcularRectanguloDelFondo,
  calcularRectanguloVideo,
  cajaEnPantalla,
  crearRellenoDelFondo,
  disponerFichaDebajo,
  disponerFichaDeObjeto,
  dibujarAnilloDeProgreso,
  dibujarConsigna,
  dibujarDiscoDeCarga,
  dibujarFicha,
  dibujarFondo,
  dibujarFotoDelObjeto,
  dibujarHumo,
  dibujarInvitacion,
  dibujarManos,
  dibujarNombreDeCarrera,
  dibujarObjeto,
  dibujarObjetoApoyado,
  dibujarObjetosDelante,
  dibujarPersonaRecortada,
  dibujarTratamientoDeFondo,
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

  // La foto entra ENTERA y sin estirar: una foto deformada se nota de lejos, y
  // una foto recortada se lleva los objetos pintados en el pedazo que no se ve.
  it('entra entera en la pantalla conservando la relacion de la imagen', () => {
    const ctx = crearCtxFalso();
    expect(dibujarFondo(ctx, imagen(1920, 1080), disposicion, 1)).not.toBeNull();

    const [, , x, y, ancho, alto] = soloDe(ctx, 'drawImage')[0];
    expect(ancho / alto).toBeCloseTo(1920 / 1080, 3);
    expect(x).toBeGreaterThanOrEqual(-0.001);
    expect(y).toBeGreaterThanOrEqual(-0.001);
    expect(x + ancho).toBeLessThanOrEqual(1080 + 0.001);
    expect(y + alto).toBeLessThanOrEqual(1920 + 0.001);
  });

  // Lo que la foto deja libre se cubre con el relleno —la misma foto
  // desenfocada—, y solo eso: debajo de la foto no se dibuja, porque mientras
  // el fondo entra se veria a traves de ella.
  it('cubre con el relleno solo lo que la foto deja libre, antes que la foto', () => {
    const ctx = crearCtxFalso();
    const apaisada = calcularDisposicion(1920, 1080);
    const lienzoDeRelleno = { width: 1920, height: 1080 };
    const relleno = { obtener: () => lienzoDeRelleno };
    const rectangulo = dibujarFondo(ctx, imagen(1080, 1920), apaisada, 0.5, relleno);

    const dibujos = soloDe(ctx, 'drawImage');
    const delRelleno = dibujos.filter(([, fuente]) => fuente === lienzoDeRelleno);
    expect(delRelleno).toHaveLength(2);
    expect(dibujos.at(-1)[1]).not.toBe(lienzoDeRelleno);
    // Izquierda y derecha de la foto, del mismo pedazo del relleno.
    expect(delRelleno[0].slice(2)).toEqual([0, 0, rectangulo.x, 1080, 0, 0, rectangulo.x, 1080]);
    const derecha = rectangulo.x + rectangulo.ancho;
    expect(delRelleno[1].slice(2, 4)).toEqual([derecha, 0]);
    expect(delRelleno[1][4]).toBeCloseTo(1920 - derecha);
  });

  // En el espejo la foto llena la pantalla: desenfocar un relleno que no se ve
  // seria trabajo por nada.
  it('si la foto llena la pantalla, no pide el relleno', () => {
    const ctx = crearCtxFalso();
    let pedidos = 0;
    const relleno = {
      obtener: () => {
        pedidos += 1;
        return { width: 1, height: 1 };
      },
    };
    dibujarFondo(ctx, imagen(1080, 1920), disposicion, 1, relleno);
    expect(pedidos).toBe(0);
    expect(soloDe(ctx, 'drawImage')).toHaveLength(1);
  });

  // La version apaisada del fondo es lo que va a los costados: la elige quien
  // llama, y el relleno la necesita para armarlos.
  it('le pasa al relleno la version apaisada del fondo', () => {
    const ctx = crearCtxFalso();
    const extension = imagen(1920, 1080);
    let recibida = null;
    const relleno = {
      obtener: (fuente, disposicionPedida, ext) => {
        recibida = ext;
        return { width: 1920, height: 1080 };
      },
    };
    dibujarFondo(ctx, imagen(1080, 1920), calcularDisposicion(1920, 1080), 1, relleno, extension);
    expect(recibida).toBe(extension);
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

describe('calcularRectanguloDelFondo', () => {
  // En el espejo la foto y la pantalla tienen la misma proporcion: la foto la
  // llena exacta, igual que cuando se dibujaba cubriendo.
  it('en una pantalla de su misma proporcion la llena exacta', () => {
    expect(calcularRectanguloDelFondo(1080, 1920, 1080, 1920)).toEqual({
      x: 0,
      y: 0,
      ancho: 1080,
      alto: 1920,
    });
    expect(calcularRectanguloDelFondo(1080, 1920, 540, 960)).toEqual({
      x: 0,
      y: 0,
      ancho: 540,
      alto: 960,
    });
  });

  // EL ZOOM DE LA NOTEBOOK. Cubriendo una pantalla apaisada, la foto vertical
  // se agrandaba al ancho y solo se veia su franja del medio: los objetos
  // pintados arriba quedaban afuera. Ahora entra a lo alto, centrada.
  it('en una pantalla apaisada entra a lo alto, centrada', () => {
    const rectangulo = calcularRectanguloDelFondo(1080, 1920, 1920, 1080);
    expect(rectangulo.alto).toBeCloseTo(1080);
    expect(rectangulo.ancho).toBeCloseTo(607.5);
    expect(rectangulo.y).toBeCloseTo(0);
    expect(rectangulo.x).toBeCloseTo((1920 - 607.5) / 2);
  });

  it('en una pantalla mas angosta entra a lo ancho, centrada', () => {
    const rectangulo = calcularRectanguloDelFondo(1080, 1920, 1080, 2400);
    expect(rectangulo.ancho).toBeCloseTo(1080);
    expect(rectangulo.alto).toBeCloseTo(1920);
    expect(rectangulo.x).toBeCloseTo(0);
    expect(rectangulo.y).toBeCloseTo(240);
  });
});

describe('crearRellenoDelFondo', () => {
  const lienzoFalso = () => {
    const ctx = crearCtxFalso();
    return { width: 0, height: 0, ctx, getContext: () => ctx };
  };

  // Los costados son la misma foto, agrandada hasta cubrir, desenfocada y mas
  // oscura: se leen como la escena que sigue, no como una banda negra.
  it('dibuja la foto cubriendo la pantalla, desenfocada y oscurecida', () => {
    let creado = null;
    const relleno = crearRellenoDelFondo({
      crearLienzo: () => (creado = lienzoFalso()),
      desenfoque: 0.03,
      brillo: 0.5,
    });
    const foto = imagen(1080, 1920);
    const lienzo = relleno.obtener(foto, { ancho: 1920, alto: 1080 });

    expect(lienzo).toBe(creado);
    expect([lienzo.width, lienzo.height]).toEqual([1920, 1080]);
    const [[, fuente, x, y, ancho, alto]] = soloDe(lienzo.ctx, 'drawImage');
    expect(fuente).toBe(foto);
    // Cubre, y un poco mas: el desenfoque mira mas alla del borde.
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(x + ancho).toBeGreaterThan(1920);
    expect(y + alto).toBeGreaterThan(1080);
    expect(ancho / alto).toBeCloseTo(1080 / 1920, 3);
  });

  // Desenfocar una foto entera es caro: se hace una vez por foto y por medida
  // de ventana, no en cada cuadro.
  it('lo hace una sola vez por foto y por medida', () => {
    let creados = 0;
    const relleno = crearRellenoDelFondo({
      crearLienzo: () => {
        creados += 1;
        return lienzoFalso();
      },
      desenfoque: 0.03,
      brillo: 0.5,
    });
    const foto = imagen(1080, 1920);
    const primero = relleno.obtener(foto, { ancho: 1920, alto: 1080 });
    relleno.obtener(foto, { ancho: 1920, alto: 1080 });
    expect(soloDe(primero.ctx, 'drawImage')).toHaveLength(1);

    relleno.obtener(foto, { ancho: 1512, alto: 982 });
    relleno.obtener(imagen(1080, 1920), { ancho: 1512, alto: 982 });
    expect(soloDe(primero.ctx, 'drawImage')).toHaveLength(3);
    expect(creados).toBe(1);
  });

  it('sin nada que medir no hay relleno', () => {
    const relleno = crearRellenoDelFondo({ crearLienzo: lienzoFalso, desenfoque: 0.03, brillo: 0.5 });
    expect(relleno.obtener(videoDe(0, 0), { ancho: 1920, alto: 1080 })).toBeNull();
  });

  // Anota con que filtro se dibujo cada imagen: la extension va nitida, y la
  // foto de abajo, desenfocada.
  const lienzoQueAnotaFiltro = () => {
    const lienzo = lienzoFalso();
    const { ctx } = lienzo;
    ctx.drawImage = (...args) => ctx.llamadas.push(['drawImage', ...args, ctx.filter]);
    return lienzo;
  };
  const rellenoConFiltro = () =>
    crearRellenoDelFondo({ crearLienzo: lienzoQueAnotaFiltro, desenfoque: 0.03, brillo: 0.5 });

  // EN UNA PANTALLA APAISADA LOS COSTADOS SON LA ESCENA MISMA. La version
  // apaisada del fondo trae la foto centrada a todo el alto: dibujada a la
  // escala de la foto y centrada en ella, sus costados continuan la foto.
  it('con la version apaisada, los costados son la escena extendida, nitida y alineada con la foto', () => {
    const foto = imagen(1080, 1920);
    const extension = imagen(1920, 1080);
    const lienzo = rellenoConFiltro().obtener(foto, { ancho: 1920, alto: 1080 }, extension);

    const dibujos = soloDe(lienzo.ctx, 'drawImage');
    expect(dibujos.map(([, fuente]) => fuente)).toEqual([foto, extension]);
    const [, , x, y, ancho, alto, filtro] = dibujos[1];
    expect([x, y, ancho, alto]).toEqual([0, 0, 1920, 1080]);
    expect(filtro).toBe('none');
  });

  // En la notebook (1512x982) la extension es mas ancha que la pantalla.
  it('en una pantalla menos ancha que la extension, la cubre entera y centrada en la foto', () => {
    const lienzo = rellenoConFiltro().obtener(
      imagen(1080, 1920),
      { ancho: 1512, alto: 982 },
      imagen(1920, 1080),
    );

    const [, , x, y, ancho, alto] = soloDe(lienzo.ctx, 'drawImage')[1];
    expect(x).toBeLessThanOrEqual(0);
    expect(x + ancho).toBeGreaterThanOrEqual(1512);
    expect(x + ancho / 2).toBeCloseTo(756);
    expect(y).toBeCloseTo(0);
    expect(alto).toBeCloseTo(982);
  });

  // En una 21:9 la extension no llega a los bordes: lo que sobra sigue siendo
  // la foto desenfocada, nunca una banda negra.
  it('en una pantalla mas ancha que la extension, lo que sobra sigue desenfocado', () => {
    const foto = imagen(1080, 1920);
    const lienzo = rellenoConFiltro().obtener(foto, { ancho: 2560, alto: 1080 }, imagen(1920, 1080));

    const [desenfocada, extendida] = soloDe(lienzo.ctx, 'drawImage');
    const [, fuente, xFoto, , anchoFoto, , filtro] = desenfocada;
    expect(fuente).toBe(foto);
    expect(filtro).toContain('blur');
    expect(xFoto).toBeLessThan(0);
    expect(xFoto + anchoFoto).toBeGreaterThan(2560);
    const [, , x, , ancho] = extendida;
    expect(x).toBeCloseTo(320);
    expect(x + ancho).toBeCloseTo(2240);
  });

  // Un lienzo armado sin extension, o con la de otra carrera, no sirve: se
  // rehace cuando la extension cambia, y no mientras sea la misma.
  it('se rehace cuando cambia la extension, y no mientras sea la misma', () => {
    const relleno = rellenoConFiltro();
    const foto = imagen(1080, 1920);
    const medida = { ancho: 1920, alto: 1080 };
    const lienzo = relleno.obtener(foto, medida);
    expect(soloDe(lienzo.ctx, 'drawImage')).toHaveLength(1);

    const extension = imagen(1920, 1080);
    relleno.obtener(foto, medida, extension);
    relleno.obtener(foto, medida, extension);
    expect(soloDe(lienzo.ctx, 'drawImage')).toHaveLength(3);
  });

  it('una extension sin medidas no se dibuja', () => {
    const lienzo = rellenoConFiltro().obtener(imagen(1080, 1920), { ancho: 1920, alto: 1080 }, imagen(0, 0));
    expect(soloDe(lienzo.ctx, 'drawImage')).toHaveLength(1);
  });
});

describe('dibujarTratamientoDeFondo', () => {
  it('unifica la foto con tinte, vineta y una luz central para la persona', () => {
    const ctx = crearCtxFalso();
    const disposicion = calcularDisposicion(1080, 1920);

    dibujarTratamientoDeFondo(ctx, disposicion, 0.75);

    expect(soloDe(ctx, 'fillRect')).toHaveLength(3);
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
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

  // El texto de color sobre una zona clara del fondo es ilegible, y algo lo
  // tiene que despegar. Era una franja a lo ancho que subia hasta casi el negro:
  // se comia un tercio del fondo y le oscurecia el cuerpo a la persona. Ahora es
  // una sombra que se desvanece solo detras de las letras, como la de las
  // tablets de MAITE.
  it('despega el nombre con una sombra detras de las letras, sin franja a lo ancho', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);

    expect(soloDe(ctx, 'fillRect')).toEqual([]);
    const orden = ctx.llamadas.map(([que, estilo]) => (que === 'fill' ? `fill:${estilo}` : que));
    expect(orden.indexOf('fill:degradado')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('fill:degradado')).toBeLessThan(orden.indexOf('fillText'));

    // La sombra es una elipse de radio 1 escalada al texto: ni de lejos el
    // ancho de la pantalla.
    const [[, radioX, radioY]] = soloDe(ctx, 'scale');
    expect(radioX * 2).toBeLessThan(disposicion.ancho * 0.6);
    expect(radioY * 2).toBeLessThan(disposicion.pie.alto);
  });

  it('separa el pie de la escena con una linea dorada antes del nombre', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1, '#f0dca0');

    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('stroke')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('stroke')).toBeLessThan(orden.indexOf('fillText'));
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

  it('integra el recorte sobre una base oscura con un borde comun', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, apoyado, bancoCon({ 'assets/civil/grua.png': imagen() }), '#FF8A3D');

    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('stroke')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('stroke')).toBeLessThan(orden.indexOf('drawImage'));
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

  it('apoya la consigna sobre una pastilla oscura antes de escribirla', () => {
    const ctx = crearCtxFalso();
    dibujarConsigna(ctx, disposicion, 1, 'Pasá la mano sobre los objetos del fondo');

    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('fill')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('fill')).toBeLessThan(orden.indexOf('fillText'));
  });

  it('parte una ayuda larga para que no se recorte en una pantalla angosta', () => {
    const ctx = crearCtxFalso();
    ctx.measureText = (texto) => ({ width: texto.length * 14 });
    const angosta = calcularDisposicion(720, 1280);
    const frase = 'Mantené la mano sobre un objeto hasta completar el círculo';

    dibujarConsigna(ctx, angosta, 1, frase);

    const textos = soloDe(ctx, 'fillText');
    expect(textos.length).toBeGreaterThan(1);
    expect(textos.map(([, texto]) => texto).join(' ')).toBe(frase);
    for (const [, texto] of textos) {
      expect(ctx.measureText(texto).width).toBeLessThanOrEqual(angosta.ancho * 0.85);
    }
    expect(textos.at(-1)[3]).toBeLessThanOrEqual(angosta.alto * 0.93);
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

  // El espejo y la herramienta ponen la ficha con dibujarFicha: si los demas
  // objetos del fondo no llegaran hasta la ficha de debajo, en las pruebas
  // esquivaria al vecino de la columna y en la pantalla se lo taparia. Paso:
  // fichaDelObjeto los mandaba y aca se perdian.
  it('la ficha de debajo esquiva a los demas objetos del fondo', () => {
    const primerRenglon = (otros) => {
      const ctx = crearCtxFalso();
      dibujarFicha(ctx, { ...objeto, alfa: 1 }, disposicion, {
        colores,
        tipografia: TIPOGRAFIA_DE_FICHA,
        ancla: { x: 140, y: 560, radio: 95 },
        otros,
      });
      return soloDe(ctx, 'fillText')[0];
    };
    const [, , sola] = primerRenglon([]);
    const [, , esquivando] = primerRenglon([{ x: 140, y: 930, radio: 105 }]);
    expect(esquivando).toBeGreaterThan(sola);
  });
});

// Donde cae en pantalla una caja normalizada a la foto. Es la cuenta con la que
// el espejo recorta un objeto de adentro del fondo: si se separa del rectangulo
// con el que se dibujo la foto, se levanta un pedazo de pared.
describe('cajaEnPantalla', () => {
  it('mide la caja contra el rectangulo con el que se dibujo la foto', () => {
    const rectangulo = { x: 100, y: 50, ancho: 400, alto: 800 };
    expect(cajaEnPantalla([0.25, 0.5, 0.75, 1], rectangulo)).toEqual({
      x: 200,
      y: 450,
      ancho: 200,
      alto: 400,
    });
  });

  // El fondo se dibuja cubriendo y puede sobresalir del lienzo: una caja de la
  // parte recortada tiene que dar coordenadas negativas, no cero.
  it('acompaña al fondo cuando sobresale del lienzo', () => {
    const rectangulo = { x: -200, y: 0, ancho: 1480, alto: 1080 };
    const caja = cajaEnPantalla([0, 0, 0.1, 0.1], rectangulo);
    expect(caja.x).toBe(-200);
    expect(caja.ancho).toBeCloseTo(148, 6);
  });
});

// Un objeto FOTOGRAFIADO adentro de una foto real: lo que se levanta es su
// propio PNG, puesto exacto sobre el que se ve en la foto.
describe('dibujarFotoDelObjeto', () => {
  const rectangulo = { x: 0, y: 4, ancho: 1920, alto: 1072 };
  const caja = [0.05, 0.5, 0.3, 0.8];
  // Anota tambien con que filtro y que opacidad se dibujo.
  const conRegistro = () => {
    const ctx = crearCtxFalso();
    ctx.drawImage = (...args) =>
      ctx.llamadas.push(['drawImage', ...args, { filtro: ctx.filter, alfa: ctx.globalAlpha }]);
    return ctx;
  };

  it('pone el PNG entero en su caja, donde cae la foto', () => {
    const ctx = conRegistro();
    const png = imagen(653, 419);
    dibujarFotoDelObjeto(ctx, { imagen: png, caja, rectangulo });
    const [[, dibujada, x, y, ancho, alto]] = soloDe(ctx, 'drawImage');
    expect(dibujada).toBe(png);
    expect(x).toBeCloseTo(0.05 * 1920);
    expect(y).toBeCloseTo(4 + 0.5 * 1072);
    expect(ancho).toBeCloseTo(0.25 * 1920);
    expect(alto).toBeCloseTo(0.3 * 1072);
  });

  // Crece desde su centro, como el pintado: si creciera desde una esquina se
  // correria de lugar.
  it('crece desde su centro, se ilumina y lleva su opacidad', () => {
    const ctx = conRegistro();
    dibujarFotoDelObjeto(ctx, { imagen: imagen(), caja, rectangulo, crecer: 1.2, brillo: 0.2, alfa: 0.5 });
    const [[, , x, y, ancho, alto, estado]] = soloDe(ctx, 'drawImage');
    const enPantalla = cajaEnPantalla(caja, rectangulo);
    expect(x + ancho / 2).toBeCloseTo(enPantalla.x + enPantalla.ancho / 2);
    expect(y + alto / 2).toBeCloseTo(enPantalla.y + enPantalla.alto / 2);
    expect(ancho).toBeCloseTo(enPantalla.ancho * 1.2);
    expect(alto).toBeCloseTo(enPantalla.alto * 1.2);
    expect(estado).toEqual({ filtro: 'brightness(1.2)', alfa: 0.5 });
  });

  // En vez de crecer —un grupo de cosas agrandado se ve doble—, se despega con
  // un resplandor que sigue su silueta: el shadowBlur del lienzo sobre el PNG,
  // a la medida del objeto y en el color que se le pida, con su opacidad.
  it('el resplandor sigue la silueta del PNG, a la medida del objeto', () => {
    const ctx = crearCtxFalso();
    ctx.drawImage = (...args) =>
      ctx.llamadas.push(['drawImage', ...args, { sombra: ctx.shadowColor, desenfoque: ctx.shadowBlur }]);
    dibujarFotoDelObjeto(ctx, {
      imagen: imagen(),
      caja,
      rectangulo,
      resplandor: 0.5,
      desenfoque: 0.1,
      color: '#f0dca0',
    });
    const [[, , , , , alto, { sombra, desenfoque }]] = soloDe(ctx, 'drawImage');
    expect(sombra).toBe('rgba(240, 220, 160, 0.5)');
    expect(desenfoque).toBeCloseTo(0.1 * alto);
  });

  it('sin resplandor no lleva sombra', () => {
    const ctx = crearCtxFalso();
    ctx.drawImage = (...args) => ctx.llamadas.push(['drawImage', ...args, ctx.shadowBlur]);
    dibujarFotoDelObjeto(ctx, { imagen: imagen(), caja, rectangulo, color: '#f0dca0' });
    expect(soloDe(ctx, 'drawImage')[0].at(-1)).toBe(0);
  });

  // Sin su PNG no hay nada que levantar, y caer al circulo dorado del respaldo
  // pondria un disco encima del objeto que ya se ve en la foto.
  it('sin imagen, o invisible, no dibuja nada', () => {
    for (const caso of [
      { imagen: null, caja, rectangulo },
      { imagen: imagen(), caja, rectangulo, alfa: 0 },
    ]) {
      const ctx = conRegistro();
      dibujarFotoDelObjeto(ctx, caso);
      expect(ctx.llamadas).toEqual([]);
    }
  });

  it('deja el lienzo como estaba', () => {
    const ctx = conRegistro();
    dibujarFotoDelObjeto(ctx, { imagen: imagen(), caja, rectangulo, brillo: 0.2 });
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

// La ficha que va pegada a su objeto, que es donde va cuando el objeto vive
// adentro de la foto.
describe('disponerFichaDebajo', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const tipografia = { texto: 1, titulo: 1.5 };
  const medir = (texto, fuente) => {
    const tamano = Number(fuente.match(/([\d.]+)px/)[1]);
    return texto.length * tamano * (fuente.includes('Muffaroo') ? 0.4 : 0.52);
  };
  const textos = { nombre: 'Matraz Erlenmeyer', descripcion: 'Recipiente cónico de vidrio.' };
  const poner = (objeto, otros = []) =>
    disponerFichaDebajo(textos, disposicion, medir, { objeto, otros, tipografia });

  it('va debajo del objeto cuando abajo hay lugar', () => {
    const objeto = { x: 150, y: 500, radio: 90 };
    const { caja } = poner(objeto);
    expect(caja.y).toBeGreaterThan(objeto.y + objeto.radio);
  });

  // Con el objeto pegado al piso, debajo no entra: se corre al costado o arriba,
  // lo que quede limpio, pero nunca se sale de la pantalla.
  it('busca otro lugar cuando abajo no entra', () => {
    const objeto = { x: 150, y: 1820, radio: 90 };
    const { caja } = poner(objeto);
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.y + caja.alto).toBeLessThanOrEqual(1920);
    expect(caja.y).not.toBeGreaterThan(objeto.y + objeto.radio);
  });

  it('nunca tapa a su propio objeto', () => {
    const objeto = { x: 150, y: 500, radio: 90 };
    const { caja } = poner(objeto);
    const cercaX = Math.max(caja.x, Math.min(objeto.x, caja.x + caja.ancho));
    const cercaY = Math.max(caja.y, Math.min(objeto.y, caja.y + caja.alto));
    expect(Math.hypot(objeto.x - cercaX, objeto.y - cercaY)).toBeGreaterThanOrEqual(objeto.radio);
  });

  // En la columna de la periferia hay otro objeto mas abajo: centrada, el
  // cartel se lo comeria y la persona iria a buscar algo que la ficha le tapo.
  // Se corre hacia el centro, que es la unica franja sin objetos.
  it('se corre hacia el centro antes que taparle el vecino de la columna', () => {
    const objeto = { x: 140, y: 560, radio: 95 };
    const vecino = { x: 140, y: 930, radio: 105 };
    const centrada = poner(objeto).caja;
    const esquivando = poner(objeto, [vecino]).caja;
    expect(esquivando.x).toBeGreaterThan(centrada.x);
    const cercaX = Math.max(esquivando.x, Math.min(vecino.x, esquivando.x + esquivando.ancho));
    const cercaY = Math.max(esquivando.y, Math.min(vecino.y, esquivando.y + esquivando.alto));
    expect(Math.hypot(vecino.x - cercaX, vecino.y - cercaY)).toBeGreaterThanOrEqual(vecino.radio);
  });

  it('entra entera en la pantalla aunque el objeto este pegado al borde', () => {
    for (const x of [20, 1060]) {
      const { caja } = poner({ x, y: 700, radio: 95 });
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.ancho).toBeLessThanOrEqual(1080);
    }
  });

  // UN RINCON DE ABAJO CON OTRO OBJETO JUSTO ENCIMA —las placas de Petri en la
  // foto del laboratorio de Quimica, con la cristaleria arriba—: debajo esta el
  // nombre, arriba y al costado el vecino, y ninguno de los cinco sitios queda
  // limpio. Se mostraba igual en el primero, con la letra achicada y tapando a
  // su propio objeto. Va al sitio limpio mas cercano, con la letra pedida.
  it('sin ninguno de sus sitios libres, va al lugar limpio mas cercano', () => {
    const objeto = { x: 146, y: 1162, radio: 124 };
    const otros = [
      { x: 198, y: 1053, radio: 156 },
      { x: 786, y: 948, radio: 221 },
    ];
    const ficha = poner(objeto, otros);
    const toca = (caja, { x, y, radio }) => {
      const cercaX = Math.max(caja.x, Math.min(x, caja.x + caja.ancho));
      const cercaY = Math.max(caja.y, Math.min(y, caja.y + caja.alto));
      return Math.hypot(x - cercaX, y - cercaY) < radio;
    };
    for (const circulo of [objeto, ...otros]) expect(toca(ficha.caja, circulo)).toBe(false);
    expect(ficha.caja.y).toBeGreaterThanOrEqual(0);
    expect(ficha.caja.y + ficha.caja.alto).toBeLessThanOrEqual(1920 - disposicion.pie.alto);
    const letra = Number(ficha.fuenteTexto.match(/([\d.]+)px/)[1]);
    expect(letra).toBe(Math.round(disposicion.texto.tamanoFrase * tipografia.texto));
  });

  // La eleccion entre las dos fichas vive en un solo lado: el espejo, la
  // herramienta y las pruebas pasan por aca.
  it('disponerFichaDeObjeto elige por el ancla', () => {
    const conAncla = disponerFichaDeObjeto(textos, disposicion, medir, {
      ancla: { x: 150, y: 500, radio: 90 },
      tipografia,
    });
    const arriba = disponerFichaDeObjeto(textos, disposicion, medir, { hasta: 268, tipografia });
    expect(conAncla.caja.y).toBeGreaterThan(500);
    expect(arriba.caja.y).toBeLessThan(100);
  });
});

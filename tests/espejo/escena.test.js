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
  dibujarFichaDePersona,
  dibujarFondo,
  dibujarHumo,
  dibujarInvitacion,
  dibujarManos,
  dibujarNombreDeCarrera,
  dibujarObjeto,
  dibujarPersonaRecortada,
  partirEnLineas,
  tamanoQueEntra,
} from '../../espejo/escena.js';

// Lienzo falso: registra las llamadas para poder afirmar sobre lo dibujado.
function crearCtxFalso() {
  const llamadas = [];
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
    stroke: () => llamadas.push(['stroke']),
    fill: () => llamadas.push(['fill']),
    clip: (...args) => llamadas.push(['clip', ...args]),
    translate: (x, y) => llamadas.push(['translate', x, y]),
    scale: (x, y) => llamadas.push(['scale', x, y]),
    rotate: (a) => llamadas.push(['rotate', a]),
    fillText: (texto, x, y) => llamadas.push(['fillText', texto, x, y]),
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
    expect(dibujarFondo(ctx, null, disposicion, 1)).toBe(false);
    expect(dibujarFondo(ctx, imagen(), disposicion, 0)).toBe(false);
    expect(ctx.llamadas).toEqual([]);
  });

  // El fondo se dibuja cubriendo, no estirado: una foto apaisada deformada para
  // entrar en una pantalla vertical se nota de lejos.
  it('cubre la pantalla conservando la relacion de la imagen', () => {
    const ctx = crearCtxFalso();
    expect(dibujarFondo(ctx, imagen(1920, 1080), disposicion, 1)).toBe(true);

    const [, , x, y, ancho, alto] = soloDe(ctx, 'drawImage')[0];
    expect(ancho / alto).toBeCloseTo(1920 / 1080, 3);
    expect(x).toBeLessThanOrEqual(0.001);
    expect(y).toBeLessThanOrEqual(0.001);
    expect(x + ancho).toBeGreaterThanOrEqual(1080 - 0.001);
    expect(y + alto).toBeGreaterThanOrEqual(1920 - 0.001);
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

describe('dibujarFichaDePersona', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const carrera = {
    nombre: 'Ingeniería Civil',
    color: '#FF8A3D',
    persona: { nombre: 'Ana Pérez', texto: 'Diseña puentes que aguantan cien años.' },
  };

  it('escribe el nombre y el texto de la persona', () => {
    const ctx = crearCtxFalso();
    dibujarFichaDePersona(ctx, carrera, disposicion, 1);

    const escrito = soloDe(ctx, 'fillText').map(([, texto]) => texto);
    expect(escrito[0]).toBe('Ana Pérez');
    expect(escrito.slice(1).join(' ')).toContain('puentes');
  });

  // El texto blanco sobre un fondo con una zona clara es ilegible. El degradado
  // de abajo es lo unico que lo sostiene.
  it('pone el degradado que despega el texto del fondo', () => {
    const ctx = crearCtxFalso();
    dibujarFichaDePersona(ctx, carrera, disposicion, 1);
    expect(soloDe(ctx, 'fillRect')).toHaveLength(1);
  });

  it('no dibuja nada sin persona o sin alfa', () => {
    for (const [c, alfa] of [
      [carrera, 0],
      [{ ...carrera, persona: undefined }, 1],
      [null, 1],
    ]) {
      const ctx = crearCtxFalso();
      dibujarFichaDePersona(ctx, c, disposicion, alfa);
      expect(ctx.llamadas).toEqual([]);
    }
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarFichaDePersona(ctx, carrera, disposicion, 1);
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
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

  // El objeto elegido no puede quedar al medio: ahi esta la cara de la persona,
  // que es lo que la escena tiene que mostrar.
  it('el lugar del elegido queda arriba y dentro de la pantalla', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
    ]) {
      const d = calcularDisposicion(ancho, alto);
      expect(d.elegido.y).toBeLessThan(alto * 0.25);
      expect(d.elegido.y - d.elegido.radio).toBeGreaterThan(0);
      expect(d.elegido.x).toBeCloseTo(ancho / 2);
      expect(d.elegido.radio).toBeGreaterThan(0);
    }
  });

  // El nombre se apoyaba sobre el borde de abajo del objeto elegido y las dos
  // cosas se leian peor. Se nota mas con la tipografia de titulo, que es alta.
  it('el nombre de la carrera no pisa al objeto elegido', () => {
    const ctx = crearCtxFalso();
    let fuente = '';
    Object.defineProperty(ctx, 'font', { get: () => fuente, set: (v) => (fuente = v) });

    const d = calcularDisposicion(1080, 1920);
    dibujarNombreDeCarrera(ctx, { nombre: 'Ingeniería Civil', color: '#FF8A3D' }, d, 1);

    const [, , , y] = ctx.llamadas.find(([q]) => q === 'fillText');
    const tamano = Number(fuente.match(/(\d+)px/)[1]);
    // La linea de arriba del texto tiene que quedar por debajo del objeto.
    expect(y - tamano).toBeGreaterThan(d.elegido.y + d.elegido.radio);
  });

  it('la ficha de la persona ocupa el pie de la pantalla', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.ficha.nombreY).toBeLessThan(d.ficha.textoY);
    expect(d.ficha.textoY).toBeLessThan(1920);
    expect(d.ficha.nombreY).toBeGreaterThan(1920 - d.ficha.alto);
    // Y no puede pisar al objeto elegido, que vive arriba.
    expect(d.ficha.nombreY).toBeGreaterThan(d.elegido.y + d.elegido.radio);
  });

  it('la ficha deja margen a los costados', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.ficha.margen).toBeGreaterThan(0);
    expect(d.ficha.margen * 2).toBeLessThan(1080);
  });

  it('escala la tipografia con el lado corto de la pantalla', () => {
    const chica = calcularDisposicion(540, 960);
    const grande = calcularDisposicion(1080, 1920);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(chica.texto.tamanoNombre * 1.9);
    expect(grande.texto.tamanoNombre).toBeLessThan(chica.texto.tamanoNombre * 2.1);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(grande.texto.tamanoFrase);
    expect(grande.ficha.tamanoNombre).toBeGreaterThan(grande.ficha.tamanoTexto);
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
  const carrera = {
    nombre: 'Ingeniería en Computación',
    color: '#00E5A0',
    persona: { nombre: 'Maite Martínez', texto: 'Diseña los sistemas que hacen que el resto funcione.' },
  };

  it('el nombre de la carrera va en la tipografia de titulo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(fuentesDe(ctx).length).toBeGreaterThan(0);
    for (const fuente of fuentesDe(ctx)) expect(fuente).toContain(TITULO_SOLO);
  });

  it('en la ficha, el nombre va en titulo y el texto en la sans', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarFichaDePersona(ctx, carrera, disposicion, 1);

    const fuentes = fuentesDe(ctx);
    expect(fuentes.some((f) => f.includes(TITULO_SOLO))).toBe(true);
    // El texto de la persona es lo unico de la pantalla que hay que LEER: a
    // tamaño de parrafo la display cuesta, y son segundos los que hay.
    expect(fuentes.at(-1)).toContain(FAMILIA_TEXTO);
    expect(fuentes.at(-1)).not.toContain(TITULO_SOLO);
  });

  // La consigna es la unica instruccion de toda la experiencia: tiene que
  // entenderse de un vistazo, desde lejos y de costado.
  it('la consigna del sostenido va en la sans', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarConsigna(ctx, disposicion, 1);
    for (const fuente of fuentesDe(ctx)) expect(fuente).toContain(FAMILIA_TEXTO);
  });

  // Germania One trae UNA sola variante. Pedirle 700 da un falso-bold que le
  // arruina las formas — y como ya es una letra pesada, no le hace falta.
  it('nunca se le pide negrita a la tipografia de titulo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    dibujarFichaDePersona(ctx, carrera, disposicion, 1);
    dibujarInvitacion(ctx, disposicion, 0.5);

    for (const fuente of fuentesDe(ctx)) {
      if (!fuente.includes(TITULO_SOLO)) continue;
      expect(fuente, fuente).toMatch(new RegExp(`^${PESO_TITULO}\\s`));
    }
    expect(PESO_TITULO).toBe(400);
  });

  // Si el archivo faltara, el cambio no puede pasar de un cambio de fuente: sin
  // respaldo declarado el navegador cae en la sans por defecto y la pantalla
  // cambia de caracter entera.
  it('la tipografia de titulo declara un respaldo con serifas', () => {
    expect(FAMILIA_TITULO).toContain(TITULO_SOLO);
    expect(FAMILIA_TITULO).toMatch(/serif\s*$/);
    expect(FAMILIA_TEXTO).not.toContain(TITULO_SOLO);
  });
});

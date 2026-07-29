import { describe, it, expect } from 'vitest';
import {
  calcularDisposicion,
  calcularRectanguloVideo,
  calcularAspasCaracol,
  calcularFasesDeCierre,
  calcularPosicionLogoFing,
  calcularPosicionTemporizador,
  calcularUbicacionTexto,
  dibujarEncuentro,
  dibujarMensajeSorteo,
  dibujarReflexion,
  dibujarTextos,
  dibujarPuntosRostro,
  dibujarPose,
  dibujarColisionadores,
  dibujarTemporizadorEstado,
  trazarSiluetaPersona,
  tamanoQueEntra,
} from '../../espejo/escena.js';
import { CONFIG } from '../../espejo/config.js';

const rostroEn = (x, y = 360, radio = 120) => ({
  centro: { x, y },
  radio,
});
const AJUSTES_TEXTO = CONFIG.render.textoAdaptativo;

describe('calcularUbicacionTexto', () => {
  const apaisada = calcularDisposicion(1920, 1080);

  it('pone el texto a la derecha cuando la persona esta a la izquierda', () => {
    const ubicacion = calcularUbicacionTexto(apaisada, rostroEn(520), null, AJUSTES_TEXTO);

    expect(ubicacion.modo).toBe('lateral');
    expect(ubicacion.lado).toBe('derecha');
    expect(ubicacion.x).toBeGreaterThan(1920 / 2);
    expect(ubicacion.inicio).toBeGreaterThan(1920 / 2);
    expect(ubicacion.fin).toBeLessThanOrEqual(1920);
  });

  it('pone el texto a la izquierda cuando la persona esta a la derecha', () => {
    const ubicacion = calcularUbicacionTexto(apaisada, rostroEn(1400), null, AJUSTES_TEXTO);

    expect(ubicacion.modo).toBe('lateral');
    expect(ubicacion.lado).toBe('izquierda');
    expect(ubicacion.x).toBeLessThan(1920 / 2);
    expect(ubicacion.fin).toBeLessThan(1400 - 120);
  });

  it('mantiene el lado anterior ante movimientos pequeños cerca del centro', () => {
    const estable = calcularUbicacionTexto(apaisada, rostroEn(1020), 'derecha', AJUSTES_TEXTO);
    const cambio = calcularUbicacionTexto(apaisada, rostroEn(1300), 'derecha', AJUSTES_TEXTO);

    expect(estable.lado).toBe('derecha');
    expect(cambio.lado).toBe('izquierda');
  });

  it('mantiene fijo el centro del texto aunque fluctue la deteccion', () => {
    const posiciones = [470, 520, 610, 760].map((x) =>
      calcularUbicacionTexto(apaisada, rostroEn(x), 'derecha', AJUSTES_TEXTO).x);

    expect(new Set(posiciones).size).toBe(1);
  });

  it('conserva el pie en vertical, sin rostro o sin suficiente espacio', () => {
    expect(
      calcularUbicacionTexto(
        calcularDisposicion(1080, 1920),
        rostroEn(300),
        null,
        AJUSTES_TEXTO,
      ).modo,
    ).toBe('pie');
    expect(calcularUbicacionTexto(apaisada, null, null, AJUSTES_TEXTO).modo).toBe('pie');
    expect(
      calcularUbicacionTexto(apaisada, rostroEn(960, 360, 620), null, AJUSTES_TEXTO).modo,
    ).toBe('pie');
  });

  it('dibuja todas las lineas dentro del lado libre', () => {
    const textos = [];
    const contexto = {
      font: '',
      save() {},
      restore() {},
      measureText(texto) {
        const tamano = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
        return { width: texto.length * tamano * 0.48 };
      },
      fillText(texto, x) {
        textos.push({ texto, x });
      },
    };
    const carrera = {
      nombre: 'Ingeniería en Sistemas de Comunicación',
      categoria: 'Carrera de grado',
      color: '#00B8D9',
      finalidad: 'Diseñar redes y servicios que conectan personas y comunidades.',
    };
    const ubicacion = calcularUbicacionTexto(apaisada, rostroEn(480), null, AJUSTES_TEXTO);

    dibujarTextos(contexto, carrera, apaisada, 1, ubicacion);

    expect(textos.length).toBeGreaterThanOrEqual(4);
    expect(textos.every(({ x }) => x > 1920 / 2)).toBe(true);
  });

  it('aplica el lado libre durante encuentro, sorteo y reflexion', () => {
    const posiciones = [];
    const contexto = {
      font: '',
      save() {},
      restore() {},
      fillRect() {},
      measureText(texto) {
        const tamano = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
        return { width: texto.length * tamano * 0.48 };
      },
      fillText(_texto, x) {
        posiciones.push(x);
      },
    };
    const carrera = { color: '#FF5D8F' };
    const ubicacion = calcularUbicacionTexto(apaisada, rostroEn(480), null, AJUSTES_TEXTO);

    dibujarEncuentro(contexto, apaisada, ubicacion);
    dibujarMensajeSorteo(contexto, apaisada, 0.5, ubicacion);
    dibujarReflexion(contexto, carrera, apaisada, ubicacion);

    expect(posiciones.length).toBeGreaterThanOrEqual(5);
    expect(posiciones.every((x) => x > 1920 / 2)).toBe(true);
  });
});

describe('calcularFasesDeCierre', () => {
  it('pasa de la posibilidad al concepto general', () => {
    expect(calcularFasesDeCierre(0)).toEqual({ prediccion: 1, concepto: 0 });
    expect(calcularFasesDeCierre(0.5).prediccion).toBeLessThan(1);
    expect(calcularFasesDeCierre(0.5).concepto).toBeGreaterThan(0);
    expect(calcularFasesDeCierre(1)).toEqual({ prediccion: 0, concepto: 1 });
  });
});

describe('trazarSiluetaPersona', () => {
  it('crea una mascara de cabeza y torso como respaldo', () => {
    const llamadas = [];
    const contexto = {
      beginPath: () => llamadas.push('beginPath'),
      ellipse: () => llamadas.push('ellipse'),
      moveTo() {},
      bezierCurveTo: () => llamadas.push('bezierCurveTo'),
      lineTo() {},
      closePath() {},
      fill: () => llamadas.push('fill'),
      quadraticCurveTo() {},
      stroke() {},
      arc() {},
    };

    expect(
      trazarSiluetaPersona(
        contexto,
        { centro: { x: 500, y: 350 }, radio: 120, angulo: 0 },
        [],
        calcularDisposicion(1000, 1000),
      ),
    ).toBe(true);
    expect(llamadas).toContain('ellipse');
    expect(llamadas).toContain('bezierCurveTo');
    expect(llamadas).toContain('fill');
  });

  it('no inventa una persona cuando no hay rostro', () => {
    expect(
      trazarSiluetaPersona({}, null, [], calcularDisposicion(1000, 1000)),
    ).toBe(false);
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

  it('deja el piso arriba del borde para que el texto no quede tapado', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.piso).toBeLessThan(1920);
    expect(d.piso).toBeGreaterThan(1920 * 0.7);
  });

  it('la caja de fisica termina en el piso', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.caja).toEqual({ x: 0, y: 0, ancho: 1080, alto: d.piso });
  });

  it('la caja nunca se sale de la pantalla', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
      [2160, 3840],
    ]) {
      const d = calcularDisposicion(ancho, alto);
      expect(d.caja.ancho).toBeLessThanOrEqual(ancho);
      expect(d.caja.alto).toBeLessThanOrEqual(alto);
    }
  });

  it('escala la tipografia con el lado corto de la pantalla', () => {
    const chica = calcularDisposicion(540, 960);
    const grande = calcularDisposicion(1080, 1920);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(chica.texto.tamanoNombre * 1.9);
    expect(grande.texto.tamanoNombre).toBeLessThan(chica.texto.tamanoNombre * 2.1);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(grande.texto.tamanoFrase);
  });

  it('pone el nombre arriba de la frase', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.texto.categoriaY).toBeLessThan(d.texto.nombreY);
    expect(d.texto.nombreY).toBeLessThan(d.texto.fraseY);
    expect(d.texto.fraseY).toBeLessThan(1920);
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

describe('calcularPosicionLogoFing', () => {
  it('ubica el logo arriba a la izquierda y dentro de la pantalla', () => {
    const disposicion = calcularDisposicion(1080, 1920);
    const posicion = calcularPosicionLogoFing(
      disposicion,
      { width: 1382, height: 280 },
    );

    expect(posicion.x).toBeLessThan(1080 / 2);
    expect(posicion.y).toBeLessThan(1920 / 2);
    expect(posicion.x - posicion.relleno).toBeGreaterThanOrEqual(0);
    expect(posicion.y - posicion.relleno).toBeGreaterThanOrEqual(0);
    expect(posicion.x + posicion.ancho + posicion.relleno).toBeLessThanOrEqual(1080);
    expect(posicion.y + posicion.alto + posicion.relleno).toBeLessThanOrEqual(1920);
  });

  it('conserva la proporcion institucional', () => {
    const posicion = calcularPosicionLogoFing(
      calcularDisposicion(1920, 1080),
      { width: 1382, height: 280 },
    );
    expect(posicion.ancho / posicion.alto).toBeCloseTo(1382 / 280, 4);
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

describe('dibujarPuntosRostro', () => {
  it('dibuja un circulo por cada landmark sintetico', () => {
    let arcos = 0;
    let rellenos = 0;
    const contexto = {
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      arc() {
        arcos += 1;
      },
      fill() {
        rellenos += 1;
      },
    };
    const puntos = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ];

    dibujarPuntosRostro(contexto, puntos, { radio: 4 });

    expect(arcos).toBe(3);
    expect(rellenos).toBe(1);
    expect(contexto.shadowBlur).toBe(12);
  });

  it('no toca el lienzo si no hay puntos', () => {
    let guardados = 0;
    dibujarPuntosRostro({ save: () => { guardados += 1; } }, []);
    expect(guardados).toBe(0);
  });
});

describe('diagnóstico corporal', () => {
  function contextoDiagnostico() {
    return {
      arcos: 0,
      lineas: 0,
      rellenos: 0,
      save() {},
      restore() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {
        this.lineas += 1;
      },
      arc() {
        this.arcos += 1;
      },
      fill() {
        this.rellenos += 1;
      },
      stroke() {},
    };
  }

  it('muestra todos los puntos corporales disponibles', () => {
    const contexto = contextoDiagnostico();
    const puntos = Array.from({ length: 33 }, (_, indice) => ({
      x: indice * 10,
      y: indice * 5,
    }));

    dibujarPose(contexto, { puntos });

    expect(contexto.arcos).toBe(33);
    expect(contexto.lineas).toBeGreaterThan(20);
  });

  it('muestra cápsulas, torso y círculos de colisión', () => {
    const contexto = contextoDiagnostico();
    dibujarColisionadores(contexto, [
      {
        tipo: 'capsula',
        desde: { x: 10, y: 10 },
        hasta: { x: 50, y: 10 },
        radio: 8,
      },
      {
        tipo: 'poligono',
        puntos: [
          { x: 10, y: 20 },
          { x: 50, y: 20 },
          { x: 45, y: 80 },
          { x: 15, y: 80 },
        ],
      },
      { x: 100, y: 100, radio: 20 },
    ]);

    expect(contexto.lineas).toBeGreaterThanOrEqual(5);
    expect(contexto.arcos).toBe(1);
    expect(contexto.rellenos).toBeGreaterThanOrEqual(2);
  });
});

describe('dibujarTemporizadorEstado', () => {
  it('ubica el contador abajo a la izquierda y dentro de la pantalla', () => {
    const posicion = calcularPosicionTemporizador({
      ancho: 1080,
      alto: 1920,
      unidad: 1080,
    });

    expect(posicion.centroX).toBeLessThan(1080 / 2);
    expect(posicion.centroY).toBeGreaterThan(1920 / 2);
    expect(posicion.centroX - posicion.radio).toBeGreaterThanOrEqual(0);
    expect(posicion.centroY + posicion.radio).toBeLessThan(1920);
  });

  it('dibuja un aro de progreso y los segundos restantes', () => {
    let arcos = 0;
    let trazos = 0;
    const textos = [];
    const contexto = {
      save() {},
      restore() {},
      beginPath() {},
      arc() {
        arcos += 1;
      },
      fill() {},
      stroke() {
        trazos += 1;
      },
      fillText(texto) {
        textos.push(texto);
      },
    };

    dibujarTemporizadorEstado(
      contexto,
      { ancho: 1080, alto: 1920, unidad: 1080 },
      { segundosRestantes: 3, proporcionRestante: 0.75 },
      '#62D8FF',
    );

    expect(arcos).toBe(3);
    expect(trazos).toBe(2);
    expect(textos).toEqual(['3', 's']);
  });

  it('no dibuja nada cuando el estado no tiene cuenta regresiva', () => {
    let guardados = 0;
    dibujarTemporizadorEstado({ save: () => { guardados += 1; } }, {}, null);
    expect(guardados).toBe(0);
  });
});

describe('calcularAspasCaracol', () => {
  const DISPOSICION = { ancho: 1280, alto: 720, unidad: 405 };

  it('genera seis aspas curvas alrededor del centro', () => {
    const caracol = calcularAspasCaracol(DISPOSICION, 0.5);

    expect(caracol.centro).toEqual({ x: 640, y: 360 });
    expect(caracol.aspas).toHaveLength(6);
    expect(caracol.aspas[0].bordeInicial).toHaveLength(49);
    expect(caracol.aspas[0].bordeFinal).toHaveLength(49);
  });

  it('mantiene finitos todos los puntos de la espiral', () => {
    const { aspas } = calcularAspasCaracol(DISPOSICION, 0.65);
    const puntos = aspas.flatMap((aspa) => [...aspa.bordeInicial, ...aspa.bordeFinal]);

    expect(puntos.every((punto) => Number.isFinite(punto.x) && Number.isFinite(punto.y))).toBe(true);
  });

  it('al cerrar por completo una aspa toca la siguiente sin dejar huecos', () => {
    const { aspas } = calcularAspasCaracol(DISPOSICION, 1);
    const finalPrimera = aspas[0].bordeFinal[0];
    const inicioSiguiente = aspas[1].bordeInicial[0];

    expect(finalPrimera.x).toBeCloseTo(inicioSiguiente.x);
    expect(finalPrimera.y).toBeCloseTo(inicioSiguiente.y);
  });

  it('a mitad del cierre deja canales visibles entre las aspas', () => {
    const { aspas } = calcularAspasCaracol(DISPOSICION, 0.5);
    const finalPrimera = aspas[0].bordeFinal[0];
    const inicioSiguiente = aspas[1].bordeInicial[0];

    expect(Math.hypot(finalPrimera.x - inicioSiguiente.x, finalPrimera.y - inicioSiguiente.y)).toBeGreaterThan(100);
  });
});

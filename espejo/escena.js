// El dibujo de la escena. No sabe que existe MediaPipe ni la maquina de estados:
// recibe que dibujar y lo dibuja.

import { calcularAnclaje } from './anclaje.js';
import { dibujarFigura } from './figuras.js';
import { TEXTOS_EXPERIENCIA, tituloDeRevelacion } from './narrativa.js';

export function calcularDisposicion(ancho, alto) {
  const vertical = alto >= ancho;
  const alturaTexto = alto * (vertical ? 0.16 : 0.22);
  const piso = alto - alturaTexto;
  const corto = Math.min(ancho, alto);

  return {
    ancho,
    alto,
    vertical,
    piso,
    caja: { x: 0, y: 0, ancho, alto: piso },
    unidad: Math.min(ancho, alto * 0.5625),
    texto: {
      categoriaY: alto - alturaTexto * 0.82,
      nombreY: alto - alturaTexto * 0.55,
      fraseY: alto - alturaTexto * 0.18,
      tamanoCategoria: Math.round(corto * 0.019),
      tamanoNombre: Math.round(corto * 0.055),
      tamanoFrase: Math.round(corto * 0.03),
    },
  };
}

/**
 * Rectangulo donde entra el video cubriendo toda la pantalla sin deformarse.
 * Puede sobresalir: lo que queda afuera se recorta.
 *
 * IMPORTANTE: este mismo rectangulo tiene que usarse para mapear los puntos del
 * rostro. Si el video se dibuja en un rectangulo y los puntos se calculan sobre
 * otro, los marcadores se van de la cara. Ya nos paso una vez.
 */
export function calcularRectanguloVideo(videoAncho, videoAlto, ancho, alto) {
  if (!videoAncho || !videoAlto) return { x: 0, y: 0, ancho, alto };

  const relacionVideo = videoAncho / videoAlto;
  const relacionPantalla = ancho / alto;

  const anchoDibujo = relacionVideo > relacionPantalla ? alto * relacionVideo : ancho;
  const altoDibujo = relacionVideo > relacionPantalla ? alto : ancho / relacionVideo;

  return {
    x: (ancho - anchoDibujo) / 2,
    y: (alto - altoDibujo) / 2,
    ancho: anchoDibujo,
    alto: altoDibujo,
  };
}

export function dibujarVideoEspejado(ctx, video, rectangulo, disposicion, opciones = {}) {
  const { desenfoque = 0, brillo = 1 } = opciones;

  ctx.save();
  if (desenfoque > 0 || brillo !== 1) ctx.filter = `blur(${desenfoque}px) brightness(${brillo})`;
  ctx.translate(disposicion.ancho, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto);
  ctx.restore();
}

export function trazarSiluetaPersona(ctx, rostro, manos, disposicion) {
  if (!rostro?.centro || !(rostro.radio > 0)) return false;

  const { x, y } = rostro.centro;
  const radio = rostro.radio;
  const piso = disposicion.piso ?? disposicion.alto;
  const hombrosY = y + radio * 1.08;
  const cuelloY = y + radio * 0.76;
  const medioHombros = Math.min(
    disposicion.ancho * 0.46,
    radio * 1.55,
  );
  const medioBase = Math.min(
    disposicion.ancho * 0.5,
    radio * 2.15,
  );

  ctx.beginPath();
  ctx.ellipse(
    x,
    y + radio * 0.16,
    radio * 0.82,
    radio * 1.08,
    rostro.angulo ?? 0,
    0,
    Math.PI * 2,
  );
  ctx.moveTo(x - radio * 0.42, cuelloY);
  ctx.bezierCurveTo(
    x - radio * 0.65,
    cuelloY,
    x - medioHombros,
    hombrosY,
    x - medioHombros,
    hombrosY + radio * 0.42,
  );
  ctx.lineTo(x - medioBase, piso + radio);
  ctx.lineTo(x + medioBase, piso + radio);
  ctx.lineTo(x + medioHombros, hombrosY + radio * 0.42);
  ctx.bezierCurveTo(
    x + medioHombros,
    hombrosY,
    x + radio * 0.65,
    cuelloY,
    x + radio * 0.42,
    cuelloY,
  );
  ctx.closePath();
  ctx.fill();

  for (const mano of manos ?? []) {
    const puntos = mano.puntosPantalla ?? [mano.palma, ...(mano.puntas ?? [])];
    const hombroX = mano.palma.x < x ? x - medioHombros * 0.72 : x + medioHombros * 0.72;

    ctx.beginPath();
    ctx.moveTo(hombroX, hombrosY);
    ctx.quadraticCurveTo(
      (hombroX + mano.palma.x) / 2,
      Math.min(hombrosY, mano.palma.y) - radio * 0.16,
      mano.palma.x,
      mano.palma.y,
    );
    ctx.lineWidth = Math.max(radio * 0.28, mano.largoPalma * 0.72);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      mano.palma.x,
      mano.palma.y,
      Math.max(mano.largoPalma * 0.54, mano.radio * 0.34),
      0,
      Math.PI * 2,
    );
    for (const punto of puntos) {
      const radioPunto = Math.max(3, mano.largoPalma * 0.18);
      ctx.moveTo(punto.x + radioPunto, punto.y);
      ctx.arc(punto.x, punto.y, radioPunto, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  return true;
}

export function restaurarPersonaSobreObjetos(
  ctx,
  ctxPersona,
  capaPersona,
  capaFondo,
  {
    mascara,
    rostro,
    manos,
    rectangulo,
    disposicion,
    desenfoqueBorde = 0,
  },
) {
  if (!rostro) return false;

  ctxPersona.clearRect(0, 0, disposicion.ancho, disposicion.alto);
  ctxPersona.save();
  ctxPersona.drawImage(capaFondo, 0, 0);
  ctxPersona.globalCompositeOperation = 'destination-in';
  ctxPersona.fillStyle = '#fff';
  ctxPersona.strokeStyle = '#fff';
  ctxPersona.lineCap = 'round';
  ctxPersona.lineJoin = 'round';

  if (mascara) {
    if (desenfoqueBorde > 0) {
      ctxPersona.filter = `blur(${desenfoqueBorde}px)`;
    }
    ctxPersona.translate(disposicion.ancho, 0);
    ctxPersona.scale(-1, 1);
    ctxPersona.drawImage(
      mascara,
      rectangulo.x,
      rectangulo.y,
      rectangulo.ancho,
      rectangulo.alto,
    );
  } else {
    trazarSiluetaPersona(ctxPersona, rostro, manos, disposicion);
  }

  ctxPersona.restore();
  ctx.drawImage(capaPersona, 0, 0);
  return true;
}

function dibujarSustituto(ctx, radio, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radio, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(2, radio * 0.12);
  ctx.stroke();
}

export function dibujarObjetos(
  ctx,
  objetos,
  banco,
  color,
  { alfa = 1, intensidadSombra = 1 } = {},
) {
  for (const objeto of objetos) {
    const imagen = banco.obtener(objeto.definicion.img);
    const { cuerpo } = objeto;

    ctx.save();
    ctx.globalAlpha = objeto.alfa * alfa;
    ctx.translate(cuerpo.x, cuerpo.y);
    ctx.rotate(cuerpo.giro);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = cuerpo.radio * 0.4 * intensidadSombra;

    // Orden de preferencia: el PNG si existe, la figura vectorial si no, y un
    // circulo del color de la carrera como ultimo recurso. Cuando diseño
    // entregue los PNG, toman el lugar de las figuras sin tocar codigo.
    if (imagen) {
      const lado = cuerpo.radio * 2;
      const escala = lado / Math.max(imagen.width, imagen.height);
      ctx.drawImage(
        imagen,
        (-imagen.width * escala) / 2,
        (-imagen.height * escala) / 2,
        imagen.width * escala,
        imagen.height * escala,
      );
    } else if (!dibujarFigura(ctx, objeto.definicion.figura, cuerpo.radio, color)) {
      dibujarSustituto(ctx, cuerpo.radio, color);
    }
    ctx.restore();
  }
}

export function dibujarAccesorio(ctx, rostro, carrera, banco) {
  if (!rostro || !carrera) return;
  const imagen = banco.obtener(carrera.accesorio.img);
  if (!imagen) return;

  const anclaje = calcularAnclaje(rostro, carrera.accesorio, {
    ancho: imagen.width,
    alto: imagen.height,
  });
  if (!anclaje) return;

  ctx.save();
  ctx.translate(anclaje.x, anclaje.y);
  ctx.rotate(anclaje.angulo);
  ctx.scale(anclaje.escala, anclaje.escala);
  ctx.drawImage(imagen, -anclaje.anclaX, -anclaje.anclaY);
  ctx.restore();
}

export function calcularPosicionLogoFing(disposicion, imagen) {
  const relacion =
    imagen?.width > 0 && imagen?.height > 0
      ? imagen.width / imagen.height
      : 1382 / 280;
  const ladoCorto = Math.min(disposicion.ancho, disposicion.alto);
  const margen = Math.max(18, ladoCorto * 0.02);
  const ancho = Math.min(
    disposicion.ancho * 0.4,
    disposicion.alto * 0.34,
    520,
  );
  const alto = ancho / relacion;
  const relleno = Math.max(10, ladoCorto * 0.012);

  return {
    x: margen,
    y: margen,
    ancho,
    alto,
    relleno,
  };
}

export function dibujarLogoFing(ctx, imagen, disposicion, alfa = 1) {
  if (!imagen || alfa <= 0) return;
  const posicion = calcularPosicionLogoFing(disposicion, imagen);

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = 'rgba(3,7,10,0.68)';
  ctx.fillRect(
    posicion.x - posicion.relleno,
    posicion.y - posicion.relleno,
    posicion.ancho + posicion.relleno * 2,
    posicion.alto + posicion.relleno * 2,
  );
  ctx.drawImage(
    imagen,
    posicion.x,
    posicion.y,
    posicion.ancho,
    posicion.alto,
  );
  ctx.restore();
}

/**
 * Achica la letra lo justo para que el texto entre en el ancho disponible.
 *
 * Sin esto, una frase larga escrita en carreras.json se sale de cuadro, y eso se
 * descubre con publico delante. `medir` se inyecta para poder probarlo sin canvas.
 */
export function tamanoQueEntra(texto, tamanoDeseado, anchoMaximo, medir) {
  const ancho = medir(texto, tamanoDeseado);
  if (ancho <= anchoMaximo || ancho === 0) return tamanoDeseado;
  return Math.max(8, Math.floor(tamanoDeseado * (anchoMaximo / ancho)));
}

const MARGEN_TEXTO = 0.9;

function ubicacionDePie(disposicion) {
  return {
    modo: 'pie',
    lado: null,
    x: disposicion.ancho / 2,
    anchoMaximo: disposicion.ancho * MARGEN_TEXTO,
    categoriaY: disposicion.texto.categoriaY,
    nombreY: disposicion.texto.nombreY,
    fraseY: disposicion.texto.fraseY,
  };
}

/**
 * Ubica la narrativa en el espacio libre que deja la persona.
 *
 * En pantallas verticales conserva el pie, que aprovecha mejor el ancho. En
 * apaisado usa el lado opuesto al rostro. `ladoAnterior` agrega histeresis para
 * que el bloque no salte de izquierda a derecha cuando alguien mueve apenas la
 * cabeza cerca del centro.
 */
export function calcularUbicacionTexto(
  disposicion,
  rostro,
  ladoAnterior = null,
  ajustes,
) {
  const pie = ubicacionDePie(disposicion);
  const { ancho, alto } = disposicion;
  if (!ajustes) return pie;
  if (!rostro?.centro || ancho / alto < ajustes.relacionMinimaLateral) return pie;

  const centro = ancho / 2;
  const desplazamiento = rostro.centro.x - centro;
  const umbralDeCambio = ancho * ajustes.histeresisHorizontal;
  let lado = ladoAnterior === 'izquierda' || ladoAnterior === 'derecha'
    ? ladoAnterior
    : (desplazamiento <= 0 ? 'derecha' : 'izquierda');

  if (lado === 'derecha' && desplazamiento > umbralDeCambio) lado = 'izquierda';
  if (lado === 'izquierda' && desplazamiento < -umbralDeCambio) lado = 'derecha';

  const margenExterior = Math.max(
    ajustes.margenExteriorMinimo,
    alto * ajustes.margenExteriorEnAltura,
  );
  if ((rostro.radio ?? 0) > Math.min(ancho, alto) * ajustes.radioMaximoEnLadoCorto) {
    return pie;
  }

  const inicio = lado === 'derecha'
    ? ancho * ajustes.inicioZonaLateral
    : margenExterior;
  const fin = lado === 'derecha'
    ? ancho - margenExterior
    : ancho * (1 - ajustes.inicioZonaLateral);
  const anchoDisponible = fin - inicio;
  const anchoMinimo = Math.min(
    ancho * ajustes.anchoMinimoEnPantalla,
    alto * ajustes.anchoMinimoEnAltura,
  );

  if (anchoDisponible < anchoMinimo) return pie;

  return {
    modo: 'lateral',
    lado,
    x: (inicio + fin) / 2,
    y: alto * ajustes.alturaInicial,
    anchoMaximo: anchoDisponible * ajustes.rellenoHorizontal,
    inicio,
    fin,
  };
}

/**
 * Un aro en cada palma, del tamaño real del circulo de colision.
 *
 * Solo se dibuja con el diagnostico de malla encendido (tecla M): en la
 * experiencia el visitante no ve nada de esto. Sirve para confirmar que lo que
 * golpea los objetos coincide con donde esta la mano de verdad.
 */
export function dibujarManos(ctx, manos, color) {
  if (!manos || manos.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, manos[0].radio * 0.06);

  for (const mano of manos) {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(mano.palma.x, mano.palma.y, mano.radio, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(mano.palma.x, mano.palma.y, mano.radio * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function dibujarPuntosRostro(ctx, puntos, { color = '#62D8FF', radio = 3 } = {}) {
  if (!puntos || puntos.length === 0) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = color;
  ctx.shadowBlur = radio * 3;
  ctx.beginPath();
  for (const punto of puntos) {
    ctx.moveTo(punto.x + radio, punto.y);
    ctx.arc(punto.x, punto.y, radio, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

const CONEXIONES_MANO = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export function dibujarManosSinteticas(ctx, manos, color = '#FFD23F') {
  const visibles = manos?.filter((mano) => mano.puntosPantalla?.length === 21) ?? [];
  if (visibles.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, visibles[0].largoPalma * 0.045);
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(6, visibles[0].largoPalma * 0.18);

  for (const mano of visibles) {
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    for (const [desde, hasta] of CONEXIONES_MANO) {
      ctx.moveTo(mano.puntosPantalla[desde].x, mano.puntosPantalla[desde].y);
      ctx.lineTo(mano.puntosPantalla[hasta].x, mano.puntosPantalla[hasta].y);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    const radioPunto = Math.max(2.2, mano.largoPalma * 0.055);
    for (const punto of mano.puntosPantalla) {
      ctx.moveTo(punto.x + radioPunto, punto.y);
      ctx.arc(punto.x, punto.y, radioPunto, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

export function calcularAspasCaracol(
  disposicion,
  progreso,
  { cantidad = 6, pasos = 48 } = {},
) {
  const centro = { x: disposicion.ancho / 2, y: disposicion.alto / 2 };
  const radioMaximo = Math.hypot(disposicion.ancho, disposicion.alto) * 0.53;
  const sector = (Math.PI * 2) / cantidad;
  const giro = progreso * sector * 0.16;

  const aspas = Array.from({ length: cantidad }, (_, indice) => {
    const bordeInicial = [];
    const bordeFinal = [];

    for (let paso = 0; paso <= pasos; paso++) {
      const profundidad = paso / pasos;
      const radio = radioMaximo * (1 - profundidad);
      const curva = profundidad * Math.PI * 0.62;
      const angulo = indice * sector + giro + curva;
      const punto = (anguloDelPunto) => ({
        x: Math.cos(anguloDelPunto) * radio,
        y: Math.sin(anguloDelPunto) * radio,
      });

      bordeInicial.push(punto(angulo));
      bordeFinal.push(punto(angulo + sector * progreso));
    }

    return { bordeInicial, bordeFinal };
  });

  return { centro, aspas };
}

export function dibujarCierreDeAusencia(ctx, disposicion, progreso) {
  if (progreso <= 0) return;

  const { centro, aspas } = calcularAspasCaracol(disposicion, progreso);

  ctx.save();
  if (progreso >= 0.999) {
    ctx.fillStyle = '#03070A';
    ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
  }
  ctx.translate(centro.x, centro.y);

  for (const aspa of aspas) {
    ctx.beginPath();
    ctx.moveTo(aspa.bordeInicial[0].x, aspa.bordeInicial[0].y);
    for (const punto of aspa.bordeInicial.slice(1)) ctx.lineTo(punto.x, punto.y);
    for (const punto of [...aspa.bordeFinal].reverse()) ctx.lineTo(punto.x, punto.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(3, 7, 10, 0.965)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(aspa.bordeFinal[0].x, aspa.bordeFinal[0].y);
    for (const punto of aspa.bordeFinal.slice(1)) ctx.lineTo(punto.x, punto.y);
    ctx.strokeStyle = `rgba(120, 190, 210, ${0.05 + progreso * 0.11})`;
    ctx.lineWidth = Math.max(1, disposicion.unidad * 0.0018);
    ctx.shadowColor = 'rgba(98, 216, 255, 0.3)';
    ctx.shadowBlur = Math.max(2, disposicion.unidad * 0.006);
    ctx.stroke();
  }

  ctx.fillStyle = '#03070A';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, disposicion.unidad * 0.012 * progreso), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ajustarLineas(
  ctx,
  contenido,
  { tamanoDeseado, anchoMaximo, maximoLineas, peso, minimo },
) {
  for (let tamano = tamanoDeseado; tamano >= minimo; tamano -= 1) {
    ctx.font = `${peso} ${tamano}px system-ui, sans-serif`;
    const lineas = partirTextoEnLineas(ctx, contenido, anchoMaximo);
    const entran =
      lineas.length <= maximoLineas &&
      lineas.every((linea) => ctx.measureText(linea).width <= anchoMaximo);
    if (entran) return { lineas, tamano };
  }

  ctx.font = `${peso} ${minimo}px system-ui, sans-serif`;
  return {
    lineas: partirTextoEnLineas(ctx, contenido, anchoMaximo),
    tamano: minimo,
  };
}

function dibujarTextosLaterales(ctx, carrera, disposicion, ubicacion, alfa) {
  const { texto } = disposicion;
  let y = ubicacion.y;

  if (carrera.categoria) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alfa * 0.82;
    ctx.font = `700 ${texto.tamanoCategoria}px system-ui, sans-serif`;
    ctx.fillText(carrera.categoria.toLocaleUpperCase('es'), ubicacion.x, y);
    ctx.globalAlpha = alfa;
    y += texto.tamanoCategoria * 2.2;
  }

  const titulo = ajustarLineas(ctx, tituloDeRevelacion(carrera), {
    tamanoDeseado: Math.round(texto.tamanoNombre * 0.92),
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 3,
    peso: 700,
    minimo: Math.max(18, Math.round(texto.tamanoNombre * 0.58)),
  });
  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${titulo.tamano}px system-ui, sans-serif`;
  const interlineadoTitulo = titulo.tamano * 1.08;
  for (const linea of titulo.lineas) {
    ctx.fillText(linea, ubicacion.x, y);
    y += interlineadoTitulo;
  }

  if (!carrera.finalidad) return;
  y += titulo.tamano * 0.42;
  const frase = ajustarLineas(ctx, carrera.finalidad, {
    tamanoDeseado: texto.tamanoFrase,
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 3,
    peso: 400,
    minimo: Math.max(14, Math.round(texto.tamanoFrase * 0.68)),
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = `400 ${frase.tamano}px system-ui, sans-serif`;
  const interlineadoFrase = frase.tamano * 1.24;
  for (const linea of frase.lineas) {
    ctx.fillText(linea, ubicacion.x, y);
    y += interlineadoFrase;
  }
}

export function dibujarTextos(
  ctx,
  carrera,
  disposicion,
  alfa = 1,
  ubicacion = ubicacionDePie(disposicion),
) {
  if (!carrera || alfa <= 0) return;
  const { texto } = disposicion;
  const disponible = ubicacion.anchoMaximo;
  const titulo = tituloDeRevelacion(carrera);

  const medirCon = (peso, familia) => (contenido, tamano) => {
    ctx.font = `${peso} ${tamano}px ${familia}`;
    return ctx.measureText(contenido).width;
  };

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;

  if (ubicacion.modo === 'lateral') {
    dibujarTextosLaterales(ctx, carrera, disposicion, ubicacion, alfa);
    ctx.restore();
    return;
  }

  if (carrera.categoria) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alfa * 0.82;
    ctx.font = `700 ${texto.tamanoCategoria}px system-ui, sans-serif`;
    ctx.fillText(
      carrera.categoria.toLocaleUpperCase('es'),
      ubicacion.x,
      ubicacion.categoriaY,
    );
    ctx.globalAlpha = alfa;
  }

  const medirNombre = medirCon(700, 'system-ui, sans-serif');
  const tamanoNombre = tamanoQueEntra(titulo, texto.tamanoNombre, disponible, medirNombre);
  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${tamanoNombre}px system-ui, sans-serif`;
  ctx.fillText(titulo, ubicacion.x, ubicacion.nombreY);

  if (carrera.finalidad) {
    const medirFrase = medirCon(400, 'system-ui, sans-serif');
    const tamanoFrase = tamanoQueEntra(
      carrera.finalidad,
      texto.tamanoFrase,
      disponible,
      medirFrase,
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = `400 ${tamanoFrase}px system-ui, sans-serif`;
    ctx.fillText(carrera.finalidad, ubicacion.x, ubicacion.fraseY);
  }
  ctx.restore();
}

function dibujarLineaAjustada(
  ctx,
  contenido,
  {
    x,
    y,
    tamano,
    anchoMaximo,
    peso = 400,
    color = '#ffffff',
  },
) {
  const medir = (valor, medida) => {
    ctx.font = `${peso} ${medida}px system-ui, sans-serif`;
    return ctx.measureText(valor).width;
  };
  const elegido = tamanoQueEntra(contenido, tamano, anchoMaximo, medir);
  ctx.fillStyle = color;
  ctx.font = `${peso} ${elegido}px system-ui, sans-serif`;
  ctx.fillText(contenido, x, y);
}

function dibujarLineasAjustadas(
  ctx,
  contenido,
  {
    x,
    y,
    tamano,
    anchoMaximo,
    maximoLineas = 3,
    interlineado = 1.14,
    peso = 400,
    color = '#ffffff',
  },
) {
  const ajuste = ajustarLineas(ctx, contenido, {
    tamanoDeseado: tamano,
    anchoMaximo,
    maximoLineas,
    peso,
    minimo: Math.max(14, Math.round(tamano * 0.6)),
  });
  ctx.fillStyle = color;
  ctx.font = `${peso} ${ajuste.tamano}px system-ui, sans-serif`;
  ajuste.lineas.forEach((linea, indice) => {
    ctx.fillText(linea, x, y + indice * ajuste.tamano * interlineado);
  });
  return ajuste.lineas.length * ajuste.tamano * interlineado;
}

export function partirTextoEnLineas(ctx, contenido, anchoMaximo) {
  const palabras = contenido.trim().split(/\s+/);
  const lineas = [];
  let actual = '';

  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(candidata).width > anchoMaximo) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }

  if (actual) lineas.push(actual);
  return lineas;
}

export function dibujarInvitacion(ctx, disposicion, pulso) {
  const { ancho, alto, texto } = disposicion;
  const disponible = ancho * MARGEN_TEXTO;

  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * pulso;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 24;
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.esperaTitulo, {
    x: ancho / 2,
    y: alto * 0.5,
    tamano: texto.tamanoNombre,
    anchoMaximo: disponible,
    peso: 700,
  });
  ctx.restore();
}

export function dibujarEncuentro(
  ctx,
  disposicion,
  ubicacion = ubicacionDePie(disposicion),
) {
  const { alto, texto } = disposicion;
  const y = ubicacion.modo === 'lateral' ? alto * 0.4 : alto * 0.46;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 24;
  const altoTitulo = dibujarLineasAjustadas(ctx, TEXTOS_EXPERIENCIA.encuentroTitulo, {
    x: ubicacion.x,
    y,
    tamano: texto.tamanoNombre * 0.8,
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 2,
    peso: 700,
  });
  dibujarLineasAjustadas(ctx, TEXTOS_EXPERIENCIA.encuentroBajada, {
    x: ubicacion.x,
    y: y + altoTitulo + texto.tamanoFrase * 0.4,
    tamano: texto.tamanoFrase * 1.08,
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 2,
  });
  ctx.restore();
}

export function dibujarMensajeSorteo(
  ctx,
  disposicion,
  pulso,
  ubicacion = ubicacionDePie(disposicion),
) {
  const { alto, texto } = disposicion;

  ctx.save();
  ctx.globalAlpha = 0.72 + pulso * 0.28;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 26;
  dibujarLineasAjustadas(ctx, TEXTOS_EXPERIENCIA.sorteo, {
    x: ubicacion.x,
    y: alto * 0.5,
    tamano: texto.tamanoNombre * 0.82,
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 2,
    peso: 700,
  });
  ctx.restore();
}

export function dibujarReflexion(
  ctx,
  carrera,
  disposicion,
  ubicacion = ubicacionDePie(disposicion),
) {
  if (!carrera) return;
  const { ancho, alto, texto } = disposicion;
  const y = ubicacion.modo === 'lateral' ? alto * 0.4 : alto * 0.43;

  ctx.save();
  ctx.fillStyle = 'rgba(3,7,10,0.68)';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 20;

  const altoTitulo = dibujarLineasAjustadas(ctx, TEXTOS_EXPERIENCIA.azarTitulo, {
    x: ubicacion.x,
    y,
    tamano: texto.tamanoNombre,
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 2,
    peso: 700,
    color: carrera.color,
  });
  dibujarLineasAjustadas(ctx, TEXTOS_EXPERIENCIA.azarDetalle, {
    x: ubicacion.x,
    y: y + altoTitulo + texto.tamanoFrase * 0.45,
    tamano: texto.tamanoFrase * 1.08,
    anchoMaximo: ubicacion.anchoMaximo,
    maximoLineas: 3,
    interlineado: 1.25,
  });
  ctx.restore();
}

const limitarUnidad = (valor) => Math.max(0, Math.min(1, valor));
const suavizarUnidad = (valor) => {
  const limitado = limitarUnidad(valor);
  return limitado * limitado * (3 - 2 * limitado);
};

export function calcularFasesDeCierre(progreso) {
  return {
    prediccion: 1 - suavizarUnidad((progreso - 0.32) / 0.2),
    concepto: suavizarUnidad((progreso - 0.42) / 0.2),
  };
}

export function dibujarCierreConceptual(ctx, disposicion, progreso, alfa = 1) {
  if (alfa <= 0) return;
  const { ancho, alto, texto } = disposicion;
  const fases = calcularFasesDeCierre(progreso);

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = 'rgba(3,7,10,0.38)';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 22;

  ctx.globalAlpha = alfa * fases.prediccion;
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.cierrePrediccionTitulo, {
    x: ancho / 2,
    y: alto * 0.47,
    tamano: texto.tamanoNombre,
    anchoMaximo: ancho * MARGEN_TEXTO,
    peso: 700,
  });
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.cierrePrediccionBajada, {
    x: ancho / 2,
    y: alto * 0.47 + texto.tamanoNombre * 1.2,
    tamano: texto.tamanoNombre * 0.82,
    anchoMaximo: ancho * MARGEN_TEXTO,
    peso: 700,
    color: '#62D8FF',
  });

  ctx.globalAlpha = alfa * fases.concepto;
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.cierreTitulo, {
    x: ancho / 2,
    y: alto * 0.47,
    tamano: texto.tamanoNombre,
    anchoMaximo: ancho * MARGEN_TEXTO,
    peso: 700,
  });
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.cierreBajada, {
    x: ancho / 2,
    y: alto * 0.47 + texto.tamanoNombre * 1.2,
    tamano: texto.tamanoNombre * 0.82,
    anchoMaximo: ancho * MARGEN_TEXTO,
    peso: 700,
    color: '#7CFFB2',
  });
  ctx.restore();
}

export function calcularPosicionTemporizador(disposicion) {
  const radio = Math.max(30, Math.min(50, disposicion.unidad * 0.04));
  const margenHorizontal = Math.max(20, disposicion.ancho * 0.018);
  const margenInferior = Math.max(24, disposicion.alto * 0.025);
  return {
    radio,
    centroX: margenHorizontal + radio,
    centroY: disposicion.alto - margenInferior - radio,
  };
}

export function dibujarTemporizadorEstado(ctx, disposicion, temporizador, color = '#62D8FF') {
  if (!temporizador) return;

  const { radio, centroX, centroY } = calcularPosicionTemporizador(disposicion);
  const grosor = Math.max(4, radio * 0.13);
  const inicio = -Math.PI / 2;
  const fin = inicio + Math.PI * 2 * temporizador.proporcionRestante;

  ctx.save();
  ctx.fillStyle = 'rgba(3,7,10,0.72)';
  ctx.beginPath();
  ctx.arc(centroX, centroY, radio + grosor * 0.95, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineWidth = grosor;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(centroX, centroY, radio, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = radio * 0.28;
  ctx.beginPath();
  ctx.arc(centroX, centroY, radio, inicio, fin);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(radio * 0.72)}px system-ui, sans-serif`;
  ctx.fillText(String(temporizador.segundosRestantes), centroX, centroY - radio * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.font = `600 ${Math.round(radio * 0.25)}px system-ui, sans-serif`;
  ctx.fillText('s', centroX, centroY + radio * 0.45);
  ctx.restore();
}

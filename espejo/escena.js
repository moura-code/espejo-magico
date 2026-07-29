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

function dibujarSustituto(ctx, radio, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radio, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(2, radio * 0.12);
  ctx.stroke();
}

export function dibujarObjetos(ctx, objetos, banco, color) {
  for (const objeto of objetos) {
    const imagen = banco.obtener(objeto.definicion.img);
    const { cuerpo } = objeto;

    ctx.save();
    ctx.globalAlpha = objeto.alfa;
    ctx.translate(cuerpo.x, cuerpo.y);
    ctx.rotate(cuerpo.giro);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = cuerpo.radio * 0.4;

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

export function dibujarTextos(ctx, carrera, disposicion, alfa = 1) {
  if (!carrera || alfa <= 0) return;
  const { texto, ancho } = disposicion;
  const disponible = ancho * MARGEN_TEXTO;
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

  if (carrera.categoria) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alfa * 0.82;
    ctx.font = `700 ${texto.tamanoCategoria}px system-ui, sans-serif`;
    ctx.fillText(carrera.categoria.toLocaleUpperCase('es'), ancho / 2, texto.categoriaY);
    ctx.globalAlpha = alfa;
  }

  const medirNombre = medirCon(700, 'system-ui, sans-serif');
  const tamanoNombre = tamanoQueEntra(titulo, texto.tamanoNombre, disponible, medirNombre);
  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${tamanoNombre}px system-ui, sans-serif`;
  ctx.fillText(titulo, ancho / 2, texto.nombreY);

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
    ctx.fillText(carrera.finalidad, ancho / 2, texto.fraseY);
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

function dibujarParrafo(
  ctx,
  contenido,
  { x, y, tamano, anchoMaximo, interlineado = 1.25, color = '#ffffff', peso = 400 },
) {
  ctx.font = `${peso} ${tamano}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  const lineas = partirTextoEnLineas(ctx, contenido, anchoMaximo);
  lineas.forEach((linea, indice) => {
    ctx.fillText(linea, x, y + indice * tamano * interlineado);
  });
  return lineas.length * tamano * interlineado;
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

export function dibujarEncuentro(ctx, disposicion) {
  const { ancho, alto, texto } = disposicion;
  const disponible = ancho * MARGEN_TEXTO;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 24;
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.encuentroTitulo, {
    x: ancho / 2,
    y: alto * 0.46,
    tamano: texto.tamanoNombre * 0.8,
    anchoMaximo: disponible,
    peso: 700,
  });
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.encuentroBajada, {
    x: ancho / 2,
    y: alto * 0.46 + texto.tamanoNombre,
    tamano: texto.tamanoFrase * 1.08,
    anchoMaximo: disponible,
  });
  ctx.restore();
}

export function dibujarMensajeSorteo(ctx, disposicion, pulso) {
  const { ancho, alto, texto } = disposicion;

  ctx.save();
  ctx.globalAlpha = 0.72 + pulso * 0.28;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 26;
  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.sorteo, {
    x: ancho / 2,
    y: alto * 0.5,
    tamano: texto.tamanoNombre * 0.82,
    anchoMaximo: ancho * MARGEN_TEXTO,
    peso: 700,
  });
  ctx.restore();
}

export function dibujarReflexion(ctx, carrera, disposicion) {
  if (!carrera) return;
  const { ancho, alto, texto } = disposicion;
  const centroX = ancho / 2;
  const disponible = ancho * 0.84;

  ctx.save();
  ctx.fillStyle = 'rgba(3,7,10,0.68)';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 20;

  dibujarLineaAjustada(ctx, TEXTOS_EXPERIENCIA.azarTitulo, {
    x: centroX,
    y: alto * 0.43,
    tamano: texto.tamanoNombre,
    anchoMaximo: disponible,
    peso: 700,
    color: carrera.color,
  });
  dibujarParrafo(ctx, TEXTOS_EXPERIENCIA.azarDetalle, {
    x: centroX,
    y: alto * 0.43 + texto.tamanoNombre * 1.2,
    tamano: texto.tamanoFrase * 1.08,
    anchoMaximo: disponible,
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

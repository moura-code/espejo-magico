// El dibujo de la escena. No sabe que existe MediaPipe ni la maquina de estados:
// recibe que dibujar y lo dibuja.

import { dibujarFigura } from './figuras.js';

export function calcularDisposicion(ancho, alto) {
  const vertical = alto >= ancho;
  const corto = Math.min(ancho, alto);
  const unidad = Math.min(ancho, alto * 0.5625);

  return {
    ancho,
    alto,
    vertical,
    unidad,

    // Donde va a parar el objeto elegido: arriba de todo, como una insignia. No
    // puede quedar al medio, que es donde esta la cara de la persona.
    elegido: {
      x: ancho / 2,
      y: alto * 0.11,
      radio: unidad * 0.11,
    },

    // La ficha de la persona, abajo, sobre un degradado que la despega del
    // fondo. Es el mismo lugar donde las tablets de MAITE ponen su texto, para
    // que espejo y tablets se lean como una sola cosa.
    ficha: {
      alto: alto * (vertical ? 0.3 : 0.38),
      margen: ancho * 0.08,
      nombreY: alto * (vertical ? 0.79 : 0.74),
      textoY: alto * (vertical ? 0.845 : 0.8),
      tamanoNombre: Math.round(corto * 0.055),
      tamanoTexto: Math.round(corto * 0.03),
      interlinea: 1.35,
    },

    texto: {
      tamanoNombre: Math.round(corto * 0.055),
      tamanoFrase: Math.round(corto * 0.03),
    },
  };
}

/**
 * Rectangulo donde entra el video cubriendo toda la pantalla sin deformarse.
 * Puede sobresalir: lo que queda afuera se recorta.
 *
 * IMPORTANTE: este rectangulo es el origen de TODO lo demas. Con el se dibuja el
 * video y de el sale el recorte que se analiza (calcularRecorteVisible), que es
 * lo que define donde caen los puntos del rostro. Si alguno de los dos caminos
 * se calcula por su cuenta, los marcadores se van de la cara. Ya nos paso una vez.
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

/**
 * Que parte del cuadro de la camara se ve realmente en pantalla, en pixeles del
 * video. Es el inverso exacto de calcularRectanguloVideo.
 *
 * El espejo es vertical y la camara apaisada, asi que el video se dibuja
 * "cubriendo": entra entero de alto y le sobra muchisimo de ancho, que se va
 * fuera de la pantalla. Con 1280x720 en 1080x1920 se ve apenas un tercio del
 * ancho de la camara.
 *
 * Eso importa para detectar, no solo para dibujar: MediaPipe achica lo que le
 * entra a un cuadro chico y fijo, asi que analizar el cuadro completo gasta dos
 * tercios de esa resolucion en pixeles que nadie mira. Analizando solo el
 * recorte, una cara lejana ocupa el triple y el modelo la encuentra desde mucho
 * mas lejos.
 *
 * Devuelve null si el video todavia no reporta tamaño.
 */
export function calcularRecorteVisible(videoAncho, videoAlto, rectangulo, ancho, alto) {
  if (!videoAncho || !videoAlto) return null;

  const pixelesPorX = videoAncho / rectangulo.ancho;
  const pixelesPorY = videoAlto / rectangulo.alto;

  // El rectangulo dibujado siempre cubre la pantalla, asi que el recorte cae
  // dentro del cuadro. Se acota igual: un redondeo no puede terminar pidiendole
  // al lienzo pixeles que no existen.
  const sx = Math.min(Math.max(0, -rectangulo.x * pixelesPorX), videoAncho);
  const sy = Math.min(Math.max(0, -rectangulo.y * pixelesPorY), videoAlto);

  return {
    sx,
    sy,
    sAncho: Math.min(ancho * pixelesPorX, videoAncho - sx),
    sAlto: Math.min(alto * pixelesPorY, videoAlto - sy),
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

/** Cubre el lienzo con una imagen sin deformarla. Lo que sobra se recorta. */
export function dibujarFondo(ctx, imagen, disposicion, alfa = 1) {
  if (!imagen || alfa <= 0) return false;

  const rectangulo = calcularRectanguloVideo(
    imagen.width,
    imagen.height,
    disposicion.ancho,
    disposicion.alto,
  );

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  ctx.drawImage(imagen, rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto);
  ctx.restore();
  return true;
}

/**
 * La persona recortada del espejo, para pegarla encima del fondo de la carrera.
 *
 * `capa` es un lienzo aparte que el llamador reusa entre cuadros: el recorte
 * necesita dos pasadas (video y despues mascara en `destination-in`) y hacerlas
 * sobre el lienzo principal se llevaria puesto el fondo que ya esta dibujado.
 *
 * Devuelve false si no hay silueta. Ahi el llamador tiene que caer al fondo
 * semitransparente sobre el espejo: sin silueta, dibujar solo el fondo dejaria a
 * la persona afuera de su propia escena.
 */
export function dibujarPersonaRecortada(ctx, { capa, video, rectangulo, silueta, disposicion }) {
  if (!capa || !video || !silueta) return false;

  const { ancho, alto } = disposicion;
  capa.ctx.clearRect(0, 0, ancho, alto);

  dibujarVideoEspejado(capa.ctx, video, rectangulo, disposicion);

  capa.ctx.save();
  capa.ctx.globalCompositeOperation = 'destination-in';
  // La silueta viene del lienzo de analisis, que NO esta espejado y cubre
  // exactamente la pantalla. Se espeja aca para que coincida con el video.
  capa.ctx.translate(ancho, 0);
  capa.ctx.scale(-1, 1);
  capa.ctx.drawImage(silueta, 0, 0, ancho, alto);
  capa.ctx.restore();

  ctx.drawImage(capa.canvas, 0, 0);
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

/**
 * Un objeto de los que se ofrecen. Orden de preferencia: el PNG si existe, la
 * figura vectorial si no, y un circulo del color de la carrera como ultimo
 * recurso. Un objeto que no se dibuja es una opcion que no se puede elegir.
 */
export function dibujarObjeto(ctx, { definicion, x, y, radio, alfa = 1, giro = 0 }, banco, color) {
  if (!definicion || alfa <= 0 || radio <= 0) return;

  const imagen = banco.obtener(definicion.img);

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  ctx.translate(x, y);
  if (giro) ctx.rotate(giro);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = radio * 0.4;

  if (imagen) {
    const lado = radio * 2;
    const escala = lado / Math.max(imagen.width, imagen.height);
    ctx.drawImage(
      imagen,
      (-imagen.width * escala) / 2,
      (-imagen.height * escala) / 2,
      imagen.width * escala,
      imagen.height * escala,
    );
  } else if (!dibujarFigura(ctx, definicion.figura, radio, color)) {
    dibujarSustituto(ctx, radio, color);
  }
  ctx.restore();
}

const TAU = Math.PI * 2;

/**
 * El anillo que se llena mientras sostenes la mano sobre un objeto.
 *
 * Es la unica señal de que el sostenido esta pasando, y por eso arranca arriba y
 * gira como un reloj: cualquiera entiende un reloj sin que nadie se lo explique.
 * La pista tenue de atras existe para que el blanco activo se distinga de los
 * otros cuatro incluso con el anillo casi vacio.
 */
export function dibujarAnilloDeProgreso(ctx, { x, y, radio, progreso, color }) {
  if (progreso <= 0) return;

  const anillo = radio * 1.25;
  const grosor = Math.max(3, radio * 0.14);

  ctx.save();
  ctx.lineCap = 'round';

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.beginPath();
  ctx.arc(x, y, anillo, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = 0.95;
  ctx.shadowColor = color;
  ctx.shadowBlur = grosor * 2;
  ctx.beginPath();
  ctx.arc(x, y, anillo, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, progreso));
  ctx.stroke();

  ctx.restore();
}

/**
 * Achica la letra lo justo para que el texto entre en el ancho disponible.
 *
 * Sin esto, un nombre largo escrito en carreras.json se sale de cuadro, y eso se
 * descubre con publico delante. `medir` se inyecta para poder probarlo sin canvas.
 */
export function tamanoQueEntra(texto, tamanoDeseado, anchoMaximo, medir) {
  const ancho = medir(texto, tamanoDeseado);
  if (ancho <= anchoMaximo || ancho === 0) return tamanoDeseado;
  return Math.max(8, Math.floor(tamanoDeseado * (anchoMaximo / ancho)));
}

/**
 * Parte un texto en lineas que entren en `anchoMaximo`.
 *
 * El texto de cada persona son dos o tres renglones, no una frase suelta: sin
 * cortarlo se sale de la pantalla por los dos lados. Una palabra sola mas ancha
 * que el renglon se deja igual en su linea — cortarla por la mitad se lee peor
 * que dejarla sobresalir, y para eso esta tamanoQueEntra.
 */
export function partirEnLineas(texto, anchoMaximo, medir) {
  const palabras = String(texto ?? '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];

  const lineas = [];
  let actual = palabras[0];

  for (const palabra of palabras.slice(1)) {
    const probada = `${actual} ${palabra}`;
    if (medir(probada) <= anchoMaximo) actual = probada;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  lineas.push(actual);
  return lineas;
}

const FAMILIA = 'system-ui, sans-serif';

/**
 * La ficha de la persona: su nombre y el texto que cuenta quien es.
 *
 * Va sobre un degradado que sube desde el borde de abajo. Sin el, el texto
 * blanco cae encima del fondo de la carrera y se vuelve ilegible en cuanto el
 * fondo tiene una zona clara.
 */
export function dibujarFichaDePersona(ctx, carrera, disposicion, alfa = 1) {
  const persona = carrera?.persona;
  if (!persona || alfa <= 0) return;

  const { ficha, ancho, alto } = disposicion;
  const disponible = ancho - ficha.margen * 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);

  const degradado = ctx.createLinearGradient(0, alto - ficha.alto, 0, alto);
  degradado.addColorStop(0, 'rgba(5, 8, 14, 0)');
  degradado.addColorStop(0.55, 'rgba(5, 8, 14, 0.88)');
  degradado.addColorStop(1, 'rgba(5, 8, 14, 0.96)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, alto - ficha.alto, ancho, ficha.alto);

  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 16;

  const medirCon = (peso) => (contenido, tamano) => {
    ctx.font = `${peso} ${tamano}px ${FAMILIA}`;
    return ctx.measureText(contenido).width;
  };

  const tamanoNombre = tamanoQueEntra(
    persona.nombre,
    ficha.tamanoNombre,
    disponible,
    medirCon(700),
  );
  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${tamanoNombre}px ${FAMILIA}`;
  ctx.fillText(persona.nombre, ancho / 2, ficha.nombreY);

  ctx.font = `400 ${ficha.tamanoTexto}px ${FAMILIA}`;
  const lineas = partirEnLineas(persona.texto, disponible, (t) => ctx.measureText(t).width);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  lineas.forEach((linea, i) => {
    ctx.fillText(linea, ancho / 2, ficha.textoY + i * ficha.tamanoTexto * ficha.interlinea);
  });

  ctx.restore();
}

/** El nombre de la ingenieria, arriba, al lado del objeto elegido. */
export function dibujarNombreDeCarrera(ctx, carrera, disposicion, alfa = 1) {
  if (!carrera || alfa <= 0) return;

  const { ancho, elegido, texto } = disposicion;
  const disponible = ancho * 0.9;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 18;

  const medir = (contenido, tamano) => {
    ctx.font = `700 ${tamano}px ${FAMILIA}`;
    return ctx.measureText(contenido).width;
  };
  const tamano = tamanoQueEntra(carrera.nombre, texto.tamanoNombre * 0.72, disponible, medir);

  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${tamano}px ${FAMILIA}`;
  ctx.fillText(carrera.nombre, ancho / 2, elegido.y + elegido.radio + tamano * 1.35);
  ctx.restore();
}

/** Resplandor lleno: brillante en el centro y apagandose hacia el borde. */
function resplandor(ctx, x, y, radio, color) {
  const degradado = ctx.createRadialGradient(x, y, 0, x, y, radio);
  degradado.addColorStop(0, color);
  degradado.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = degradado;
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, TAU);
  ctx.fill();
}

/**
 * La señal de que las manos sirven para algo.
 *
 * NO dibuja la mano —palma, dedos, nudillos—: eso compite con la mano de verdad,
 * que ya esta ahi en el espejo, y la atencion se va al dibujo. Lo unico que hace
 * falta mostrar es DONDE registra el sistema tu palma, porque es el punto que
 * elige. Sin esto el sostenido es a ciegas: apoyas la mano y no sabes por que no
 * pasa nada.
 */
export function dibujarManos(ctx, manos, color, opciones = {}) {
  if (!manos || manos.length === 0) return;

  const { resplandorFactor = 2.2, nucleoFactor = 0.22 } = opciones;

  ctx.save();
  // Todo en screen: la señal ilumina el video en vez de taparlo, y dos manos que
  // se cruzan se suman sin dejar un recorte sucio.
  ctx.globalCompositeOperation = 'screen';

  for (const mano of manos) {
    const { x, y } = mano.palma;
    const nucleo = mano.radio * nucleoFactor;

    ctx.globalAlpha = 0.35;
    resplandor(ctx, x, y, mano.radio * resplandorFactor, color);

    ctx.globalAlpha = 0.85;
    resplandor(ctx, x, y, nucleo * 2.4, '#ffffff');
  }

  ctx.restore();
}

export function dibujarPersona(ctx, pose, rostro, rectangulo, color) {
  if (!pose && !rostro) return;

  ctx.save();

  if (pose) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, pose.anchoHombros * 0.035);
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.moveTo(pose.hombroIzq.x, pose.hombroIzq.y);
    ctx.quadraticCurveTo(
      pose.centroHombros.x,
      pose.centroHombros.y + pose.anchoHombros * 0.08,
      pose.hombroDer.x,
      pose.hombroDer.y,
    );
    ctx.stroke();
  }

  if (rostro) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(16, 20, 24, 0.28)';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, rostro.radio * 0.045);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(
      rostro.centro.x,
      rostro.centro.y - rostro.radio * 0.38,
      rostro.radio * 0.8,
      rostro.radio * 0.6,
      rostro.angulo,
      Math.PI,
      Math.PI * 2,
    );
    ctx.lineTo(rostro.centro.x + Math.cos(rostro.angulo) * rostro.radio * 0.45, rostro.centro.y);
    ctx.lineTo(rostro.centro.x - Math.cos(rostro.angulo) * rostro.radio * 0.45, rostro.centro.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.stroke();
  }

  ctx.restore();
}

/** El humo, compuesto en `screen`: el negro del video desaparece solo. */
export function dibujarHumo(ctx, video, disposicion, alfa, opacidad = 1) {
  if (!video || alfa <= 0) return;

  const ancho = video.videoWidth || video.width;
  const alto = video.videoHeight || video.height;
  if (!ancho || !alto) return;

  const rectangulo = calcularRectanguloVideo(ancho, alto, disposicion.ancho, disposicion.alto);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, alfa) * opacidad;
  ctx.drawImage(video, rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto);
  ctx.restore();
}

export function dibujarInvitacion(ctx, disposicion, pulso) {
  const { ancho, alto, texto } = disposicion;

  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * pulso;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 24;
  ctx.font = `700 ${texto.tamanoNombre}px ${FAMILIA}`;
  ctx.fillText('Sentate frente al espejo', ancho / 2, alto * 0.5);
  ctx.font = `400 ${texto.tamanoFrase}px ${FAMILIA}`;
  ctx.fillText('y descubrí tu ingeniería', ancho / 2, alto * 0.5 + texto.tamanoNombre);
  ctx.restore();
}

/**
 * La consigna de la eleccion. Es lo unico que le enseña a la persona que tiene
 * que sostener la mano, y por eso nombra el gesto completo: "acercá la mano" no
 * alcanza — la gente la pasa por encima y se va sin elegir nada.
 */
export function dibujarConsigna(ctx, disposicion, alfa = 1) {
  if (alfa <= 0) return;
  const { ancho, alto, texto } = disposicion;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa) * 0.9;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 20;
  ctx.font = `600 ${Math.round(texto.tamanoFrase * 1.15)}px ${FAMILIA}`;
  ctx.fillText('Sostené la mano sobre un objeto', ancho / 2, alto * 0.93);
  ctx.restore();
}

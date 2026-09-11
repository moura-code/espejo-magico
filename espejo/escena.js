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

    // El pie: el nombre de la ingenieria, sobre un degradado que lo despega del
    // fondo. Es el mismo lugar donde las tablets de MAITE ponen su texto, para
    // que espejo y tablets se lean como una sola cosa, y no puede ir al medio,
    // que es donde esta la cara. `base` es la linea de base del ultimo renglon.
    pie: {
      alto: alto * (vertical ? 0.3 : 0.38),
      margen: ancho * 0.08,
      base: alto * (vertical ? 0.84 : 0.8),
      tamano: Math.round(corto * 0.075),
      interlinea: 1.1,
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

/**
 * Cuanto mide lo que se va a dibujar, sea una foto o un video.
 *
 * No es una comodidad: un <video> NO tiene `width` ni `height` utiles —los
 * suyos son `videoWidth` y `videoHeight`, y valen 0 hasta que llega el primer
 * cuadro—. Pasarle `width` a calcularRectanguloVideo da un rectangulo del
 * tamaño de la pantalla, y con el el fondo se dibuja estirado y el objeto se
 * apoya en otro lado. Devuelve null cuando todavia no hay nada que medir, que
 * es la señal para caer a la foto.
 */
export function medidasDe(fuente) {
  if (!fuente) return null;

  const ancho = fuente.videoWidth || fuente.width || 0;
  const alto = fuente.videoHeight || fuente.height || 0;
  return ancho > 0 && alto > 0 ? { ancho, alto } : null;
}

/**
 * Cubre el lienzo con una imagen sin deformarla. Lo que sobra se recorta.
 *
 * `fuente` puede ser una foto o un video: un fondo con movimiento se dibuja
 * exactamente igual, cuadro a cuadro, y por eso el resto de la escena no se
 * entera de cual de los dos le toco.
 *
 * DEVUELVE EL RECTANGULO QUE USO, o null si no habia nada que dibujar. Eso no
 * es una comodidad: el objeto agarrado se apoya en un punto normalizado a ese
 * mismo rectangulo, y calcularlo por segunda vez del lado del llamador es la
 * receta conocida de que los dos caminos se separen y el objeto termine en otro
 * lado del que se dibujo el fondo.
 */
export function dibujarFondo(ctx, fuente, disposicion, alfa = 1) {
  const medidas = medidasDe(fuente);
  if (!medidas || alfa <= 0) return null;

  const rectangulo = calcularRectanguloVideo(
    medidas.ancho,
    medidas.alto,
    disposicion.ancho,
    disposicion.alto,
  );

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  ctx.drawImage(fuente, rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto);
  ctx.restore();
  return rectangulo;
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

/**
 * Lo que va delante de la persona, y solo donde esta la persona: el objeto del
 * fondo que se esta leyendo. Detras, la mano que lo fue a buscar lo tapaba
 * justo cuando crece y se ilumina, y la ficha quedaba hablando de algo que no
 * se ve.
 *
 * Se dibuja en `capa` y se recorta contra `persona` —la capa con la persona ya
 * recortada que dejo dibujarPersonaRecortada— antes de pegarlo: donde nada lo
 * tapa no se dibuja dos veces, ni su sombra ni los bordes del PNG, y donde la
 * mano lo tapaba aparece encima de ella. `objetos` son como los de
 * dibujarObjeto, cada uno con su alfa.
 */
export function dibujarObjetosDelante(ctx, { capa, persona, disposicion, objetos, banco, color }) {
  if (objetos.length === 0) return;
  const { ancho, alto } = disposicion;
  capa.ctx.clearRect(0, 0, ancho, alto);
  for (const objeto of objetos) dibujarObjeto(capa.ctx, objeto, banco, color);

  capa.ctx.save();
  capa.ctx.globalCompositeOperation = 'destination-in';
  capa.ctx.drawImage(persona.canvas, 0, 0);
  capa.ctx.restore();

  ctx.drawImage(capa.canvas, 0, 0);
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
 * figura vectorial si no, y un circulo de `color` como ultimo recurso —el
 * espejo le pasa el dorado de la paleta, el mismo para las doce—. Un objeto
 * que no se dibuja es una opcion que no se puede elegir.
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
 * otros incluso con el anillo casi vacio.
 *
 * Un solo `color` para las doce ingenierias —el color no las distingue— con la
 * transparencia de cada parte: `pista` es la opacidad del anillo completo de
 * atras, `trazo` la del que avanza y `brillo` cuanto resplandece.
 *
 * `alfa` es la opacidad de quien lo dibuja y MULTIPLICA la del anillo, no la
 * reemplaza: el carrusel se apaga desvaneciendose y su anillo tiene que irse
 * con el. Pisandola, el anillo del elegido quedaba entero hasta el ultimo
 * cuadro del apagado y desaparecia de golpe.
 */
export function dibujarAnilloDeProgreso(
  ctx,
  { x, y, radio, progreso, color, alfa = 1, pista = 0.28, trazo = 0.95, brillo = 1 },
) {
  if (progreso <= 0 || alfa <= 0) return;

  const anillo = radio * 1.25;
  const grosor = Math.max(3, radio * 0.14);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;

  ctx.globalAlpha = alfa * pista;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, anillo, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = alfa * trazo;
  ctx.shadowColor = color;
  ctx.shadowBlur = grosor * 2 * brillo;
  ctx.beginPath();
  ctx.arc(x, y, anillo, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, progreso));
  ctx.stroke();

  ctx.restore();
}

/**
 * El disco que se llena detras del objeto mientras se sostiene la mano: el
 * mismo reloj que el anillo, pero relleno y transparente, un poco mas grande
 * que el objeto para que se vea alrededor. Va DEBAJO del objeto —quien lo
 * llama lo dibuja antes—: encima le teñiria la foto.
 *
 * Es una de las opciones de carga con transparencia que pidio explorar la
 * catedra; con `opacidad` en cero no se dibuja y queda solo el anillo.
 */
export function dibujarDiscoDeCarga(
  ctx,
  { x, y, radio, progreso, color, opacidad, alfa = 1, radioFactor },
) {
  if (progreso <= 0 || opacidad <= 0 || alfa <= 0) return;

  ctx.save();
  ctx.globalAlpha = alfa * opacidad;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radio * radioFactor, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, progreso));
  ctx.closePath();
  ctx.fill();
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

/**
 * Las dos tipografias, y la division es la MISMA que hacen las tablets de MAITE
 * (`--font-display` y `--font-body` en sus temas): espejo y retratos estan a
 * dos metros uno del otro en el stand y tienen que leerse como una sola
 * instalacion.
 *
 * `titulo` es Muffaroo, la que los cuatro temas de tablet ponen en
 * `--font-display` (el style.css base dice Germania One, pero ninguna tablet
 * la muestra). Trae UNA sola variante (Regular, 400): pedirle 700 le da un
 * falso-bold que le arruina las formas, asi que todo lo que la use va en 400.
 * Es una display condensada, en versales y sin serifas: el respaldo es una sans
 * condensada, para que si el archivo faltara el cambio no pase de un cambio de
 * fuente.
 *
 * `texto` es la sans del sistema, y no es una concesion: a tamaño de parrafo la
 * display cuesta leerla, y la consigna hay que entenderla de un vistazo. MAITE
 * llego a la misma conclusion.
 *
 * `TITULO_SOLO` es el nombre de la familia sin respaldo, que es lo que hay que
 * pasarle a document.fonts.load(): el canvas NO dispara la carga de una fuente.
 */
export const TITULO_SOLO = "'Muffaroo'";
export const FAMILIA_TITULO = `${TITULO_SOLO}, 'Arial Narrow', sans-serif`;
export const FAMILIA_TEXTO = 'system-ui, sans-serif';

/** Muffaroo no tiene negrita: se dibuja siempre en 400. */
export const PESO_TITULO = 400;

/**
 * El nombre de la ingenieria, al pie, donde antes iba el de la persona.
 *
 * Va sobre un degradado que sube desde el borde de abajo. Sin el, el nombre cae
 * encima del fondo de la carrera y se vuelve ilegible en cuanto el fondo tiene
 * una zona clara. Un nombre largo va en dos renglones antes que achicarse hasta
 * lo ilegible; y si aun asi no entra, se achica.
 *
 * `color` es el mismo para las doce: la catedra pidio no distinguir las
 * ingenierias por color, y el que se usa es el de los nombres en las tablets
 * de MAITE, que estan a dos metros en el mismo stand.
 */
export function dibujarNombreDeCarrera(ctx, carrera, disposicion, alfa = 1, color = '#ffffff') {
  if (!carrera || alfa <= 0) return;

  const { pie, ancho, alto } = disposicion;
  const disponible = ancho - pie.margen * 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);

  const degradado = ctx.createLinearGradient(0, alto - pie.alto, 0, alto);
  degradado.addColorStop(0, 'rgba(5, 8, 14, 0)');
  degradado.addColorStop(0.55, 'rgba(5, 8, 14, 0.88)');
  degradado.addColorStop(1, 'rgba(5, 8, 14, 0.96)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, alto - pie.alto, ancho, pie.alto);

  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 16;

  const medir = (contenido, tamano) => {
    ctx.font = `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
    return ctx.measureText(contenido).width;
  };

  // Primero se intenta entero; si no entra, en dos renglones; y cada renglon
  // se achica lo justo si sigue sin entrar (una sola palabra kilometrica).
  let lineas = [carrera.nombre];
  if (medir(carrera.nombre, pie.tamano) > disponible) {
    lineas = partirEnLineas(carrera.nombre, disponible, (t) => medir(t, pie.tamano)).slice(0, 2);
  }
  const tamano = Math.min(
    ...lineas.map((linea) => tamanoQueEntra(linea, pie.tamano, disponible, medir)),
  );

  ctx.fillStyle = color;
  ctx.font = `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
  const paso = tamano * pie.interlinea;
  lineas.forEach((linea, i) => {
    ctx.fillText(linea, ancho / 2, pie.base - (lineas.length - 1 - i) * paso);
  });

  ctx.restore();
}

/**
 * El objeto agarrado, apoyado en su lugar del fondo.
 *
 * Debajo lleva un halo de `color` —el dorado de la paleta—: lo presenta sobre
 * cualquier fondo, foto o escena vectorial, sin pedirle a cada imagen que tenga
 * una mesa justo ahi. `giro` es la inclinacion de la flotacion o del vaiven.
 */
export function dibujarObjetoApoyado(
  ctx,
  { definicion, x, y, radio, alfa = 1, giro = 0, halo = 0 },
  banco,
  color,
) {
  if (!definicion || alfa <= 0 || radio <= 0) return;

  if (halo > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alfa) * halo;
    resplandor(ctx, x, y, radio * 2.2, color);
    ctx.restore();
  }

  dibujarObjeto(ctx, { definicion, x, y, radio, alfa, giro }, banco, color);
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
export function dibujarManos(ctx, manos, color, opciones = {}, alfa = 1) {
  if (!manos || manos.length === 0 || alfa <= 0) return;

  const { resplandorFactor = 2.2, nucleoFactor = 0.22 } = opciones;

  ctx.save();
  // Todo en screen: la señal ilumina el video en vez de taparlo, y dos manos que
  // se cruzan se suman sin dejar un recorte sucio.
  ctx.globalCompositeOperation = 'screen';

  for (const mano of manos) {
    // Cada mano trae su alfa —el del desvanecedor, que la prende y la apaga de
    // a poco— y el de quien dibuja multiplica: nunca se prende de golpe.
    const presencia = (mano.alfa ?? 1) * Math.min(1, alfa);
    if (presencia <= 0) continue;
    const { x, y } = mano.palma;
    const nucleo = mano.radio * nucleoFactor;

    ctx.globalAlpha = 0.35 * presencia;
    resplandor(ctx, x, y, mano.radio * resplandorFactor, color);

    ctx.globalAlpha = 0.85 * presencia;
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

  const medidas = medidasDe(video);
  if (!medidas) return;

  const rectangulo = calcularRectanguloVideo(
    medidas.ancho,
    medidas.alto,
    disposicion.ancho,
    disposicion.alto,
  );

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, alfa) * opacidad;
  ctx.drawImage(video, rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto);
  ctx.restore();
}

/**
 * La invitacion del reposo. `pulso` es la respiracion del texto y `alfa` su
 * entrada y su salida: aparecer de golpe encima de las nubes que se cierran, o
 * irse de golpe cuando alguien se sienta, era un golpe de luz.
 */
export function dibujarInvitacion(ctx, disposicion, pulso, alfa = 1) {
  if (alfa <= 0) return;
  const visible = Math.min(1, alfa);
  const { ancho, alto, texto } = disposicion;
  const centro = alto * 0.5;

  // Su propia sombra debajo. Las nubes del reposo le pasan por delante y a veces
  // quedan blancas justo detras del texto: sin esto, la invitacion desaparecia
  // cada vez que un jiron le pasaba por encima.
  const halo = ctx.createRadialGradient(
    ancho / 2,
    centro + texto.tamanoNombre * 0.2,
    0,
    ancho / 2,
    centro + texto.tamanoNombre * 0.2,
    ancho * 0.62,
  );
  halo.addColorStop(0, 'rgba(4,7,12,0.62)');
  halo.addColorStop(0.55, 'rgba(4,7,12,0.28)');
  halo.addColorStop(1, 'rgba(4,7,12,0)');
  ctx.save();
  ctx.globalAlpha = visible;
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = (0.65 + 0.35 * pulso) * visible;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 24;
  ctx.font = `${PESO_TITULO} ${texto.tamanoNombre}px ${FAMILIA_TITULO}`;
  ctx.fillText('Sentate frente al espejo', ancho / 2, centro);
  ctx.font = `400 ${texto.tamanoFrase}px ${FAMILIA_TEXTO}`;
  ctx.fillText('y descubrí tu ingeniería', ancho / 2, centro + texto.tamanoNombre);
  ctx.restore();
}

/**
 * La consigna: la unica instruccion de cada momento de la experiencia. Nombra
 * el gesto completo: "acercá la mano" no alcanza — la gente la pasa por encima
 * y se va sin elegir nada.
 *
 * Hay dos, y la frase la decide quien dibuja: la de la eleccion (la de por
 * defecto), que se apaga con el carrusel, y la de explorar el fondo, que se va
 * la primera vez que alguien abre una ficha.
 */
export function dibujarConsigna(ctx, disposicion, alfa = 1, frase = 'Sostené la mano sobre un objeto') {
  if (alfa <= 0) return;
  const { ancho, alto, texto } = disposicion;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa) * 0.9;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 20;
  // La consigna va en la sans a proposito: es la unica instruccion de toda la
  // experiencia y tiene que entenderse de un vistazo, desde lejos y de costado.
  ctx.font = `600 ${Math.round(texto.tamanoFrase * 1.15)}px ${FAMILIA_TEXTO}`;
  ctx.fillText(frase, ancho / 2, alto * 0.93);
  ctx.restore();
}

const esTexto = (valor) => typeof valor === 'string' && valor.trim().length > 0;
const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/**
 * Donde va la ficha de un objeto del fondo y como se reparte adentro. Solo
 * numeros: `medir(texto, fuente)` se inyecta para poder probarla sin lienzo.
 * Devuelve null si no hay nada que decir.
 *
 * LA FICHA NO LE TAPA LA CARA A LA PERSONA. Va en la columna del costado de su
 * objeto —`columna` es cuanto mide, en pixeles, la franja de cada costado a la
 * que no llega la persona—: la misma periferia donde la catedra pidio que
 * vayan los objetos, y por el mismo motivo. Por eso es angosta y alta, y no un
 * cartel al lado del objeto: al lado seria encima de la cara.
 *
 * Nunca encima del objeto que describe: va debajo si el objeto esta arriba y
 * arriba si esta abajo, y si del lado que le toca no entra, del otro. Tampoco
 * baja hasta el pie, que es del nombre de la ingenieria.
 *
 * `tipografia` es el tamaño de la letra en fraccion de `texto.tamanoFrase`
 * —`texto` la descripcion, `titulo` el nombre— y `anchoEnLetras` el ancho
 * maximo del panel, en tamaños de letra. Se calibra en el stand, leyendo a dos
 * metros: vive en CONFIG.fichas.tipografia. En una pantalla mas ancha que el
 * espejo, la letra se achica como la composicion (`unidad`).
 */
export function disponerFicha(
  { x, y, radio },
  { nombre, descripcion } = {},
  disposicion,
  medir,
  { columna, evitar = [], tipografia } = {},
) {
  const hayNombre = esTexto(nombre);
  const hayDescripcion = esTexto(descripcion);
  if (!hayNombre && !hayDescripcion) return null;

  // La letra vive en CONFIG.fichas.tipografia y no tiene copia aca: sin ella
  // esto falla en el acto, en vez de dibujar con numeros viejos.
  const { texto: letraDelTexto, titulo: letraDelTitulo, anchoEnLetras } = tipografia;
  const { ancho, alto, pie, texto, unidad } = disposicion;
  // La letra acompaña a la composicion, como los objetos (lugarEnPantalla): en
  // el espejo es la de la pantalla, y en un monitor apaisado, donde la
  // composicion vertical entra a la altura de la pantalla, se achica con ella.
  // Con la letra de la pantalla, la ficha de cada objeto tapaba a su vecino.
  const escala = unidad / Math.min(ancho, alto);
  const tamanoTexto = Math.max(10, Math.round(texto.tamanoFrase * escala * letraDelTexto));
  const tamanoTituloPedido = Math.max(12, Math.round(texto.tamanoFrase * escala * letraDelTitulo));
  const relleno = Math.round(tamanoTexto * 0.75);
  const margen = Math.round(tamanoTexto * 0.6);
  const separacion = Math.round(tamanoTexto * 0.5);
  const interlinea = tamanoTexto * 1.3;
  const fuenteDelTitulo = (tamano) => `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
  const fuenteTexto = `400 ${tamanoTexto}px ${FAMILIA_TEXTO}`;

  const anchoColumna = columna ?? ancho * 0.3;
  const anchoCaja = Math.max(
    tamanoTexto * 6,
    Math.min(tamanoTexto * anchoEnLetras, anchoColumna - margen * 2),
  );
  const util = anchoCaja - relleno * 2;

  // El nombre va entero si entra; si no, en dos renglones —"Lector de código
  // de barras" no entra en la columna a tamaño de titulo—, y si aun asi un
  // renglon no entra (una palabra sola muy larga), se achica lo justo. Sin
  // medirlo, se salia del panel y de la pantalla.
  let renglonesDelTitulo = [];
  let tamanoTitulo = tamanoTituloPedido;
  if (hayNombre) {
    const medirTitulo = (linea, tamano = tamanoTituloPedido) => medir(linea, fuenteDelTitulo(tamano));
    renglonesDelTitulo = [nombre.trim()];
    if (medirTitulo(renglonesDelTitulo[0]) > util) {
      const partes = partirEnLineas(nombre, util, (linea) => medirTitulo(linea));
      renglonesDelTitulo = partes.length <= 2 ? partes : [partes[0], partes.slice(1).join(' ')];
    }
    tamanoTitulo = Math.min(
      ...renglonesDelTitulo.map((linea) => tamanoQueEntra(linea, tamanoTituloPedido, util, medirTitulo)),
    );
  }

  const lineas = hayDescripcion
    ? partirEnLineas(descripcion, util, (linea) => medir(linea, fuenteTexto))
    : [];
  const pasoDelTitulo = tamanoTitulo * 1.05;
  const altoTitulo = renglonesDelTitulo.length * pasoDelTitulo;
  const hueco = hayNombre && lineas.length > 0 ? tamanoTexto * 0.4 : 0;
  const altoCaja = relleno * 2 + altoTitulo + hueco + lineas.length * interlinea;

  // De costado: centrada en su objeto, sin salirse de la columna de ese lado.
  const aLaIzquierda = x < ancho / 2;
  const desdeX = aLaIzquierda ? margen : ancho - anchoColumna + margen;
  const hastaX = aLaIzquierda ? anchoColumna - margen - anchoCaja : ancho - margen - anchoCaja;
  const cajaX = acotar(x - anchoCaja / 2, desdeX, Math.max(desdeX, hastaX));

  // De alto: del lado del objeto donde haya lugar, sin llegar al pie.
  const techo = margen;
  const piso = alto - pie.alto;
  const debajo = y + radio + separacion;
  const arriba = y - radio - separacion - altoCaja;
  const entraDebajo = debajo + altoCaja <= piso;
  const entraArriba = arriba >= techo;
  // Del lado que le toca si ahi la ficha —corrida hacia su objeto lo que haga
  // falta para entrar en la pantalla— no tapa a su objeto ni a otro del fondo
  // (`evitar`): la persona tiene que poder ir de un objeto al siguiente sin que
  // la ficha del primero le esconda el que sigue. Correrla unos pixeles hacia
  // su objeto le come parte del aire que los separa, que sobra; irse del otro
  // lado por medio pixel de redondeo, en cambio, tapaba a un vecino. Si no, del
  // otro lado; y si en ninguno se puede todo, del que entra sin correrse.
  const yDe = (lado) =>
    acotar(lado === 'abajo' ? debajo : arriba, techo, Math.max(techo, piso - altoCaja));
  const entra = (lado) => (lado === 'abajo' ? entraDebajo : entraArriba);
  const tapa = (arribaDeLaCaja, otro) => {
    const cercaX = acotar(otro.x, cajaX, cajaX + anchoCaja);
    const cercaY = acotar(otro.y, arribaDeLaCaja, arribaDeLaCaja + altoCaja);
    return Math.hypot(otro.x - cercaX, otro.y - cercaY) < otro.radio;
  };
  const sirve = (lado) => {
    const arribaDeLaCaja = yDe(lado);
    return (
      !tapa(arribaDeLaCaja, { x, y, radio }) &&
      !evitar.some((otro) => tapa(arribaDeLaCaja, otro))
    );
  };
  const orden = y < (techo + piso) / 2 ? ['abajo', 'arriba'] : ['arriba', 'abajo'];
  const lado = orden.find(sirve) ?? orden.find(entra) ?? orden[0];
  const cajaY = yDe(lado);

  const esquina = Math.round(tamanoTexto * 0.55);
  const punta = Math.round(tamanoTexto * 0.45);
  const caja = { x: cajaX, y: cajaY, ancho: anchoCaja, alto: altoCaja, radio: esquina };
  const alTexto = cajaX + relleno;
  const primeraLinea = cajaY + relleno + altoTitulo + hueco;

  return {
    lado,
    caja,
    relleno,
    fuenteTexto,
    titulo: hayNombre
      ? {
          fuente: fuenteDelTitulo(tamanoTitulo),
          lineas: renglonesDelTitulo.map((renglon, i) => ({
            texto: renglon,
            x: alTexto,
            y: cajaY + relleno + i * pasoDelTitulo,
          })),
        }
      : null,
    lineas: lineas.map((linea, i) => ({
      texto: linea,
      x: alTexto,
      y: primeraLinea + i * interlinea + (interlinea - tamanoTexto) / 2,
    })),
    // El pico que apunta al objeto, sobre el borde de la caja que lo mira.
    pico: {
      x: acotar(x, cajaX + esquina + punta, cajaX + anchoCaja - esquina - punta),
      y: lado === 'abajo' ? cajaY : cajaY + altoCaja,
      alto: lado === 'abajo' ? -punta : punta,
      ancho: punta,
    },
  };
}

/**
 * La ficha de un objeto del fondo: su nombre y una descripcion corta, en un
 * panel oscuro con el pico apuntando al objeto. Se enciende con `alfa` y entra
 * deslizandose desde el objeto, apenas, como si saliera de el.
 *
 * Los colores son los de MAITE: el titulo en el de los nombres y el texto en el
 * de los textos de las tablets, sobre un panel del mismo negro. El titulo va en
 * la tipografia de titulo y la descripcion en la sans, que es la division que
 * hacen las tablets.
 */
export function dibujarFicha(
  ctx,
  { x, y, radio, nombre, descripcion, alfa = 1 },
  disposicion,
  { columna, colores, evitar, tipografia },
) {
  if (alfa <= 0 || (!esTexto(nombre) && !esTexto(descripcion))) return;

  // Se mide adentro del save: medir cambia la letra del lienzo, y afuera la
  // dejaria cambiada para todo lo que se dibuja despues.
  ctx.save();
  const medir = (texto, fuente) => {
    ctx.font = fuente;
    return ctx.measureText(texto).width;
  };
  const ficha = disponerFicha({ x, y, radio }, { nombre, descripcion }, disposicion, medir, {
    columna,
    evitar,
    tipografia,
  });

  const visible = Math.min(1, alfa);
  const suave = visible * visible * (3 - 2 * visible);
  const hacia = ficha.lado === 'abajo' ? -1 : 1;
  ctx.translate(0, (1 - suave) * ficha.relleno * 0.8 * hacia);
  ctx.globalAlpha = visible;

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = ficha.relleno * 1.4;
  ctx.fillStyle = colores.panel;
  ctx.beginPath();
  trazarPanel(ctx, ficha.caja, ficha.pico);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = colores.borde;
  ctx.lineWidth = Math.max(1, ficha.relleno * 0.07);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (ficha.titulo) {
    ctx.fillStyle = colores.titulo;
    ctx.font = ficha.titulo.fuente;
    for (const renglon of ficha.titulo.lineas) ctx.fillText(renglon.texto, renglon.x, renglon.y);
  }
  ctx.fillStyle = colores.texto;
  ctx.font = ficha.fuenteTexto;
  for (const linea of ficha.lineas) ctx.fillText(linea.texto, linea.x, linea.y);

  ctx.restore();
}

/**
 * El contorno del panel con su pico, en un solo trazo. Con el pico como una
 * figura aparte, el borde le dibujaba una raya en la base, como si estuviera
 * pegado con cinta. El pico va en el borde de arriba si apunta hacia arriba
 * (`pico.alto` negativo) y en el de abajo si apunta hacia abajo.
 */
function trazarPanel(ctx, { x, y, ancho, alto, radio }, pico) {
  const derecha = x + ancho;
  const abajo = y + alto;

  ctx.moveTo(x + radio, y);
  if (pico.alto < 0) {
    ctx.lineTo(pico.x - pico.ancho, y);
    ctx.lineTo(pico.x, y + pico.alto);
    ctx.lineTo(pico.x + pico.ancho, y);
  }
  ctx.arcTo(derecha, y, derecha, abajo, radio);
  ctx.arcTo(derecha, abajo, x, abajo, radio);
  if (pico.alto > 0) {
    ctx.lineTo(pico.x + pico.ancho, abajo);
    ctx.lineTo(pico.x, abajo + pico.alto);
    ctx.lineTo(pico.x - pico.ancho, abajo);
  }
  ctx.arcTo(x, abajo, x, y, radio);
  ctx.arcTo(x, y, derecha, y, radio);
  ctx.closePath();
}

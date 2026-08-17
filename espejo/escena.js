// El dibujo de la escena. No sabe que existe MediaPipe ni la maquina de estados:
// recibe que dibujar y lo dibuja.

import { dibujarFigura } from './figuras.js';

export function calcularDisposicion(ancho, alto) {
  const vertical = alto >= ancho;
  const alturaTexto = alto * (vertical ? 0.16 : 0.22);
  const corto = Math.min(ancho, alto);

  return {
    ancho,
    alto,
    vertical,
    // Hasta el borde: un piso mas arriba se lee como una repisa invisible. Los
    // textos se dibujan despues de los objetos, asi que quedan encima igual.
    caja: { x: 0, y: 0, ancho, alto },
    unidad: Math.min(ancho, alto * 0.5625),
    texto: {
      nombreY: alto - alturaTexto * 0.55,
      fraseY: alto - alturaTexto * 0.18,
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

export function recortarFueraDeCara(ctx, rostro, disposicion) {
  if (!rostro) return false;

  ctx.beginPath();
  ctx.rect(0, 0, disposicion.ancho, disposicion.alto);
  ctx.ellipse(
    rostro.centro.x,
    rostro.centro.y + rostro.radio * 0.35,
    rostro.radio * 1.25,
    rostro.radio * 1.75,
    rostro.angulo ?? 0,
    0,
    Math.PI * 2,
  );
  ctx.clip('evenodd');
  return true;
}

export function dibujarFueraDeCara(ctx, rostro, disposicion, dibujar) {
  ctx.save();
  recortarFueraDeCara(ctx, rostro, disposicion);
  dibujar();
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

const TAU = Math.PI * 2;

// Valores de respaldo, para que la funcion se pueda dibujar y probar sola. Los
// del evento salen de CONFIG.manos.senal.
const SENAL = {
  resplandorFactor: 2.2,
  nucleoFactor: 0.22,
  anchoAnilloFactor: 0.5,
  anillos: 2,
  periodoMs: 1500,
};

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

/** Banda de luz difusa: transparente, color al medio, transparente. */
function banda(ctx, x, y, radio, ancho, color) {
  const degradado = ctx.createRadialGradient(
    x,
    y,
    Math.max(0, radio - ancho),
    x,
    y,
    radio + ancho,
  );
  degradado.addColorStop(0, 'rgba(0,0,0,0)');
  degradado.addColorStop(0.5, color);
  degradado.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = degradado;
  ctx.beginPath();
  ctx.arc(x, y, radio + ancho, 0, TAU);
  ctx.fill();
}

/**
 * Donde esta el anillo `indice` en su viaje hacia la palma: 0 recien salido del
 * borde del campo, 1 llegando al centro. Los anillos se reparten el ciclo para
 * que la señal sea continua y no un latido con huecos.
 *
 * El doble modulo tolera un reloj negativo sin devolver una fase fuera de rango.
 */
export function faseDeAnillo(ahora, periodoMs, indice, cantidad) {
  const desfase = cantidad > 0 ? indice / cantidad : 0;
  return (((ahora / periodoMs + desfase) % 1) + 1) % 1;
}

/** Donde cae el anillo: nace en el borde del campo y termina sobre la palma. */
export function radioDeAnillo(alcance, nucleo, fase) {
  return alcance + (nucleo - alcance) * fase;
}

/**
 * La señal de que las manos sirven para algo.
 *
 * NO dibuja la mano. Dibujarla —palma, dedos, nudillos— compite con la mano de
 * verdad, que ya esta ahi en el espejo: quedan dos manos superpuestas y la
 * atencion se va al dibujo. Lo que hay que mostrar es lo unico que no se ve, que
 * es el campo del iman.
 *
 * Por eso los anillos viajan HACIA la palma y no hacia afuera: es el mismo
 * movimiento que van a hacer los objetos. Alguien que pasa por delante entiende
 * en un segundo que puede estirar la mano, sin ningun cartel que se lo diga.
 *
 * El tamaño no es decorativo: el anillo nace en el alcance real del campo
 * (`alcanceFactor`, el mismo de la fisica), asi que ademas enseña hasta donde
 * llega. Y como el radio de la mano crece al abrirla, la señal crece con ella.
 */
export function dibujarManos(ctx, manos, color, opciones = {}) {
  if (!manos || manos.length === 0) return;

  const { ahora = 0, alcanceFactor = 3.2, atrae = true } = opciones;
  const senal = { ...SENAL, ...opciones.senal };

  ctx.save();

  for (const mano of manos) {
    const { x, y } = mano.palma;
    const radio = mano.radio;
    const nucleo = radio * senal.nucleoFactor;

    // Todo va en screen: la señal ilumina el video en vez de taparlo, y dos
    // manos que se cruzan se suman sin dejar un recorte sucio.
    ctx.globalCompositeOperation = 'screen';

    // 1. Resplandor: "esta mano existe para el sistema". Ancho y muy tenue, para
    //    que se lea como presencia y no como un disco pegado encima.
    ctx.globalAlpha = 0.4;
    resplandor(ctx, x, y, radio * senal.resplandorFactor, color);

    // 2. Bandas de luz cerrandose sobre la palma. Difusas a proposito: un aro
    //    de linea fina se lee como un borde —"hasta aca"— y lo que hay que decir
    //    es lo contrario. En modo golpe no se dibujan: ahi la mano es una paleta,
    //    no un iman, y no hay campo que mostrar.
    if (atrae) {
      const alcance = radio * alcanceFactor;
      const ancho = radio * senal.anchoAnilloFactor;

      for (let i = 0; i < senal.anillos; i++) {
        const fase = faseDeAnillo(ahora, senal.periodoMs, i, senal.anillos);
        // Entra tenue desde el borde y se concentra al llegar: el pico va hacia
        // el final del viaje, que es lo que hace leer "se junta acá".
        ctx.globalAlpha = 0.45 * Math.sin(fase * Math.PI) * (0.55 + 0.45 * fase);
        banda(ctx, x, y, radioDeAnillo(alcance, nucleo, fase), ancho, color);
      }
    }

    // 3. Nucleo: de donde cuelga el racimo. Difuso tambien — un disco de borde
    //    duro se lee como un puntero y desvia la atencion de la mano.
    ctx.globalAlpha = 0.8;
    resplandor(ctx, x, y, nucleo * 2.4, '#ffffff');
  }

  ctx.restore();
}

export function dibujarPersona(ctx, pose, rostro, rectangulo, color) {
  if (!pose && !rostro) return;

  ctx.save();

  const mascara = pose?.mascara?.canvas;
  if (mascara) {
    // El espejado se deshace con restore(), no reponiendo la identidad a mano:
    // setTransform(1,0,0,1,0,0) pisaria cualquier transformacion que el llamador
    // ya tuviera puesta.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(rectangulo.x + rectangulo.ancho, rectangulo.y);
    ctx.scale(-1, 1);
    ctx.drawImage(mascara, 0, 0, rectangulo.ancho, rectangulo.alto);
    ctx.restore();
  }

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

export function dibujarTextos(ctx, carrera, disposicion, alfa = 1) {
  if (!carrera || alfa <= 0) return;
  const { texto, ancho } = disposicion;
  const disponible = ancho * MARGEN_TEXTO;

  const medirCon = (peso, familia) => (contenido, tamano) => {
    ctx.font = `${peso} ${tamano}px ${familia}`;
    return ctx.measureText(contenido).width;
  };

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;

  const medirNombre = medirCon(700, 'system-ui, sans-serif');
  const tamanoNombre = tamanoQueEntra(carrera.nombre, texto.tamanoNombre, disponible, medirNombre);
  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${tamanoNombre}px system-ui, sans-serif`;
  ctx.fillText(carrera.nombre, ancho / 2, texto.nombreY);

  if (carrera.frase) {
    const medirFrase = medirCon(400, 'system-ui, sans-serif');
    const tamanoFrase = tamanoQueEntra(carrera.frase, texto.tamanoFrase, disponible, medirFrase);
    ctx.fillStyle = '#ffffff';
    ctx.font = `400 ${tamanoFrase}px system-ui, sans-serif`;
    ctx.fillText(carrera.frase, ancho / 2, texto.fraseY);
  }
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
  ctx.font = `700 ${texto.tamanoNombre}px system-ui, sans-serif`;
  ctx.fillText('Sentate frente al espejo', ancho / 2, alto * 0.5);
  ctx.font = `400 ${texto.tamanoFrase}px system-ui, sans-serif`;
  ctx.fillText('y descubrí tu ingeniería', ancho / 2, alto * 0.5 + texto.tamanoNombre);
  ctx.restore();
}

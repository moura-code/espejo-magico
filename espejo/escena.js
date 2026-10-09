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

    // El pie: el nombre de la ingenieria, sobre una sombra ceñida al texto que lo
    // despega del fondo. Es el mismo lugar donde las tablets de MAITE ponen su texto, para
    // que espejo y tablets se lean como una sola cosa, y no puede ir al medio,
    // que es donde esta la cara. `base` es la linea de base del ultimo renglon.
    pie: {
      alto: alto * (vertical ? 0.3 : 0.38),
      margen: ancho * 0.08,
      base: alto * (vertical ? 0.84 : 0.8),
      tamano: Math.round(corto * 0.075),
      interlinea: 1.1,
    },

    // Contra el lado corto, para que la misma pantalla de la misma letra parada o
    // acostada. Eran 0,055 y 0,03: en la pantalla de 47" del stand las frases
    // quedaban en 1,7 cm y se pidieron mas grandes para leerlas a dos metros.
    texto: {
      tamanoNombre: Math.round(corto * 0.07),
      tamanoFrase: Math.round(corto * 0.04),
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
 * Donde entra la foto del fondo: ENTERA, sin deformarla y centrada.
 *
 * No cubre la pantalla como el video de la camara, y es a proposito: los
 * objetos de un fondo generado estan pintados ADENTRO de la foto, y cubrir una
 * pantalla de otra proporcion recorta justo donde estan. En la notebook la
 * foto vertical se agrandaba al ancho, solo se veia su franja del medio y los
 * objetos de arriba quedaban afuera. En el espejo la foto y la pantalla tienen
 * la misma proporcion, y entera o cubriendo es lo mismo.
 */
export function calcularRectanguloDelFondo(fotoAncho, fotoAlto, ancho, alto) {
  if (!fotoAncho || !fotoAlto) return { x: 0, y: 0, ancho, alto };

  const escala = Math.min(ancho / fotoAncho, alto / fotoAlto);
  const anchoDibujo = fotoAncho * escala;
  const altoDibujo = fotoAlto * escala;

  return {
    x: (ancho - anchoDibujo) / 2,
    y: (alto - altoDibujo) / 2,
    ancho: anchoDibujo,
    alto: altoDibujo,
  };
}

/**
 * Pone la foto del fondo entera en el lienzo, sin deformarla
 * (calcularRectanguloDelFondo). Si en esa pantalla no la llena, lo que queda
 * libre se cubre con `relleno` —crearRellenoDelFondo: la escena extendida si
 * hay `extension`, la misma foto desenfocada si no—, y solo eso: debajo de la
 * foto no, porque mientras el fondo entra se veria a traves de ella.
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
export function dibujarFondo(ctx, fuente, disposicion, alfa = 1, relleno = null, extension = null) {
  const medidas = medidasDe(fuente);
  if (!medidas || alfa <= 0) return null;

  const { ancho, alto } = disposicion;
  const rectangulo = calcularRectanguloDelFondo(medidas.ancho, medidas.alto, ancho, alto);
  const derecha = rectangulo.x + rectangulo.ancho;
  const abajo = rectangulo.y + rectangulo.alto;
  // Lo que la foto deja libre: los costados en una pantalla mas ancha que ella,
  // arriba y abajo en una mas angosta. Medio pixel no es un hueco.
  const huecos = [
    { x: 0, y: 0, ancho: rectangulo.x, alto },
    { x: derecha, y: 0, ancho: ancho - derecha, alto },
    { x: rectangulo.x, y: 0, ancho: rectangulo.ancho, alto: rectangulo.y },
    { x: rectangulo.x, y: abajo, ancho: rectangulo.ancho, alto: alto - abajo },
  ].filter((hueco) => hueco.ancho >= 0.5 && hueco.alto >= 0.5);

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  const lienzoDeRelleno =
    huecos.length > 0 ? relleno?.obtener(fuente, disposicion, extension) : null;
  if (lienzoDeRelleno) {
    for (const hueco of huecos) {
      const { x, y, ancho: anchoHueco, alto: altoHueco } = hueco;
      ctx.drawImage(lienzoDeRelleno, x, y, anchoHueco, altoHueco, x, y, anchoHueco, altoHueco);
    }
  }
  ctx.drawImage(fuente, rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto);
  ctx.restore();
  return rectangulo;
}

/**
 * Lo que va donde la foto del fondo no llega: la misma foto, agrandada hasta
 * cubrir la pantalla, desenfocada y oscurecida. Se lee como la escena que sigue
 * fuera de foco, no como una banda negra al costado.
 *
 * Desenfocar una foto entera es caro, asi que se hace UNA vez por foto y por
 * medida de ventana, en un lienzo aparte (`crearLienzo` se inyecta, como en
 * crearBancoDeEscenarios), y cada cuadro es un drawImage. Con un fondo con
 * movimiento queda el cuadro del primer pedido: fuera de foco no se nota.
 *
 * `desenfoque` es el radio en fraccion del lado corto de la pantalla; `brillo`,
 * cuanto queda de la luz de la foto.
 *
 * CON `extension` LOS COSTADOS SON LA ESCENA MISMA. Es la version apaisada del
 * fondo (imagen-apaisada.jpg): la misma escena extendida a 16:9 por el
 * generador, con la foto centrada a todo el alto. Dibujada a la escala de la
 * foto y centrada en ella, sus costados continuan la foto, nitidos y con su
 * luz. Va encima de la desenfocada, que queda a la vista solo donde la
 * extension no llega: en una pantalla mas ancha que 16:9.
 */
export function crearRellenoDelFondo({ crearLienzo, desenfoque, brillo }) {
  let lienzo = null;
  let fuenteDibujada = null;
  let extensionDibujada = null;

  return {
    obtener(fuente, { ancho, alto }, extension = null) {
      if (
        lienzo &&
        fuente === fuenteDibujada &&
        extension === extensionDibujada &&
        lienzo.width === ancho &&
        lienzo.height === alto
      ) {
        return lienzo;
      }
      const medidas = medidasDe(fuente);
      if (!medidas) return null;

      lienzo ??= crearLienzo();
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d');
      // El desenfoque mira mas alla del borde, donde no hay nada, y lo
      // oscureceria: la foto se pone un poco mas grande que la pantalla.
      const radio = desenfoque * Math.min(ancho, alto);
      const cubre = calcularRectanguloVideo(medidas.ancho, medidas.alto, ancho + radio * 4, alto + radio * 4);
      ctx.save();
      ctx.filter = `blur(${radio}px) brightness(${brillo})`;
      ctx.drawImage(fuente, cubre.x - radio * 2, cubre.y - radio * 2, cubre.ancho, cubre.alto);
      ctx.restore();

      const medidasDeExtension = medidasDe(extension);
      if (medidasDeExtension) {
        // La foto cae donde la pone calcularRectanguloDelFondo; la extension se
        // dibuja a su alto y centrada en ella, para que la foto calce en su medio.
        const foto = calcularRectanguloDelFondo(medidas.ancho, medidas.alto, ancho, alto);
        const anchoDeExtension = (foto.alto * medidasDeExtension.ancho) / medidasDeExtension.alto;
        ctx.save();
        ctx.filter = 'none';
        ctx.drawImage(
          extension,
          foto.x + (foto.ancho - anchoDeExtension) / 2,
          foto.y,
          anchoDeExtension,
          foto.alto,
        );
        ctx.restore();
      }

      fuenteDibujada = fuente;
      extensionDibujada = extension;
      return lienzo;
    },
  };
}

/**
 * Tratamiento comun para que las fotos de carreras distintas se lean como una
 * misma instalacion. El velo azul baja el ruido de color, la vineta reserva el
 * centro y la luz tibia separa a la persona sin dibujarle un contorno falso.
 */
export function dibujarTratamientoDeFondo(ctx, disposicion, alfa = 1) {
  if (alfa <= 0) return;

  const { ancho, alto } = disposicion;
  const corto = Math.min(ancho, alto);
  const visible = Math.min(1, alfa);

  ctx.save();

  ctx.globalAlpha = visible * 0.18;
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, ancho, alto);

  const vineta = ctx.createRadialGradient(
    ancho / 2,
    alto * 0.42,
    corto * 0.18,
    ancho / 2,
    alto * 0.42,
    Math.max(ancho, alto) * 0.78,
  );
  vineta.addColorStop(0, 'rgba(0,0,0,0)');
  vineta.addColorStop(0.58, 'rgba(0,0,0,0.05)');
  vineta.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.globalAlpha = visible;
  ctx.fillStyle = vineta;
  ctx.fillRect(0, 0, ancho, alto);

  const aura = ctx.createRadialGradient(
    ancho / 2,
    alto * 0.4,
    0,
    ancho / 2,
    alto * 0.4,
    corto * 0.48,
  );
  aura.addColorStop(0, 'rgba(240,220,160,0.14)');
  aura.addColorStop(0.55, 'rgba(240,220,160,0.05)');
  aura.addColorStop(1, 'rgba(240,220,160,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, ancho, alto);

  ctx.restore();
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
 *
 * `pintar` es como se dibuja cada uno. Por defecto es el PNG; los fondos
 * generados pasan el que recorta el objeto de la propia foto. La capa y el
 * recorte contra la persona son los mismos en los dos casos, y por eso esto no
 * sabe cual de los dos le toco.
 */
export function dibujarObjetosDelante(
  ctx,
  { capa, persona, disposicion, objetos, banco, color, pintar = null },
) {
  if (objetos.length === 0) return;
  const { ancho, alto } = disposicion;
  capa.ctx.clearRect(0, 0, ancho, alto);
  const dibujarUno = pintar ?? ((destino, objeto) => dibujarObjeto(destino, objeto, banco, color));
  for (const objeto of objetos) dibujarUno(capa.ctx, objeto);

  capa.ctx.save();
  capa.ctx.globalCompositeOperation = 'destination-in';
  capa.ctx.drawImage(persona.canvas, 0, 0);
  capa.ctx.restore();

  ctx.drawImage(capa.canvas, 0, 0);
}

/**
 * Donde cae en pantalla una caja normalizada a la imagen del fondo. `caja` es
 * `[x0, y0, x1, y1]` y `rectangulo` es donde se dibujo la foto (lo devuelve
 * dibujarFondo). Es la misma cuenta que lugarEnLaFoto (vuelo.js) hace para un
 * punto —el blanco de la mano del mismo objeto—, y por el mismo motivo sale de
 * aca y no del llamador: calcularla dos veces es la receta conocida de que el
 * recorte se separe de la foto de la que sale. NO es la de lugarEnPantalla, que
 * recompone la escena para los objetos sueltos: fuera del 9:16 se separan.
 */
export function cajaEnPantalla(caja, rectangulo) {
  const [x0, y0, x1, y1] = caja;
  return {
    x: rectangulo.x + x0 * rectangulo.ancho,
    y: rectangulo.y + y0 * rectangulo.alto,
    ancho: (x1 - x0) * rectangulo.ancho,
    alto: (y1 - y0) * rectangulo.alto,
  };
}

/**
 * Un objeto que YA ESTA EN LA FOTO, recortado de ella.
 *
 * Los fondos generados (herramientas/escenas.py) traen los cinco instrumentos
 * pintados ADENTRO de la escena, con la luz, la sombra de contacto y el reflejo
 * de esa mesada. No hay ningun PNG que dibujar encima, y por eso en reposo aca
 * no se dibuja nada: el objeto ya se ve, es parte de la foto.
 *
 * Lo unico que hace falta es poder SACARLO de la foto cuando la mano pasa por
 * arriba —para levantarlo, iluminarlo y ponerlo delante de la persona—, y para
 * eso cada objeto trae su `mascara`: la silueta con la que se lo pinto. Se
 * recorta de `fuente`, que es la MISMA foto o el mismo video que se dibujo de
 * fondo; asi el pedazo que se levanta es exactamente el que estaba ahi.
 *
 * `capa` es un lienzo aparte, como el de la persona: el recorte necesita dos
 * pasadas —la foto y despues la mascara en `destination-in`— y hacerlas sobre
 * el lienzo principal se llevaria puesto todo lo que ya esta dibujado.
 *
 * `crecer` y `brillo` son lo que lo despega de su propio hueco: crece desde su
 * centro, de manera que el objeto se separa del agujero que deja sin correrse
 * de lugar.
 */
export function dibujarRecorte(
  ctx,
  { fuente, mascara, caja, rectangulo, crecer = 1, brillo = 0, alfa = 1 },
  capa,
) {
  if (!fuente || !mascara || !caja || !capa || alfa <= 0) return;
  const medidas = medidasDe(fuente);
  if (!medidas) return;

  const destino = cajaEnPantalla(caja, rectangulo);
  const ancho = Math.ceil(destino.ancho);
  const alto = Math.ceil(destino.alto);
  if (ancho < 2 || alto < 2) return;

  // La capa se ajusta al objeto, no a la pantalla: el `destination-in` de abajo
  // toca el lienzo ENTERO, y sobre uno de 1080x1920 son dos millones de pixeles
  // por cuadro para recortar algo que mide doscientos. Cambiar la medida
  // ademas lo deja limpio, que es justo lo que hace falta.
  const [x0, y0, x1, y1] = caja;
  if (capa.canvas.width !== ancho || capa.canvas.height !== alto) {
    capa.canvas.width = ancho;
    capa.canvas.height = alto;
  } else {
    capa.ctx.clearRect(0, 0, ancho, alto);
  }
  capa.ctx.drawImage(
    fuente,
    x0 * medidas.ancho,
    y0 * medidas.alto,
    (x1 - x0) * medidas.ancho,
    (y1 - y0) * medidas.alto,
    0,
    0,
    ancho,
    alto,
  );
  capa.ctx.save();
  capa.ctx.globalCompositeOperation = 'destination-in';
  capa.ctx.drawImage(mascara, 0, 0, ancho, alto);
  capa.ctx.restore();

  const cx = destino.x + destino.ancho / 2;
  const cy = destino.y + destino.alto / 2;
  const w = ancho * crecer;
  const h = alto * crecer;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  // El brillo es lo que dice "este". Sin el, el objeto levantado se confunde
  // con el hueco del que salio, que tiene exactamente su forma.
  if (brillo > 0) ctx.filter = `brightness(${1 + brillo})`;
  ctx.drawImage(capa.canvas, 0, 0, ancho, alto, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/**
 * Un objeto FOTOGRAFIADO adentro de una foto real, levantado de ella.
 *
 * Es el hermano de dibujarRecorte para los fondos que no se generaron: una
 * foto de verdad con los objetos adentro, y el PNG de cada uno aparte. Ahi no
 * hay mascara con que sacar el objeto de la foto, y no hace falta: su PNG ya
 * calza exacto sobre el que se ve (herramientas/ubicar.py lo busco adentro de
 * la foto y escribio su `caja`). Lo que se levanta es ese PNG, en su caja, y
 * sin el no se dibuja nada: la foto ya muestra el objeto.
 *
 * `crecer` y `brillo` son los de dibujarRecorte: crece desde su centro, para no
 * correrse de lugar, y se ilumina. La caja se mide con cajaEnPantalla, sobre el
 * mismo `rectangulo` con que se dibujo la foto: calcularla aparte es la receta
 * conocida de que el objeto levantado se separe del que se ve.
 *
 * `resplandor` es un halo de `color` que sigue la SILUETA del PNG —el
 * shadowBlur del lienzo, con la imagen de molde—, `desenfoque` lados cortos de
 * ancho. Es lo que lo despega de la foto en vez de crecer: el objeto de la foto
 * sigue debajo, y agrandado se veria doble. Va con la opacidad del objeto, asi
 * que entra y sale con el.
 */
export function dibujarFotoDelObjeto(
  ctx,
  {
    imagen,
    caja,
    rectangulo,
    crecer = 1,
    brillo = 0,
    alfa = 1,
    resplandor = 0,
    desenfoque = 0,
    color = null,
  },
) {
  if (!imagen || !caja || !rectangulo || alfa <= 0) return;
  const destino = cajaEnPantalla(caja, rectangulo);
  if (destino.ancho < 1 || destino.alto < 1) return;

  const ancho = destino.ancho * crecer;
  const alto = destino.alto * crecer;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  if (brillo > 0) ctx.filter = `brightness(${1 + brillo})`;
  if (resplandor > 0 && color) {
    ctx.shadowColor = conOpacidad(color, Math.min(1, resplandor));
    ctx.shadowBlur = desenfoque * Math.min(ancho, alto);
  }
  ctx.drawImage(
    imagen,
    destino.x + (destino.ancho - ancho) / 2,
    destino.y + (destino.alto - alto) / 2,
    ancho,
    alto,
  );
  ctx.restore();
}

/** Un color '#rrggbb' con una opacidad: 'rgba(r, g, b, opacidad)'. */
function conOpacidad(hex, opacidad) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacidad})`;
}

/**
 * El resplandor que delata a un objeto escondido en la foto. Es lo que
 * reemplaza al vaiven de los PNG: un objeto pintado adentro de la escena no se
 * puede mecer, y sin ninguna señal nadie sabe que ahi hay algo para tocar.
 *
 * Va DEBAJO de la persona y muy tenue: si se leyera como un boton alrededor del
 * objeto volveriamos al sticker que este fondo existe para sacar.
 */
export function dibujarLatido(ctx, { x, y, radio, intensidad, color }) {
  if (!(intensidad > 0) || !(radio > 0)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, intensidad);
  resplandor(ctx, x, y, radio * 1.9, color);
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
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radio, 0, Math.PI * 2);
    ctx.clip();
    const lado = radio * 2;
    const escala = lado / Math.max(imagen.width, imagen.height);
    ctx.drawImage(
      imagen,
      (-imagen.width * escala) / 2,
      (-imagen.height * escala) / 2,
      imagen.width * escala,
      imagen.height * escala,
    );
    ctx.restore();
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
 * Va sobre una sombra que se desvanece SOLO DETRAS DE LAS LETRAS. Sin nada, el
 * nombre cae encima del fondo de la carrera y se vuelve ilegible en cuanto el
 * fondo tiene una zona clara; con una franja a lo ancho —lo que habia antes,
 * subiendo desde el borde hasta casi el negro— se leia, pero se comia un tercio
 * del fondo y le oscurecia el cuerpo a la persona. Es la misma idea que la
 * sombra de las tablets de MAITE (temas/tablet-3.css): una elipse anclada al
 * texto. Un nombre largo va en dos renglones antes que achicarse hasta lo
 * ilegible; y si aun asi no entra, se achica.
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
  const paso = tamano * pie.interlinea;

  // La sombra, ceñida al texto: una elipse que se desvanece, centrada en los
  // renglones y apenas mas grande que ellos. Es un circulo de radio 1 con el
  // lienzo estirado a la medida del texto, porque un degradado radial no se
  // puede hacer eliptico de otra manera.
  const anchoDelTexto = Math.max(...lineas.map((linea) => medir(linea, tamano)));
  const arriba = pie.base - (lineas.length - 1) * paso - tamano * 0.8;
  ctx.save();
  ctx.translate(ancho / 2, (arriba + pie.base) / 2);
  ctx.scale(anchoDelTexto / 2 + tamano * 1.1, (pie.base - arriba) / 2 + tamano * 0.7);
  const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  sombra.addColorStop(0, 'rgba(5, 5, 10, 0.55)');
  sombra.addColorStop(0.5, 'rgba(5, 5, 10, 0.3)');
  sombra.addColorStop(1, 'rgba(5, 5, 10, 0)');
  ctx.fillStyle = sombra;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Una linea corta basta para que el pie se lea como una pieza editorial y
  // no como texto suelto sobre el cuerpo. Usa el mismo dorado que el nombre.
  const yDeLaLinea = alto - pie.alto * 0.8;
  ctx.beginPath();
  ctx.moveTo(ancho * 0.39, yDeLaLinea);
  ctx.lineTo(ancho * 0.61, yDeLaLinea);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, disposicion.unidad * 0.0025);
  ctx.globalAlpha = Math.min(1, alfa) * 0.58;
  ctx.stroke();
  ctx.globalAlpha = Math.min(1, alfa);

  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 16;

  ctx.fillStyle = color;
  ctx.font = `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
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

    // Las fotos recortadas vienen de fuentes distintas. Esta base comun evita
    // que parezcan stickers sueltos y, a la vez, marca el area interactiva sin
    // agregar texto ni otro icono alrededor de la persona.
    ctx.save();
    ctx.globalAlpha = Math.min(1, alfa);
    ctx.fillStyle = 'rgba(5,8,14,0.58)';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, radio * 0.035);
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = radio * 0.32;
    ctx.beginPath();
    ctx.arc(x, y, radio * 1.14, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, alfa) * 0.52;
    ctx.stroke();
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
export function dibujarConsigna(
  ctx,
  disposicion,
  alfa = 1,
  frase = 'Sostené la mano sobre un objeto',
) {
  if (alfa <= 0) return;
  const { ancho, alto, texto } = disposicion;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa) * 0.9;
  ctx.textAlign = 'center';
  // La consigna va en la sans a proposito: es la unica instruccion de toda la
  // experiencia y tiene que entenderse de un vistazo, desde lejos y de costado.
  const tamano = Math.round(texto.tamanoFrase * 1.15);
  ctx.font = `600 ${tamano}px ${FAMILIA_TEXTO}`;
  const lineas = partirEnLineas(frase, ancho * 0.85, (linea) => ctx.measureText(linea).width);
  const paso = tamano * 1.2;
  const base = alto * 0.93;

  // La pastilla separa la instruccion del titulo y evita que dependa de una
  // zona oscura concreta de cada fotografia. Es deliberadamente compacta: el
  // pie sigue perteneciendo a la escena, no a una interfaz de botones.
  const rellenoX = tamano * 1.05;
  const rellenoY = tamano * 0.48;
  const anchoDelTexto = Math.max(...lineas.map((linea) => ctx.measureText(linea).width));
  const altoDelTexto = tamano + (lineas.length - 1) * paso;
  const panel = {
    x: (ancho - Math.min(ancho * 0.88, anchoDelTexto + rellenoX * 2)) / 2,
    y: base - altoDelTexto - rellenoY,
    ancho: Math.min(ancho * 0.88, anchoDelTexto + rellenoX * 2),
    alto: altoDelTexto + rellenoY * 1.65,
    radio: tamano * 0.72,
  };
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = tamano * 0.7;
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.beginPath();
  trazarPanel(ctx, panel);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(240,220,160,0.22)';
  ctx.lineWidth = Math.max(1, tamano * 0.045);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 20;
  lineas.forEach((linea, i) => {
    ctx.fillText(linea, ancho / 2, base - (lineas.length - 1 - i) * paso);
  });
  ctx.restore();
}

const esTexto = (valor) => typeof valor === 'string' && valor.trim().length > 0;

/**
 * Donde va la ficha de un objeto del fondo y como se reparte adentro. Solo
 * numeros: `medir(texto, fuente)` se inyecta para poder probarla sin lienzo.
 * Devuelve null si no hay nada que decir.
 *
 * LA FICHA VA ARRIBA DE LA CABEZA, EN UN CARTEL ANCHO, y no al costado de su
 * objeto. Al costado compartia con los objetos la franja angosta de la
 * periferia: con objetos grandes y una letra que se lea a dos metros, dos
 * objetos y sus dos fichas no entraban por costado, y la ficha de uno tapaba al
 * otro. Arriba de la cabeza hay una franja libre del ancho de la composicion:
 * ahi la descripcion entra en dos o tres renglones con letra grande, y los
 * costados quedan para los objetos. De cual habla lo dice el objeto, que crece
 * y se ilumina mientras se lee (aspectoDelObjeto).
 *
 * `hasta` es donde empieza la cabeza, en pixeles de la pantalla: la ficha no
 * baja de ahi. Si una descripcion no entrara con la letra pedida, la letra se
 * achica lo justo —antes chica que encima de la cara—;
 * tests/integracion/fichas.test.js vigila que con el catalogo real no haga
 * falta.
 *
 * `tipografia` es el tamaño de la letra en fraccion de `texto.tamanoFrase`
 * —`texto` la descripcion, `titulo` el nombre—. Se calibra en el stand,
 * leyendo a dos metros: vive en CONFIG.fichas.tipografia. En una pantalla mas
 * ancha que el espejo, la letra y el cartel se achican como la composicion
 * (`unidad`).
 */
export function disponerFicha(textos, disposicion, medir, { hasta, tipografia } = {}) {
  // La letra vive en CONFIG.fichas.tipografia y no tiene copia aca: sin ella
  // esto falla en el acto, en vez de dibujar con numeros viejos. Y sin saber
  // donde empieza la cara no hay donde ponerla.
  if (!tipografia || !(hasta > 0)) {
    throw new Error('disponerFicha necesita la tipografia y hasta donde puede bajar');
  }
  // La letra del cartel acompaña a la composicion, como los objetos sueltos
  // (lugarEnPantalla): en el espejo es la de la pantalla, y en un monitor
  // apaisado, donde la composicion vertical entra a la altura de la
  // pantalla, se achica con ella, igual que la franja donde va.
  const composicion = disposicion.unidad / Math.min(disposicion.ancho, disposicion.alto);
  let ficha = armarFicha(textos, disposicion, medir, tipografia, composicion);
  for (
    let achique = 0.96;
    ficha && ficha.caja.y + ficha.caja.alto > hasta && achique > 0.3;
    achique -= 0.04
  ) {
    ficha = armarFicha(textos, disposicion, medir, tipografia, composicion * achique);
  }
  return ficha;
}

/**
 * La ficha de un objeto del fondo, puesta donde le corresponde. Es el par de
 * `fichaDelObjeto` (escondites.js), que es quien decide cual de las dos: con
 * `ancla` va pegada debajo del objeto, y sin ella en el cartel de arriba de la
 * cabeza. La eleccion vive en un solo lado y la usan el espejo, la herramienta
 * y las pruebas; armada por separado en cada uno, el espejo podia cambiar y las
 * pruebas seguir en verde.
 */
export function disponerFichaDeObjeto(textos, disposicion, medir, opciones = {}) {
  return opciones.ancla
    ? disponerFichaDebajo(textos, disposicion, medir, { objeto: opciones.ancla, ...opciones })
    : disponerFicha(textos, disposicion, medir, opciones);
}

/**
 * La ficha DEBAJO de su objeto, que es donde va cuando el objeto vive adentro
 * de la foto.
 *
 * El cartel ancho de arriba de la cabeza existia porque los objetos eran PNGs
 * grandes pegados en la periferia y no habia forma de poner texto al lado sin
 * tapar al vecino. Con el objeto integrado a la escena el problema cambia: de
 * cual habla ya no hay que adivinarlo —el objeto se levanta de la foto y se
 * ilumina— pero el texto tiene que estar PEGADO a el, si no la mirada va y
 * vuelve entre dos puntos lejanos de la pantalla.
 *
 * Va centrada bajo el objeto y acotada a la pantalla. Si abajo no entra, se
 * pasa arriba; y si tampoco, se achica la letra, igual que la de arriba de la
 * cabeza. `tests/integracion/fichas.test.js` lo vigila con el catalogo real.
 */
export function disponerFichaDebajo(
  textos,
  disposicion,
  medir,
  { objeto, otros = [], tipografia, anchoFactor = 0.46, hueco = 0.3, distancia = 2 } = {},
) {
  if (!tipografia || !objeto) {
    throw new Error('disponerFichaDebajo necesita la tipografia y el objeto');
  }
  const { ancho, alto } = disposicion;
  // LA FICHA DE LA PANTALLA, NO DE LA COMPOSICION. La letra (escala 1, la de
  // la pantalla) y el ancho se miden contra el lado corto, que es el mismo
  // parada o acostada: se achicaban con la composicion vertical, y en la
  // pantalla de 47" acostada la descripcion quedaba en 18 px, un centimetro de
  // letra para leer a dos metros.
  const corto = Math.min(ancho, alto);
  const anchoPedido = Math.max(corto * 0.3, corto * anchoFactor);
  const aire = objeto.radio * hueco;

  // DONDE PUEDE PARARSE, en orden de preferencia. Debajo y centrada es lo que
  // se lee mejor —el texto cuelga de la cosa—, pero en la columna de la
  // periferia hay otro objeto mas abajo y el cartel se lo comeria: la persona
  // iria a buscar algo que la propia ficha le tapo. Por eso la segunda opcion
  // corre el cartel HACIA EL CENTRO, que es la unica franja sin objetos; y si
  // abajo no hay lugar, las mismas dos arriba.
  const haciaElCentro = objeto.x <= ancho / 2 ? 1 : -1;
  const lugares = (caja) => {
    const abajo = objeto.y + objeto.radio + aire;
    const arriba = objeto.y - objeto.radio - aire - caja.alto;
    const aLaAltura = objeto.y - caja.alto / 2;
    const centrada = objeto.x - caja.ancho / 2;
    const corrida =
      haciaElCentro > 0
        ? objeto.x + objeto.radio + aire
        : objeto.x - objeto.radio - aire - caja.ancho;
    return [
      { x: centrada, y: abajo },
      { x: corrida, y: abajo },
      { x: corrida, y: aLaAltura },
      { x: centrada, y: arriba },
      { x: corrida, y: arriba },
    ];
  };

  // EL PIE ES ZONA PROHIBIDA. Ahi va el nombre de la ingenieria, sobre su
  // degradado, y se dibuja DESPUES que las fichas: una ficha que baje hasta ahi
  // queda con medio texto tapado por el nombre. Pasaba con los dos objetos de
  // abajo, que son los que mas cerca estan del pie.
  const pisoUtil = alto - (disposicion.pie?.alto ?? 0);
  const limpia = (caja) =>
    caja.y >= 0 &&
    caja.y + caja.alto <= pisoUtil &&
    !tocaAlgunCirculo(caja, [objeto, ...otros]);

  // La ficha con la letra pedida y el lugar limpio mas cercano para ella: se
  // buscan una sola vez, con la primera vuelta, y los usan los dos recursos de
  // abajo.
  let entera = null;
  let libre = null;
  for (let achique = 1; achique > 0.55; achique -= 0.07) {
    const base = armarFicha(textos, disposicion, medir, tipografia, achique, anchoPedido);
    if (!base) return null;
    const margen = base.caja.y; // el que armarFicha ya calculo
    let primera = null;
    for (const { x, y } of lugares(base.caja)) {
      const caja = {
        ...base.caja,
        x: Math.min(Math.max(margen, x), ancho - margen - base.caja.ancho),
        // Acotada a la pantalla SIEMPRE: aunque ninguna posicion quede limpia y
        // haya que mostrarla igual, una ficha con el texto cortado por el borde
        // no se lee.
        y: Math.min(Math.max(0, y), Math.max(0, alto - base.caja.alto)),
      };
      primera ??= caja;
      if (limpia(caja)) return moverFicha(base, caja.x - base.caja.x, caja.y - base.caja.y);
    }
    // Ninguno de sus sitios queda libre con la letra pedida. Antes de
    // achicarla, el lugar limpio mas cercano, si queda pegado al objeto: en una
    // foto real con los objetos apretados —la probeta de Alimentos contra los
    // tubos Falcon— el sitio de arriba rozaba al vecino por pocos pixeles, y
    // achicandose entraba debajo con letra chica. Mas lejos no: ahi ya parece
    // la ficha del vecino, y conviene achicarse para quedar a su lado.
    if (!entera) {
      entera = base;
      libre = lugarLimpioMasCercano(entera.caja, objeto, disposicion, limpia);
      if (libre && libre.distancia <= distancia * objeto.radio) {
        return moverFicha(entera, libre.x - entera.caja.x, libre.y - entera.caja.y);
      }
    }
    // Con la letra mas chica el cartel es mas bajo y puede entrar donde no
    // entraba. Si ni achicandose encuentra lugar, el sitio limpio mas cercano
    // al objeto, con la letra pedida, aunque quede lejos: pasa con un objeto en
    // un rincon de abajo y otro justo encima, como las placas de Petri de la
    // foto de Quimica. Y si tampoco hay, se muestra igual en el primer sitio:
    // una ficha que no aparece es peor que una que pisa un borde.
    if (achique <= 0.62) {
      if (libre) return moverFicha(entera, libre.x - entera.caja.x, libre.y - entera.caja.y);
      return moverFicha(base, primera.x - base.caja.x, primera.y - base.caja.y);
    }
  }
  return null;
}

/**
 * El sitio de la pantalla mas cercano a `objeto` donde `caja` queda limpia. Es
 * el ultimo recurso de disponerFichaDebajo, cuando ninguno de sus sitios de
 * siempre queda libre. Recorre la pantalla de a un octavo de la ficha y despues
 * afina alrededor del mejor, de a pocos pixeles: con el paso grueso solo, la
 * ficha quedaba un paso entero mas lejos de lo que hacia falta. Null si no hay
 * ninguno.
 */
function lugarLimpioMasCercano(caja, objeto, { ancho, alto }, limpia) {
  const margen = caja.y; // el que armarFicha ya calculo
  const buscar = (desde, hasta, paso, mejor) => {
    const x1 = Math.min(hasta.x, ancho - margen - caja.ancho);
    const y1 = Math.min(hasta.y, alto - caja.alto);
    for (let y = Math.max(0, desde.y); y <= y1; y += paso) {
      for (let x = Math.max(margen, desde.x); x <= x1; x += paso) {
        if (!limpia({ ...caja, x, y })) continue;
        const cercaX = Math.max(x, Math.min(objeto.x, x + caja.ancho));
        const cercaY = Math.max(y, Math.min(objeto.y, y + caja.alto));
        const distancia = Math.hypot(objeto.x - cercaX, objeto.y - cercaY);
        if (!mejor || distancia < mejor.distancia) mejor = { x, y, distancia };
      }
    }
    return mejor;
  };
  const paso = Math.max(6, Math.min(caja.ancho, caja.alto) / 8);
  const grueso = buscar({ x: 0, y: 0 }, { x: ancho, y: alto }, paso, null);
  if (!grueso) return null;
  return buscar(
    { x: grueso.x - paso, y: grueso.y - paso },
    { x: grueso.x + paso, y: grueso.y + paso },
    3,
    grueso,
  );
}

/** Si la caja toca alguno de los circulos. */
function tocaAlgunCirculo(caja, circulos) {
  return circulos.some(({ x, y, radio }) => {
    const cercaX = Math.max(caja.x, Math.min(x, caja.x + caja.ancho));
    const cercaY = Math.max(caja.y, Math.min(y, caja.y + caja.alto));
    return Math.hypot(x - cercaX, y - cercaY) < radio;
  });
}

/** La misma ficha, corrida. Todo lo que lleva coordenadas se mueve junto. */
function moverFicha(ficha, dx, dy) {
  if (!ficha || (dx === 0 && dy === 0)) return ficha;
  const correr = (linea) => ({ ...linea, x: linea.x + dx, y: linea.y + dy });
  return {
    ...ficha,
    caja: { ...ficha.caja, x: ficha.caja.x + dx, y: ficha.caja.y + dy },
    titulo: ficha.titulo ? { ...ficha.titulo, lineas: ficha.titulo.lineas.map(correr) } : null,
    lineas: ficha.lineas.map(correr),
  };
}

/**
 * La ficha armada con la letra pedida por `escala` (1 es la de la pantalla).
 * Quien la llama decide si la letra acompaña a la composicion o no.
 */
function armarFicha(
  { nombre, descripcion } = {},
  disposicion,
  medir,
  tipografia,
  escala,
  anchoPedido = null,
) {
  const hayNombre = esTexto(nombre);
  const hayDescripcion = esTexto(descripcion);
  if (!hayNombre && !hayDescripcion) return null;

  const { texto: letraDelTexto, titulo: letraDelTitulo } = tipografia;
  const { ancho, texto, unidad } = disposicion;
  const tamanoTexto = Math.max(10, Math.round(texto.tamanoFrase * escala * letraDelTexto));
  const tamanoTituloPedido = Math.max(12, Math.round(texto.tamanoFrase * escala * letraDelTitulo));
  const relleno = Math.round(tamanoTexto * 0.75);
  const margen = Math.round(tamanoTexto * 0.6);
  const interlinea = tamanoTexto * 1.3;
  const fuenteDelTitulo = (tamano) => `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
  const fuenteTexto = `400 ${tamanoTexto}px ${FAMILIA_TEXTO}`;

  // A lo ancho de la composicion: en el espejo, la pantalla entera; en un
  // monitor apaisado, la franja del medio, donde esta la persona. La ficha que
  // va debajo de su objeto pide un ancho menor, para no taparle el vecino.
  const anchoCaja = Math.min(ancho, anchoPedido ?? unidad) - margen * 2;
  const util = anchoCaja - relleno * 2;

  // El nombre va entero si entra; si no, en dos renglones, y si aun asi un
  // renglon no entra (una palabra sola muy larga), se achica lo justo. Sin
  // medirlo, "Lector de código de barras" se salia del panel y de la pantalla.
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

  // Arriba de todo y centrada.
  const esquina = Math.round(tamanoTexto * 0.55);
  const caja = { x: (ancho - anchoCaja) / 2, y: margen, ancho: anchoCaja, alto: altoCaja, radio: esquina };
  const alTexto = caja.x + relleno;
  const primeraLinea = caja.y + relleno + altoTitulo + hueco;

  return {
    caja,
    relleno,
    fuenteTexto,
    titulo: hayNombre
      ? {
          fuente: fuenteDelTitulo(tamanoTitulo),
          lineas: renglonesDelTitulo.map((renglon, i) => ({
            texto: renglon,
            x: alTexto,
            y: caja.y + relleno + i * pasoDelTitulo,
          })),
        }
      : null,
    lineas: lineas.map((linea, i) => ({
      texto: linea,
      x: alTexto,
      y: primeraLinea + i * interlinea + (interlinea - tamanoTexto) / 2,
    })),
  };
}

/**
 * La ficha de un objeto del fondo: su nombre y una descripcion corta, en un
 * cartel oscuro. Se enciende con `alfa` y baja apenas al entrar, como un cartel
 * que se descuelga.
 *
 * Donde va depende del fondo. Con `ancla` —el objeto ya puesto en pantalla— va
 * pegada debajo de el, que es lo que corresponde cuando el objeto vive adentro
 * de la foto y se levanta de ella. Sin `ancla`, en el cartel ancho de arriba de
 * la cabeza, que es la unica franja libre cuando los objetos son PNGs grandes
 * repartidos por la periferia.
 *
 * Los colores son los de MAITE: el titulo en el de los nombres y el texto en el
 * de los textos de las tablets, sobre un panel del mismo negro. El titulo va en
 * la tipografia de titulo y la descripcion en la sans, que es la division que
 * hacen las tablets.
 */
export function dibujarFicha(
  ctx,
  { nombre, descripcion, alfa = 1 },
  disposicion,
  { colores, ...opciones },
) {
  if (alfa <= 0 || (!esTexto(nombre) && !esTexto(descripcion))) return;

  // Se mide adentro del save: medir cambia la letra del lienzo, y afuera la
  // dejaria cambiada para todo lo que se dibuja despues.
  ctx.save();
  const medir = (texto, fuente) => {
    ctx.font = fuente;
    return ctx.measureText(texto).width;
  };
  // Lo que dice donde va pasa entero, tal como lo armo fichaDelObjeto: de a
  // uno, `otros` —los demas objetos del fondo, que la ficha de debajo no puede
  // tapar— se perdio en el camino, y la ficha los esquivaba en las pruebas
  // pero no en la pantalla.
  const ficha = disponerFichaDeObjeto({ nombre, descripcion }, disposicion, medir, opciones);
  if (!ficha) {
    ctx.restore();
    return;
  }

  const visible = Math.min(1, alfa);
  const suave = visible * visible * (3 - 2 * visible);
  ctx.translate(0, -(1 - suave) * ficha.relleno * 0.8);
  ctx.globalAlpha = visible;

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = ficha.relleno * 1.4;
  ctx.fillStyle = colores.panel;
  ctx.beginPath();
  trazarPanel(ctx, ficha.caja);
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

/** El contorno del panel, con las esquinas redondeadas, en un solo trazo. */
function trazarPanel(ctx, { x, y, ancho, alto, radio }) {
  const derecha = x + ancho;
  const abajo = y + alto;

  ctx.moveTo(x + radio, y);
  ctx.arcTo(derecha, y, derecha, abajo, radio);
  ctx.arcTo(derecha, abajo, x, abajo, radio);
  ctx.arcTo(x, abajo, x, y, radio);
  ctx.arcTo(x, y, derecha, y, radio);
  ctx.closePath();
}

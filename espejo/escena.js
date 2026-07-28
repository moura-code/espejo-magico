// El dibujo de la escena. No sabe que existe MediaPipe ni la maquina de estados:
// recibe que dibujar y lo dibuja.

import { calcularAnclaje } from './anclaje.js';
import { dibujarFigura } from './figuras.js';

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

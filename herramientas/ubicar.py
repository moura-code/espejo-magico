#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
herramientas/ubicar.py — donde esta cada objeto adentro de una foto real.

PARA QUE

Un fondo FOTOGRAFIADO es una foto de verdad con los objetos de la ingenieria
adentro —apoyados en la mesada, o la maquina misma— y el PNG de cada uno
recortado aparte. El espejo no saca el objeto de la foto: cuando la mano pasa
por encima, levanta su PROPIO PNG, puesto exactamente sobre el que se ve. Para
eso tiene que saber donde esta cada uno, al pixel, y eso es lo que hace esto:
busca cada PNG adentro de la foto —en que lugar y a que tamaño calza— y lo
escribe en el metadata.json del fondo.

COMO

Correlacion normalizada, solo sobre lo opaco del PNG: compara la forma de la
luz y no su nivel, asi que aguanta el JPEG y un retoque de brillo despues de
pegar los objetos. Se busca de grueso a fino: primero en la foto achicada y en
todos los tamaños posibles, despues alrededor de los mejores candidatos, y al
final a resolucion completa.

QUE ESCRIBE, todo normalizado a la foto:

  - `cajas`: donde va el PNG entero de cada objeto, [x0, y0, x1, y1], en el
    orden de `objetos` (el alfabetico de sus carpetas, como el espejo).
  - `lugar`: el del primero —el del carrusel—, centrado en su caja y con su
    lado mas largo de diametro: al aterrizar, el PNG que llega volando cae justo
    encima del que ya esta en la foto.
  - `escondites`: lo mismo para los demas.

USO
    python herramientas/ubicar.py quimica                  # el fondo activo
    python herramientas/ubicar.py quimica --fondo otro     # otro candidato
    python herramientas/ubicar.py quimica --hoja calce.jpg # y una hoja para mirar
                                                           # el calce

Despues, `npm run catalogo` (o `npm start`) para que el espejo lo vea.
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.signal import fftconvolve

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARRERAS = os.path.join(RAIZ, 'contenido', 'carreras')

# Lo que cuenta del PNG para comparar: lo opaco. El borde suave del recorte se
# mezclo con lo que habia detras en la foto, y compararlo ensucia el calce.
OPACO = 0.9
# Un PNG achicado a menos de esto ya no tiene detalle con que compararse.
MINIMO_PX = 10

# El largo de la foto en el nivel grueso y en el medio. El fino es la foto entera.
LARGO_GRUESO = 400
LARGO_MEDIO = 1000
# En el grueso se prueban todos los tamaños, del mas grande que entra en la foto
# a doce veces menos, de a este paso.
PASO_GRUESO = 1.03
CANDIDATOS = 3

# Debajo de esto el calce es dudoso: la consola lo marca para mirarlo en la hoja.
PARECIDO_DUDOSO = 0.85
# Cuanto puede salirse de la foto la caja del PNG entero, en pixeles: un redondeo.
TOLERANCIA_BORDE_PX = 2


def _flotante(imagen):
    return np.asarray(imagen.convert('RGB'), dtype=np.float32) / 255.0


def lo_que_se_ve(png):
    """El PNG recortado a lo que no es transparente, y donde empieza eso adentro del PNG."""
    alfa = np.asarray(png.convert('RGBA'))[:, :, 3]
    filas, columnas = np.nonzero(alfa > 8)
    if len(filas) == 0:
        raise ValueError('el PNG es todo transparente: no hay nada que buscar en la foto')
    x0, y0 = int(columnas.min()), int(filas.min())
    x1, y1 = int(columnas.max()) + 1, int(filas.max()) + 1
    return png.convert('RGBA').crop((x0, y0, x1, y1)), (x0, y0)


def _plantilla(nucleo, ancho, alto):
    """El nucleo a esa medida: su color y el peso de cada pixel (1 donde es opaco)."""
    arreglo = np.asarray(nucleo.resize((ancho, alto), Image.Resampling.LANCZOS),
                         dtype=np.float32) / 255.0
    return arreglo[..., :3], (arreglo[..., 3] > OPACO).astype(np.float32)


def correlacion(imagen, plantilla, peso):
    """
    La correlacion normalizada de `plantilla` contra `imagen` en cada
    desplazamiento valido, mirando solo donde `peso` es 1. Va de -1 a 1: 1 es la
    misma luz, aunque mas clara o con mas contraste.
    """
    n = float(peso.sum())
    peso_dado_vuelta = peso[::-1, ::-1]
    media = (plantilla * peso[..., None]).sum(axis=(0, 1)) / n
    centrada = (plantilla - media) * peso[..., None]
    varianza_plantilla = float((centrada * (plantilla - media)).sum())

    cruzada = 0.0
    varianza_imagen = 0.0
    for canal in range(3):
        i = imagen[..., canal].astype(np.float64)
        suma = fftconvolve(i, peso_dado_vuelta, mode='valid')
        cuadrados = fftconvolve(i * i, peso_dado_vuelta, mode='valid')
        cruzada = cruzada + fftconvolve(i, centrada[::-1, ::-1, canal], mode='valid')
        varianza_imagen = varianza_imagen + cuadrados - suma * suma / n
    return cruzada / np.sqrt(np.maximum(varianza_imagen, 1e-9) * max(varianza_plantilla, 1e-9))


def _mejor(imagen, nucleo, escala, centro=None, margen=None):
    """
    Donde calza mejor el nucleo a `escala` (pixeles de `imagen` por pixel del
    PNG): (parecido, x, y, ancho, alto), con (x, y) la esquina en pixeles de
    `imagen`. Con `centro` y `margen` busca solo a esa distancia de ese centro.
    """
    ancho = round(nucleo.width * escala)
    alto = round(nucleo.height * escala)
    alto_imagen, ancho_imagen = imagen.shape[:2]
    if min(ancho, alto) < MINIMO_PX or ancho > ancho_imagen or alto > alto_imagen:
        return None
    plantilla, peso = _plantilla(nucleo, ancho, alto)
    if peso.sum() < MINIMO_PX * MINIMO_PX:
        return None

    x0, y0 = 0, 0
    region = imagen
    if centro is not None:
        x0 = max(0, int(math.floor(centro[0] - ancho / 2 - margen)))
        y0 = max(0, int(math.floor(centro[1] - alto / 2 - margen)))
        x1 = min(ancho_imagen, int(math.ceil(centro[0] + ancho / 2 + margen)) + 1)
        y1 = min(alto_imagen, int(math.ceil(centro[1] + alto / 2 + margen)) + 1)
        if x1 - x0 < ancho or y1 - y0 < alto:
            return None
        region = imagen[y0:y1, x0:x1]

    mapa = correlacion(region, plantilla, peso)
    fila, columna = np.unravel_index(int(np.argmax(mapa)), mapa.shape)
    return float(mapa[fila, columna]), x0 + int(columna), y0 + int(fila), ancho, alto


def _achicada(foto, largo):
    """La foto con su lado mas largo en `largo` (nunca agrandada) y cuanto se achico."""
    factor = max(1.0, max(foto.size) / largo)
    if factor == 1.0:
        return _flotante(foto), 1.0
    medida = (max(1, round(foto.width / factor)), max(1, round(foto.height / factor)))
    return _flotante(foto.resize(medida, Image.Resampling.LANCZOS)), factor


def _afinar(imagen, factor, nucleo, candidato, rango, paso, margen):
    """Alrededor de un candidato (parecido, escala, cx, cy en pixeles de la foto), en un nivel."""
    _, escala, cx, cy = candidato
    mejor = None
    for k in np.arange(-rango, rango + paso / 2, paso):
        probada = escala * (1 + k)
        hallado = _mejor(imagen, nucleo, probada / factor, centro=(cx / factor, cy / factor),
                         margen=margen)
        if hallado is None:
            continue
        parecido, x, y, ancho, alto = hallado
        if mejor is None or parecido > mejor[0]:
            mejor = (parecido, probada, (x + ancho / 2) * factor, (y + alto / 2) * factor)
    return mejor


def _distintos(candidatos, cuantos, nucleo):
    """Los mejores que no son el mismo calce visto dos veces."""
    elegidos = []
    for candidato in sorted(candidatos, reverse=True):
        _, escala, cx, cy = candidato
        repetido = any(
            abs(escala / otro[1] - 1) < 0.1
            and math.hypot(cx - otro[2], cy - otro[3]) < 0.5 * nucleo.width * escala
            for otro in elegidos
        )
        if not repetido:
            elegidos.append(candidato)
        if len(elegidos) == cuantos:
            break
    return elegidos


def ubicar(foto, png):
    """
    Donde esta `png` adentro de `foto`. Devuelve un dict con `caja_px` —donde va
    el PNG ENTERO, bordes transparentes incluidos, en pixeles de la foto—,
    `escala` —pixeles de la foto por pixel del PNG— y `parecido`, de -1 a 1.
    """
    foto = foto.convert('RGB')
    nucleo, (ox, oy) = lo_que_se_ve(png)
    tope = min(foto.width / nucleo.width, foto.height / nucleo.height)

    # 1. Grueso: la foto achicada, todos los tamaños.
    gruesa, f1 = _achicada(foto, LARGO_GRUESO)
    candidatos = []
    escala = tope / 12
    while escala <= tope:
        hallado = _mejor(gruesa, nucleo, escala / f1)
        if hallado is not None:
            parecido, x, y, ancho, alto = hallado
            candidatos.append((parecido, escala, (x + ancho / 2) * f1, (y + alto / 2) * f1))
        escala *= PASO_GRUESO
    if not candidatos:
        raise ValueError('el PNG no entra en la foto a ningun tamaño')

    # 2. Medio, alrededor de los mejores. 3. Fino, a resolucion completa.
    media, f2 = _achicada(foto, LARGO_MEDIO)
    entera = _flotante(foto)
    afinados = []
    for candidato in _distintos(candidatos, CANDIDATOS, nucleo):
        medio = _afinar(media, f2, nucleo, candidato, rango=0.06, paso=0.0075,
                        margen=math.ceil(2 * f1 / f2) + 2)
        if medio is not None:
            afinados.append(medio)
    if not afinados:
        raise ValueError('no encontre donde calza el PNG')
    medio = max(afinados)
    fino = _afinar(entera, 1.0, nucleo, medio, rango=0.01, paso=0.001,
                   margen=math.ceil(2 * f2) + 2) or medio
    parecido, escala, cx, cy = fino

    # La caja del nucleo, con la medida exacta a la que se lo comparo, y de ahi
    # la del PNG entero.
    ancho, alto = round(nucleo.width * escala), round(nucleo.height * escala)
    x, y = round(cx - ancho / 2), round(cy - alto / 2)
    ex, ey = ancho / nucleo.width, alto / nucleo.height
    caja = (x - ox * ex, y - oy * ey, x - ox * ex + png.width * ex, y - oy * ey + png.height * ey)
    return {'caja_px': caja, 'escala': escala, 'parecido': parecido}


def lugar_de_la_caja(caja, ancho, alto):
    """
    El lugar del espejo que corresponde a una caja normalizada: su centro, y de
    `escala` su lado mas largo en fraccion del ANCHO de la foto, que es como el
    espejo dibuja el PNG que llega volando.
    """
    x0, y0, x1, y1 = caja
    return {
        'x': round((x0 + x1) / 2, 4),
        'y': round((y0 + y1) / 2, 4),
        'escala': round(max(x1 - x0, (y1 - y0) * alto / ancho), 4),
    }


def _normalizada(caja_px, ancho, alto, cual):
    x0, y0, x1, y1 = caja_px
    if (x0 < -TOLERANCIA_BORDE_PX or y0 < -TOLERANCIA_BORDE_PX
            or x1 > ancho + TOLERANCIA_BORDE_PX or y1 > alto + TOLERANCIA_BORDE_PX):
        raise ValueError(f'{cual}: el PNG entero se sale de la foto; recortale los bordes '
                         'transparentes y volve a ubicarlo')
    acotar = lambda valor: min(1.0, max(0.0, valor))  # noqa: E731
    return [round(acotar(x0 / ancho), 5), round(acotar(y0 / alto), 5),
            round(acotar(x1 / ancho), 5), round(acotar(y1 / alto), 5)]


def _primer_archivo(carpeta, nombres):
    presentes = {nombre.lower(): nombre for nombre in os.listdir(carpeta)}
    for nombre in nombres:
        if nombre in presentes:
            return os.path.join(carpeta, presentes[nombre])
    return None


def _fondo_activo(carpeta_carrera):
    with open(os.path.join(carpeta_carrera, 'carrera.json'), encoding='utf-8') as f:
        declarado = json.load(f).get('fondo')
    if declarado:
        return declarado
    fondos = sorted(n for n in os.listdir(os.path.join(carpeta_carrera, 'fondos'))
                    if not n.startswith('.'))
    if not fondos:
        raise ValueError('la carrera no tiene fondos')
    return fondos[0]


def ubicar_fondo(carpeta_carrera, fondo_id=None, salida=sys.stdout, hoja=None):
    """
    Ubica cada objeto de la carrera en la foto de su fondo y lo escribe en el
    metadata.json del fondo (`cajas`, `lugar`, `escondites`), conservando lo
    demas. Devuelve lo que encontro de cada objeto, en orden.
    """
    fondo_id = fondo_id or _fondo_activo(carpeta_carrera)
    carpeta_fondo = os.path.join(carpeta_carrera, 'fondos', fondo_id)
    ruta_meta = os.path.join(carpeta_fondo, 'metadata.json')
    meta = {}
    if os.path.exists(ruta_meta):
        with open(ruta_meta, encoding='utf-8') as f:
            meta = json.load(f)
    if meta.get('recortes') is not None:
        raise ValueError(f'{fondo_id} es un fondo generado: sus objetos se levantan con su '
                         'mascara (recortes), no con su PNG')

    ruta_foto = _primer_archivo(carpeta_fondo, ['imagen.jpg', 'imagen.jpeg', 'imagen.png'])
    if not ruta_foto:
        raise ValueError(f'{carpeta_fondo}: falta la foto (imagen.jpg)')
    foto = Image.open(ruta_foto).convert('RGB')
    ancho, alto = foto.size

    # El orden del espejo: el alfabetico de las carpetas (servidor/descubrimiento.js).
    carpeta_objetos = os.path.join(carpeta_carrera, 'objetos')
    objetos = sorted(n for n in os.listdir(carpeta_objetos) if not n.startswith('.'))
    hallados = []
    for objeto in objetos:
        ruta_png = os.path.join(carpeta_objetos, objeto, 'imagen.png')
        if not os.path.exists(ruta_png):
            raise ValueError(f'{objeto}: falta imagen.png')
        hallado = ubicar(foto, Image.open(ruta_png))
        caja = _normalizada(hallado['caja_px'], ancho, alto, objeto)
        hallados.append({'objeto': objeto, 'caja': caja, 'escala': hallado['escala'],
                         'parecido': hallado['parecido']})
        dudoso = '  <-- revisar' if hallado['parecido'] < PARECIDO_DUDOSO else ''
        print(f'{objeto:<28} caja {caja}  escala {hallado["escala"]:.3f}  '
              f'parecido {hallado["parecido"]:.3f}{dudoso}', file=salida)

    cajas = [h['caja'] for h in hallados]
    lugares = [lugar_de_la_caja(caja, ancho, alto) for caja in cajas]
    nueva = {'lugar': lugares[0], 'escondites': lugares[1:], 'cajas': cajas}
    nueva.update({k: v for k, v in meta.items() if k not in nueva})
    with open(ruta_meta, 'w', encoding='utf-8') as f:
        json.dump(nueva, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'escrito: {ruta_meta}', file=salida)

    if hoja:
        hoja_de_calce(foto, [os.path.join(carpeta_objetos, h['objeto'], 'imagen.png')
                             for h in hallados], hallados, hoja)
        print(f'hoja: {hoja}', file=salida)
    return hallados


def hoja_de_calce(foto, rutas_png, hallados, ruta, largo=1600):
    """
    La foto con la caja de cada objeto y el contorno de su PNG puesto donde se lo
    encontro. Si el calce esta bien, el contorno sigue el borde del objeto que se
    ve en la foto; si esta corrido, se nota enseguida.
    """
    factor = min(1.0, largo / max(foto.size))
    hoja = foto.resize((round(foto.width * factor), round(foto.height * factor)),
                       Image.Resampling.LANCZOS)
    dibujo = ImageDraw.Draw(hoja)
    for ruta_png, hallado in zip(rutas_png, hallados):
        x0, y0, x1, y1 = (v * (hoja.width if i % 2 == 0 else hoja.height)
                          for i, v in enumerate(hallado['caja']))
        medida = (max(1, round(x1 - x0)), max(1, round(y1 - y0)))
        alfa = np.asarray(Image.open(ruta_png).convert('RGBA').resize(medida))[:, :, 3] > 127
        borde = alfa & ~ndimage.binary_erosion(alfa, iterations=2)
        contorno = Image.new('RGBA', medida, (0, 0, 0, 0))
        contorno.putalpha(Image.fromarray((borde * 255).astype(np.uint8)))
        hoja.paste((60, 230, 255), (round(x0), round(y0)), contorno.getchannel('A'))
        dibujo.rectangle((x0, y0, x1, y1), outline=(240, 220, 160), width=2)
        dibujo.text((x0 + 6, y0 + 4), f'{hallado["objeto"]} · {hallado["parecido"]:.2f}',
                    fill=(240, 220, 160))
    hoja.save(ruta, quality=92)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('carrera', help='id de la carrera (su carpeta en contenido/carreras)')
    ap.add_argument('--fondo', help='id del fondo (por defecto, el activo de carrera.json)')
    ap.add_argument('--hoja', metavar='RUTA', help='guardar una hoja para mirar el calce')
    args = ap.parse_args()

    carpeta = os.path.join(CARRERAS, args.carrera)
    if not os.path.isdir(carpeta):
        sys.exit(f'no existe {carpeta}')
    try:
        ubicar_fondo(carpeta, args.fondo, hoja=args.hoja)
    except ValueError as error:
        sys.exit(str(error))
    print('Falta `npm run catalogo` (o `npm start`) para que el espejo lo vea.')


if __name__ == '__main__':
    main()

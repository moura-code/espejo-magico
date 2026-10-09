#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
herramientas/escenas.py — genera los fondos del espejo, local, sin red en el evento.

QUE HACE Y POR QUE ASI

Cada ingenieria necesita un fondo donde sus cinco instrumentos NO esten pegados
encima sino adentro de la escena, escondidos en ella. Eso no se consigue
componiendo PNGs: se consigue pidiendole al modelo que PINTE el instrumento
dentro de un recorte de la propia foto. Ahi el objeto sale con la luz, la sombra
de contacto y el reflejo de esa mesada, porque el modelo esta mirando esa mesada
mientras lo dibuja.

Son dos pasos:

  1. LA ESCENA (texto -> imagen). El lugar donde se trabaja esa ingenieria, en
     vertical 9:16 y con el centro vacio. Se generan varias y se queda la mejor,
     medida (no a ojo): centro despejado, superficies utiles en la periferia.
  2. LOS OBJETOS (inpainting). Uno por uno, en los cinco sitios. Comparando la
     ventana antes y despues sale la SILUETA del objeto: esa mascara es la que
     el espejo usa para recortarlo del fondo cuando la mano pasa por encima.

DONDE PUEDE IR CADA OBJETO no lo decide el gusto: sale de la geometria del
espejo, y `tests/integracion/fondos.test.js` lo vigila con el catalogo real.
Las cinco ZONAS de abajo son la interseccion de todo eso —fuera de la persona,
arriba del pie con el nombre, al alcance del brazo y sin que dos blancos de la
mano se toquen—, ya resuelta. Dentro de su zona, cada sitio se elige por la
imagen: superficie debajo, aire arriba y tono medio (un objeto de vidrio sobre
una alacena blanca no lo encuentra nadie; ya nos paso).

USO
    python herramientas/escenas.py                # todas las que se generan
    python herramientas/escenas.py civil forestal # solo esas
    python herramientas/escenas.py --hoja         # rearma la hoja de contacto
    python herramientas/escenas.py --revisar      # que objetos no estan pintados
    python herramientas/escenas.py --repintar --solo electrica:motor-trifasico,...
                                                  # pinta esos en la foto actual
    python herramientas/escenas.py --repintar --semilla 1 --solo ...
                                                  # lo mismo, con otra tanda de
                                                  # semillas (la 0 repite lo de antes)
    python herramientas/escenas.py --apaisar      # la version 16:9 de cada fondo,
                                                  # para pantallas apaisadas

Necesita el entorno con torch/diffusers (ver docs/contenido.md). Es el unico
codigo del proyecto que baja modelos: se corre una vez, en desarrollo.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy import ndimage

from presencia import UMBRAL, Juez, esta_presente

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARRERAS = os.path.join(RAIZ, 'contenido', 'carreras')

ANCHO, ALTO = 1080, 1920        # el espejo
GEN_W, GEN_H = 832, 1472        # 9:16 en la resolucion que SDXL maneja bien
FONDO_ID = 'escena'

BASE = 'SG161222/RealVisXL_V5.0'
INPAINT = 'diffusers/stable-diffusion-xl-1.0-inpainting-0.1'
# El VAE de SDXL declara `force_upcast`: cada decodificacion se hace en float32
# y a 832x1472 eso son minutos por imagen y la VRAM al tope. Este es el mismo
# VAE reentrenado para andar en fp16; sin el, generar las doce escenas pasa de
# veinte minutos a varias horas.
VAE_FP16 = 'madebyollin/sdxl-vae-fp16-fix'
PASOS = 28


# --------------------------------------------------------------------- zonas
#
# Las cinco cajas donde puede caer un objeto, normalizadas al espejo, y el
# tamaño de cada uno (`escala` es el diametro como fraccion del ancho).
#
# De donde salen: la persona ocupa x 0.30-0.70 de y 0.26 abajo (la cabeza) y
# x 0.25-0.75 de y 0.50 abajo (el cuerpo); el pie con el nombre se come de
# y 0.70 para abajo; la franja de arriba, hasta y 0.14; y el brazo llega a
# `tablero.radioFactor` (1.5) anchos de hombros desde el centro de los hombros,
# que es (0.5, 0.50) con 380 px de ancho. La caja de arriba al centro es angosta
# a proposito: entre el techo del cartel y la cabeza no hay mas lugar que ese.
# El borde tambien pesa: `CONFIG.fondo.margenDelLugar` (1.25 radios) corre un
# objeto que quede demasiado pegado, y un lugar que el codigo tiene que correr
# ya no es el lugar que se eligio. De ahi el 0.108 y el 0.892.
ZONAS = [
    {'nombre': 'izquierda-alta', 'x': (0.108, 0.175), 'y': (0.285, 0.420), 'escala': 0.17},
    {'nombre': 'derecha-alta', 'x': (0.825, 0.892), 'y': (0.285, 0.420), 'escala': 0.17},
    # La de arriba al centro va casi clavada en el eje, y no por estetica: su
    # ficha cuelga debajo, entre los dos objetos de los costados, y con el
    # objeto corrido el cartel le pisa al de esa mano. Con `fichas.anchoDebajo`
    # el hueco que queda entre los dos es de treinta milesimas.
    {'nombre': 'centro-alta', 'x': (0.485, 0.515), 'y': (0.192, 0.205), 'escala': 0.16},
    # Las de abajo no llegan a 0.615 por el pie: la ficha de un objeto de abajo
    # no entra debajo de el —ahi empieza el nombre de la ingenieria— asi que se
    # pone a su costado, y para que la descripcion mas larga del catalogo entre
    # al costado el objeto no puede bajar de 0.588.
    {'nombre': 'izquierda-baja', 'x': (0.108, 0.150), 'y': (0.475, 0.588), 'escala': 0.17},
    {'nombre': 'derecha-baja', 'x': (0.850, 0.892), 'y': (0.475, 0.588), 'escala': 0.17},
]

# Lo que se le pide SIEMPRE a la escena. Corto: CLIP corta a 77 tokens y lo que
# sobra se pierde en silencio.
ENCUADRE = ('symmetrical one-point perspective, narrow empty aisle down the middle, '
            'clear unobstructed center, empty floor at the bottom, vertical photo, '
            'photorealistic, 35mm')

NEGATIVO = ('person, people, face, text, watermark, logo, clutter, crowded, '
            'island in the center, asymmetrical, cartoon, cgi, blurry, deformed')


# ------------------------------------------------------------------- guiones
#
# Por carrera: la escena, y los cinco objetos EN EL ORDEN DE LAS ZONAS
# (izquierda-alta, derecha-alta, centro-alta, izquierda-baja, derecha-baja).
# Arriba van los chicos, que viven en un estante; abajo los grandes, que se
# apoyan en la mesada o en el piso; en el centro alto, lo que se cuelga. Ese
# orden decide la zona solo al generar la carrera entera: --repintar pinta en
# el sitio que ya dice su metadata.json, y cambiar el orden no mueve nada.
#
# Cada texto es 'el objeto, el sitio'. El juez de presencia (presencia.py) lee
# solo lo de antes de la primera coma: el sitio lo comparten los vacios, y
# nombrarlo en la pregunta hace que una pared vacia ya se parezca un poco al
# objeto. El objeto del carrusel —el primero por orden alfabetico— se describe
# como su PNG, porque al aterrizar el PNG se funde con el pintado.
#
# El id de cada objeto es su carpeta en contenido/carreras/<id>/objetos/.
#
# LAS DE FOTO REAL NO ESTAN: Quimica, Alimentos, Computacion, Mecanica y Naval
# tienen de fondo una foto de verdad, con los objetos fotografiados adentro, y
# no se generan. Donde esta cada uno lo escribe herramientas/ubicar.py.
# Generarlas aca les pondria otra escena encima.
GUIONES = {
    'agrimensura': {
        'escena': 'surveying instrument storage room interior, tall grey metal shelving units with empty shelves along both side walls up to the ceiling, workbenches below, cool daylight',
        'objetos': [
            ('prisma-topografico', 'a yellow and black surveying reflector prism on a small stand, on the metal shelf'),
            ('nivel-automatico', 'a yellow automatic surveying level instrument, on the metal shelf'),
            ('receptor-gnss', 'a black GNSS survey antenna on a short metal pole, mounted under the ceiling'),
            ('estacion-total', 'a yellow and grey total station survey instrument with a keypad, on a yellow tripod on the floor'),
            ('mira-estadal', 'a tall white levelling staff rod with black and red E-shaped markings and numbers, leaning against the shelving'),
        ],
    },
    'civil': {
        'escena': 'concrete materials testing laboratory interior, empty concrete benches and '
                  'steel racks along both side walls, bare grey walls, overhead lighting',
        # Arriba al centro el puente no salia en ningun intento: ahi cuelga la
        # viga, de un gancho de grua, y la maqueta del puente va a la mesada.
        'objetos': [
            ('casco-seguridad', 'a bright yellow construction safety helmet, on the shelf'),
            ('cono-abrams', 'a steel slump test cone for concrete, on a small steel wall shelf'),
            ('viga-acero', 'a short grey steel I-beam, hanging from a crane hook on two chains'),
            ('hormigonera', 'a small orange portable concrete mixer, on the concrete ledge'),
            # Fina y clara, la maqueta se plantaba chica y el modelo la borraba: va
            # entera (COBERTURA_FINA), sobre la mesada de la derecha.
            ('puente-atirantado', 'a white scale model of a cable-stayed bridge with two tall towers and fan cables, on the concrete bench'),
        ],
    },
    'comunicacion': {
        'escena': 'radio frequency laboratory interior, empty instrument benches and bare equipment '
                  'racks along both side walls, grey walls, cool even light',
        # La torre no salia colgada: arriba al centro va el satelite, que se
        # cuelga como en un museo, y la torre va parada arriba del gabinete.
        'objetos': [
            ('bobina-fibra', 'a large spool of bright yellow optical fiber cable, on top of the grey cabinet'),
            ('torre-telecomunicaciones', 'a red and white steel lattice telecom tower model, standing '
                                         'on top of the grey cabinet'),
            ('satelite-comunicaciones', 'a scale model of a communications satellite with blue solar '
                                        'panels, hanging from the ceiling on thin wires'),
            ('analizador-espectro', 'a rack spectrum analyzer with a glowing screen, on the bench'),
            ('antena-parabolica', 'a white parabolic dish antenna on a stand, on the bench'),
        ],
    },
    'electrica': {
        # El salon de hormigon de antes tenia la pared derecha desnuda: el motor,
        # el panel y el transformador no tenian donde apoyarse y no se pintaron.
        # Estanterias a los dos costados y mesadas abajo, como en Produccion.
        'escena': 'electrical engineering laboratory interior, tall grey metal shelving units with '
                  'empty shelves along both side walls, sturdy steel workbenches below, polished '
                  'concrete floor, dark ceiling with lights along the side walls',
        'objetos': [
            ('multimetro', 'a yellow digital multimeter with red and black test leads, on the metal shelf'),
            ('panel-solar', 'a dark blue photovoltaic solar panel with a silver frame, standing upright on the metal shelf'),
            # El del carrusel: la columna de discos de su PNG.
            ('cadena-aisladores', 'a long vertical string of seven glossy red-brown porcelain insulator discs with galvanized steel fittings, hanging from the ceiling on a steel hook'),
            ('motor-trifasico', 'a blue three phase induction electric motor, on the steel workbench'),
            ('transformador-trifasico', 'a large green power transformer with brown porcelain bushings, on the steel workbench'),
        ],
    },
    'fisico-matematico': {
        # En los estantes blancos de antes el vidrio y el blanco no se veian:
        # estantes de madera, mesas opticas negras y techo oscuro.
        'escena': 'physics optics laboratory interior, light wooden shelves with empty shelves along '
                  'both side walls, black optical tables below, light grey walls, dark ceiling with '
                  'lights along the side walls, bright daylight',
        'objetos': [
            ('prisma-optico', 'a large triangular glass prism on a black stand, casting a bright '
                              'rainbow onto the wooden shelf'),
            # El del carrusel: aros negros alrededor de un disco de bronce, como su PNG.
            ('giroscopio', 'a precision gyroscope with black gimbal rings around a brass rotor disc on '
                           'a black base, on the wooden shelf'),
            ('pendulo-foucault', 'a brass pendulum bob, hanging from a long wire from the ceiling'),
            ('osciloscopio', 'a digital oscilloscope with a glowing waveform screen, on the black optical table'),
            ('superficie-3d', 'a white 3d printed mathematical saddle surface model, on the black optical table'),
        ],
    },
    'forestal': {
        'escena': 'forest logging yard, stacks of cut logs piled along both sides, empty dirt track '
                  'down the middle, tall pine trees, soft overcast daylight',
        'objetos': [
            ('forcipula', 'a blue forestry caliper tool, resting on the log stack'),
            # A media altura entre los pinos no hay donde apoyar nada: ahi va la
            # motosierra clavada en el tronco, como se la deja en el monte, y el
            # plantin baja al piso, junto a los troncos.
            ('motosierra', 'an orange professional chainsaw, with its guide bar stuck into a pine tree trunk'),
            ('dron-multiespectral', 'a black quadcopter survey drone, flying in the air'),
            ('plantin', 'a small tree seedling with broad green leaves in a black plastic tube, standing on the ground beside the cut logs'),
            ('autocargador', 'a yellow forestry forwarder machine, parked among the logs'),
        ],
    },
    'produccion': {
        # El galpon enorme de antes no tenia donde apoyar nada a la altura de los
        # objetos de arriba: el engranaje flotaba delante del techo, y el calibre
        # no se llego a pintar. Estanterias pegadas a los dos costados.
        'escena': 'factory warehouse interior, tall steel pallet racking with empty shelves close '
                  'on both sides, steel workbenches below, polished concrete floor, '
                  'overhead industrial lighting',
        # Los de los costados van en los estantes del rack, donde se apoyan; arriba
        # al centro hay techo, y lo unico que puede ir ahi es la cinta colgada.
        # Amarilla, porque gris contra el techo gris no se pintaba nunca.
        'objetos': [
            ('calibre-digital', 'a long stainless steel digital caliper with a black digital display, '
                                'lying flat on the orange rack beam'),
            ('engranaje-industrial', 'a large polished steel industrial gear, standing on the rack shelf'),
            ('cinta-transportadora', 'a short yellow belt conveyor section with a cardboard box on it, '
                                     'hanging from the ceiling on two chains'),
            ('pallet', 'a wooden pallet stacked with cardboard boxes, on the lowest rack level'),
            ('brazo-robotico', 'a single white industrial robot arm with black joints on a black base, '
                               'standing on the lowest rack level'),
        ],
    },
}


# ------------------------------------------------------------------ medicion

def _mapas(im):
    """Gris, energia de borde y energia de borde HORIZONTAL (las superficies)."""
    g = np.asarray(im.convert('L'), dtype=np.float32)
    gy = ndimage.sobel(g, axis=0)
    gx = ndimage.sobel(g, axis=1)
    return g, np.hypot(gx, gy), np.abs(gy)


def _caja(a, x0, y0, x1, y1):
    h, w = a.shape
    x0 = max(0, min(w - 1, int(x0))); x1 = max(x0 + 1, min(w, int(x1)))
    y0 = max(0, min(h - 1, int(y0))); y1 = max(y0 + 1, min(h, int(y1)))
    return a[y0:y1, x0:x1]


def puntuar_sitio(mapas, cx, cy, r):
    """
    Que tan bien se apoya un objeto de radio `r` en (cx, cy). Tres cosas, y las
    tres se aprendieron perdiendo objetos:

      soporte  — hay un borde horizontal justo debajo: una mesada, un estante.
                 Sin eso el objeto flota, que es lo que queremos evitar.
      aire     — arriba esta despejado. Pintar un instrumento encima de otras
                 diez cosas lo vuelve invisible.
      tono     — la zona no esta quemada de blanco ni negra. Un matraz de vidrio
                 sobre una alacena blanca no lo encuentra nadie.
    """
    gris, borde, bordeH = mapas
    soporte = float(_caja(bordeH, cx - r * 0.7, cy + r * 0.55, cx + r * 0.7, cy + r * 1.15).mean())
    aire = float(_caja(borde, cx - r * 0.8, cy - r * 1.1, cx + r * 0.8, cy + r * 0.3).mean())
    luz = float(_caja(gris, cx - r, cy - r, cx + r, cy + r).mean())

    n_soporte = min(1.0, soporte / 110.0)
    n_aire = max(0.0, 1.0 - aire / 150.0)
    n_tono = max(0.0, 1.0 - abs(luz - 118.0) / 125.0)
    return 1.7 * n_soporte + 1.0 * n_aire + 1.1 * n_tono


# Cuanto tienen que separarse dos objetos, en radios sumados. El espejo abre la
# ficha del objeto cuyo blanco —`fichas.radioFactor`, 1.2 radios— contiene a la
# mano: si dos blancos se tocan, yendo a buscar uno se abre el del vecino. Se
# pide un 8 % mas, para no depender de un pixel.
SEPARACION = 1.2 * 1.08

# El espejo es 1080x1920, pero se desarrolla en un monitor apaisado y la prueba
# exige lo mismo en los dos. Y NO SON EL MISMO PROBLEMA: en apaisado la foto
# entra a la altura de la pantalla, los objetos crecen `agrandarEnApaisado` y la
# diferencia vertical entre dos sitios se comprime mientras la horizontal se
# estira. Para dos objetos de la misma columna, que es el caso justo, apaisado
# es MAS exigente que el espejo. Se piden las dos.
PANTALLAS = [
    {'ancho': 1080, 'alto': 1920, 'unidad': 1080, 'agrandar': 1.0},
    {'ancho': 1920, 'alto': 1080, 'unidad': 1080 * 0.5625, 'agrandar': 1.25},
]


def _separados(a, b):
    """Si dos sitios se pueden ver juntos sin que sus blancos de la mano se toquen."""
    for p in PANTALLAS:
        ra = a['escala'] * p['agrandar'] * p['unidad'] / 2
        rb = b['escala'] * p['agrandar'] * p['unidad'] / 2
        d = np.hypot((a['x'] - b['x']) * p['ancho'], (a['y'] - b['y']) * p['alto'])
        if d < SEPARACION * (ra + rb):
            return False
    return True


def elegir_sitios(im, paso=14):
    """
    Los cinco sitios de una escena, ELEGIDOS JUNTOS y no de a uno.

    Cada zona tiene su mejor punto, pero dos zonas vecinas pueden tener sus
    mejores puntos pegados —el estante de arriba termina donde empieza la
    mesada— y ahi los blancos de la mano se tocan. Asi que se recorre cada zona
    de mejor a peor y se toma el primero que no choque con los ya elegidos. Si
    ninguno entra se toma el mejor igual: un fondo con un sitio justo es mejor
    que un fondo sin objeto, y la prueba lo va a decir.
    """
    mapas = _mapas(im)
    elegidos = []
    for zona in ZONAS:
        r = zona['escala'] * ANCHO / 2
        x0, x1 = zona['x']
        y0, y1 = zona['y']
        candidatos = [
            (puntuar_sitio(mapas, cx, cy, r), float(cx), float(cy))
            for cx in np.arange(x0 * ANCHO, x1 * ANCHO + 1, paso)
            for cy in np.arange(y0 * ALTO, y1 * ALTO + 1, paso)
        ]
        candidatos.sort(key=lambda c: -c[0])
        como_sitio = lambda c: {'x': c[1] / ANCHO, 'y': c[2] / ALTO, 'escala': zona['escala'],
                                'puntaje': c[0]}
        libre = next(
            (
                como_sitio(c)
                for c in candidatos
                if all(_separados(como_sitio(c), e) for e in elegidos)
            ),
            como_sitio(candidatos[0]),
        )
        elegidos.append(libre)

    return elegidos


# ARRIBA AL CENTRO NO PUEDE HABER UNA LUZ. Ahi va lo que cuelga del techo, y si
# el sitio cae sobre una luz el modelo la continua en vez de pintar el objeto:
# asi fallaron la cinta, el puente, la torre y el intercambiador, una y otra vez.
# Basta una tira angosta —la luz del medio de un pasillo es asi—, por eso se
# mide la fraccion de pixeles casi blancos y no el brillo medio. Una escena asi
# pierde contra cualquier otra que no la tenga.
CASI_BLANCO = 220
LUZ_MAXIMA_ARRIBA = 0.08
PENALIDAD_LUZ_ARRIBA = 4.0


def hay_luz_arriba_al_centro(gris, sitios):
    """Si el sitio de arriba al centro cae sobre una luz del techo."""
    i = next(k for k, z in enumerate(ZONAS) if z['nombre'] == 'centro-alta')
    s = sitios[i]
    cx, cy, r = s['x'] * ANCHO, s['y'] * ALTO, s['escala'] * ANCHO / 2
    return float((_caja(gris, cx - r, cy - r, cx + r, cy + r) > CASI_BLANCO).mean()) > LUZ_MAXIMA_ARRIBA


def puntuar_escena(im):
    """
    Que tan util es una escena: cuanto suman sus cinco sitios, mas un premio por
    tener el centro despejado, que es donde va la persona, y menos una penalidad
    si arriba al centro hay una luz.
    """
    sitios = elegir_sitios(im)
    gris, borde, _ = _mapas(im)
    centro = float(_caja(borde, 0.27 * ANCHO, 0.30 * ALTO, 0.73 * ANCHO, 0.95 * ALTO).mean())
    despejado = max(0.0, 1.0 - centro / 90.0)
    penalidad = PENALIDAD_LUZ_ARRIBA if hay_luz_arriba_al_centro(gris, sitios) else 0.0
    return sum(s['puntaje'] for s in sitios) + 2.5 * despejado - penalidad, sitios


# ------------------------------------------------------------------- pintura

def silueta_pintada(antes, despues, dentro, umbral=22):
    """
    La silueta del objeto que acaba de pintarse: donde la escena cambio.

    La mascara con la que se inpinto es un ovalo, y recortar por ahi se llevaria
    un pedazo de mesada alrededor. Pero tenemos la ventana antes y despues: lo
    que cambio ES el objeto. Se cierra —el vidrio y el metal apenas cambian y
    dejan agujeros—, se rellena y se queda la mancha mas grande: los cambios
    sueltos son el reflejo y la sombra.
    """
    a = np.asarray(antes.convert('RGB'), dtype=np.int16)
    b = np.asarray(despues.convert('RGB'), dtype=np.int16)
    m = (np.abs(a - b).max(axis=2) > umbral) & (np.asarray(dentro) > 8)

    radio = max(3, int(min(antes.size) * 0.022))
    bola = np.hypot(*np.ogrid[-radio:radio + 1, -radio:radio + 1]) <= radio
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, structure=bola))

    etiquetas, cuantas = ndimage.label(m)
    if cuantas > 1:
        tamanos = ndimage.sum(m, etiquetas, range(1, cuantas + 1))
        m = etiquetas == (int(np.argmax(tamanos)) + 1)
    m = ndimage.binary_opening(m, structure=bola)
    return Image.fromarray(np.uint8(m * 255)).filter(ImageFilter.GaussianBlur(radio * 0.45))


def png_del_objeto(carrera_id, objeto_id):
    """El PNG del objeto (objetos/<id>/imagen.png), o None si no esta."""
    ruta = os.path.join(CARRERAS, carrera_id, 'objetos', objeto_id, 'imagen.png')
    if not os.path.exists(ruta):
        return None
    with Image.open(ruta) as png:
        return png.convert('RGBA')


# Cuanto del ovalo ocupa el PNG plantado. Entero, con su borde difuminado, el
# objeto salia mas grande que su sitio: la base de datos y el servidor pasaban
# el area maxima del control (1,68 y 1,58 contra 1,4).
TAMANO_PLANTADO = 0.75
# LO FINO SE PLANTA ENTERO. La maqueta del puente —cables y un tablero finito,
# el 27 % de su caja— al tamaño del sitio quedaba con lineas de un par de
# pixeles, y el modelo las borraba a cualquier fuerza. Un PNG que llena menos
# que esto de su caja va a todo el ovalo.
COBERTURA_FINA = 0.3


def cobertura(png):
    """Que fraccion de su caja llena un PNG: poca es una estructura fina."""
    alfa = np.asarray(png.getchannel('A')) > 128
    if not alfa.any():
        return 0.0
    filas, columnas = np.nonzero(alfa)
    return float(alfa[filas.min():filas.max() + 1, columnas.min():columnas.max() + 1].mean())


def tamano_plantado(png):
    """Cuanto del ovalo ocupa este PNG plantado."""
    return 1.0 if cobertura(png) < COBERTURA_FINA else TAMANO_PLANTADO


def plantar_objeto(ventana, mascara, png):
    """
    SOBRE UNA SUPERFICIE LISA Y PAREJA EL RELLENO NO PINTA NADA. Con un estante
    gris oscuro debajo del ovalo, el modelo copiaba el estante y el texto no
    importaba: el resultado era el mismo con cualquier semilla. Plantado el PNG
    del objeto en el ovalo —sin su borde transparente, del tamaño del ovalo y
    centrado—, el modelo arranca de el y lo repinta con la luz del lugar.

    Devuelve una ventana nueva; sin `png`, la misma.
    """
    if png is None:
        return ventana
    caja = mascara.getbbox()
    if not caja:
        return ventana
    objeto = png.crop(png.getbbox() or (0, 0, png.width, png.height))
    ancho, alto = caja[2] - caja[0], caja[3] - caja[1]
    escala = tamano_plantado(objeto) * min(ancho / objeto.width, alto / objeto.height)
    objeto = objeto.resize((max(1, round(objeto.width * escala)), max(1, round(objeto.height * escala))),
                           Image.Resampling.LANCZOS)
    plantada = ventana.copy()
    plantada.paste(objeto, (caja[0] + (ancho - objeto.width) // 2, caja[1] + (alto - objeto.height) // 2),
                   objeto)
    return plantada


def ovalo_del_sitio(sitio, ventana=2.3):
    """
    La ventana cuadrada de un sitio y el ovalo que se repinta adentro de ella:
    (x0, y0, lado de la ventana, mascara a 1024x1024).
    """
    lado = sitio['escala'] * ANCHO
    S = int(min(ANCHO, ALTO, lado * ventana))
    cx, cy = sitio['x'] * ANCHO, sitio['y'] * ALTO
    x0 = int(min(max(0, cx - S / 2), ANCHO - S))
    y0 = int(min(max(0, cy - S / 2), ALTO - S))
    k = 1024 / S
    mw, mh = lado * k, lado * k * 1.25
    mcx, mcy = (cx - x0) * k, (cy - y0) * k
    mask = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(mask).ellipse([mcx - mw / 2, mcy - mh / 2, mcx + mw / 2, mcy + mh / 2], fill=255)
    return x0, y0, S, mask.filter(ImageFilter.GaussianBlur(18))


def restaurar_sitio(foto, vacia, sitio):
    """
    La foto con el ovalo de `sitio` devuelto a la escena vacia. El modelo se
    ancla a lo que hay en el ovalo: repintando encima de un objeto ya pintado,
    lo repetia. Devuelve una foto nueva.
    """
    x0, y0, S, mask = ovalo_del_sitio(sitio)
    nueva = foto.copy()
    nueva.paste(vacia.crop((x0, y0, x0 + S, y0 + S)), (x0, y0),
                mask.resize((S, S), Image.Resampling.LANCZOS))
    return nueva


def meter_objeto(pipe, escena, sitio, texto, semilla, ventana=2.3, png=None):
    """
    Pinta `texto` dentro de la escena, en `sitio`. Devuelve (escena, mascara).
    Con `png`, el modelo arranca del objeto plantado en el ovalo (plantar_objeto).
    """
    x0, y0, S, mask = ovalo_del_sitio(sitio, ventana)
    antes = escena.crop((x0, y0, x0 + S, y0 + S))

    import torch
    g = torch.Generator('cuda').manual_seed(semilla)
    pintada = pipe(
        # Pintado como foto de producto —limpio, de frente, con luz de estudio— el
        # objeto se leia pegado encima de la escena: se le pide la luz del lugar.
        prompt=f'{texto}, photorealistic, detailed, sharp, natural shadow, '
               'lit by the same light as the room',
        negative_prompt='floating, levitating, pasted, sticker, cut out, text, watermark, '
                        'blurry, deformed, duplicated, 3d render, cgi, product photo, '
                        'studio lighting',
        image=plantar_objeto(antes.resize((1024, 1024), Image.Resampling.LANCZOS), mask, png),
        mask_image=mask,
        height=1024, width=1024, strength=0.99,
        guidance_scale=8.0, num_inference_steps=PASOS, generator=g,
    ).images[0]

    pegar = pintada.resize((S, S), Image.Resampling.LANCZOS)
    suave = mask.resize((S, S), Image.Resampling.LANCZOS)
    nueva = escena.copy()
    nueva.paste(pegar, (x0, y0), suave)

    completa = Image.new('L', (ANCHO, ALTO), 0)
    completa.paste(silueta_pintada(antes, pegar, suave), (x0, y0))
    return nueva, completa


def recorte_para_juzgar(imagen, mascara, margen=0.15):
    """Lo que se le muestra al juez: donde quedo la silueta pintada, con un poco de aire."""
    return recorte_de_caja(imagen, caja_de_mascara(mascara), margen)


# Cuantas semillas se prueban por objeto antes de quedarse con la que mas se
# parece, y cuanto se separan dos intentos seguidos.
INTENTOS = 6
SALTO_DE_SEMILLA = 977


def semilla_de(oid, tanda=0, repintado=False):
    """
    La primera semilla con que se pinta un objeto. Es fija a proposito: la misma
    foto con el mismo texto da el mismo objeto, y por eso rearmar una carrera
    devuelve los que ya habian salido bien. La contracara es que reintentar sin
    cambiar el texto vuelve a dar lo mismo: `tanda` (--semilla) pide otras, y
    la tanda n empieza donde termino la n-1, asi que ninguna repite un intento
    de otra. El repintado arranca en otro lado que la primera vez: con aquellas
    semillas no se pinto.
    """
    base = sum(map(ord, oid)) * 37 + (4999 if repintado else 0)
    return base % 9000 + tanda * INTENTOS * SALTO_DE_SEMILLA


def meter_con_reintento(pipe, escena, sitio, texto, semilla, intentos=INTENTOS, juez=None,
                        umbral=UMBRAL, pintar=None, png=None, sin_png=None):
    """
    Un objeto que no se ve no sirve, y hay dos maneras de no verlo:

      - la silueta casi vacia: el modelo lo pinto del color de la pared. Se mide
        con el area de la mascara contra el sitio;
      - el objeto que no esta: el modelo rehizo la pared o el estante y nada
        mas. La mascara sale llena —una pared repintada tambien cambia— y asi
        pasaron unos 25 de los 60 objetos. Lo mide `juez` (presencia.py): si lo
        pintado se parece al objeto y no a un sitio vacio.

    Se prueba con otra semilla hasta que pase las dos. Si ninguno pasa, queda el
    que mas se parece al objeto, y quien llama lo avisa. Sin `juez` vale solo el
    area, como antes. `pintar` se inyecta en las pruebas; es meter_objeto.

    Con `png`, la segunda mitad de los intentos arranca del objeto plantado en
    el ovalo (plantar_objeto): sobre una superficie lisa el relleno solo no pinta
    nada, y asi sale. La primera mitad va sin el, porque sin un PNG que seguir el
    modelo integra mejor el objeto cuando puede. `sin_png` cambia cuantos van sin
    el: con 0 (--con-png) todos arrancan del PNG, que es lo que hace falta cuando
    el juez da por bueno lo que no es.

    Devuelve (escena, mascara, razon de area, presencia, intentos usados, si el
    que quedo salio del PNG).
    """
    pintar = pintar or meter_objeto
    sin_png = intentos // 2 if sin_png is None else sin_png
    objetivo = np.pi * (sitio['escala'] * ANCHO / 2) ** 2
    mejor = None
    for i in range(intentos):
        con_png = png is not None and i >= sin_png
        if con_png:
            nueva, m = pintar(pipe, escena, sitio, texto, semilla + i * SALTO_DE_SEMILLA, png=png)
        else:
            nueva, m = pintar(pipe, escena, sitio, texto, semilla + i * SALTO_DE_SEMILLA)
        razon = float(np.count_nonzero(np.asarray(m) > 60)) / objetivo
        presencia = juez(recorte_para_juzgar(nueva, m), texto) if juez else 1.0
        if 0.25 <= razon <= 1.4 and esta_presente(presencia, umbral):
            return nueva, m, razon, presencia, i + 1, con_png
        # Entre los que no pasan, el que mas se parece al objeto; a igual
        # presencia, el de area mas razonable.
        clave = (presencia, -abs(razon - 0.55))
        if mejor is None or clave > mejor[0]:
            mejor = (clave, nueva, m, razon, presencia, con_png)
    _, nueva, m, razon, presencia, con_png = mejor
    return nueva, m, razon, presencia, intentos, con_png


# -------------------------------------------------------------------- salida

def orden_de_objetos(carrera_id):
    """
    Los ids de los objetos en el orden en que los numera el espejo: alfabetico,
    el de sus carpetas (servidor/descubrimiento.js). `lugar` es el del primero,
    `escondites` los de los otros cuatro, y recortes/<n>.png el del n-esimo.
    """
    return sorted(oid for oid, _ in GUIONES[carrera_id]['objetos'])


def sitio_de(meta, indice):
    """El sitio del objeto `indice` en el metadata.json de un fondo ya generado."""
    return ([meta['lugar']] + list(meta['escondites']))[indice]


def recorte_de_caja(imagen, caja, margen=0.15):
    """
    El pedazo de `imagen` donde vive un objeto: su `caja` normalizada
    ([x0, y0, x1, y1], como en metadata.json), agrandada `margen` de cada lado
    para que se vea lo que lo rodea, y acotada a la imagen.
    """
    ancho, alto = imagen.size
    x0, y0, x1, y1 = caja[0] * ancho, caja[1] * alto, caja[2] * ancho, caja[3] * alto
    dx, dy = (x1 - x0) * margen, (y1 - y0) * margen
    return imagen.crop((max(0, int(x0 - dx)), max(0, int(y0 - dy)),
                        min(ancho, int(x1 + dx)), min(alto, int(y1 + dy))))


def caja_de_mascara(mascara):
    """La caja normalizada de una mascara; toda la imagen si esta vacia."""
    x0, y0, x1, y1 = mascara.getbbox() or (0, 0, mascara.width, mascara.height)
    return [round(x0 / mascara.width, 5), round(y0 / mascara.height, 5),
            round(x1 / mascara.width, 5), round(y1 / mascara.height, 5)]


def guardar_recorte(destino, indice, mascara):
    """
    Escribe recortes/<indice>.png —la mascara recortada a su caja— y devuelve la
    caja normalizada, la de metadata.json.

    LA MASCARA VA EN EL CANAL ALFA, no en el gris: el espejo la usa con
    `destination-in`, y el lienzo mira el alfa. Un PNG en escala de grises
    tiene alfa 255 en todos lados y recortaria la caja entera en vez de la
    silueta. Es la misma traduccion que hace silueta.js con la mascara de
    MediaPipe, y por el mismo motivo.
    """
    trozo = mascara.crop(mascara.getbbox() or (0, 0, mascara.width, mascara.height))
    blanco = Image.new('L', trozo.size, 255)
    os.makedirs(os.path.join(destino, 'recortes'), exist_ok=True)
    Image.merge('RGBA', (blanco, blanco, blanco, trozo)).save(
        os.path.join(destino, 'recortes', f'{indice}.png'))
    return caja_de_mascara(mascara)


def leer_metadata(destino):
    with open(os.path.join(destino, 'metadata.json'), encoding='utf-8') as f:
        return json.load(f)


def escribir_metadata(destino, meta):
    with open(os.path.join(destino, 'metadata.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write('\n')


def guardar(carrera_id, fondo, sitios_por_objeto, mascaras_por_objeto, objetos_ordenados):
    """
    Escribe el fondo, las mascaras recortadas a su caja y el metadata, en el
    orden alfabetico de las carpetas de objetos, que es el que arma el catalogo:
    `lugar` es el del primero y `escondites` los de los otros cuatro.
    """
    destino = os.path.join(CARRERAS, carrera_id, 'fondos', FONDO_ID)
    os.makedirs(os.path.join(destino, 'recortes'), exist_ok=True)
    fondo.save(os.path.join(destino, 'imagen.jpg'), quality=94)

    lugares, recortes = [], []
    for i, oid in enumerate(objetos_ordenados):
        sitio = sitios_por_objeto[oid]
        lugares.append({'x': round(sitio['x'], 4), 'y': round(sitio['y'], 4),
                        'escala': round(sitio['escala'], 4)})
        recortes.append({'archivo': f'recortes/{i}.png',
                         'caja': guardar_recorte(destino, i, mascaras_por_objeto[oid])})

    escribir_metadata(destino, {'lugar': lugares[0], 'escondites': lugares[1:], 'recortes': recortes})
    return destino


# --------------------------------------------------------------------- pasos

def cargar(clase, repo):
    import torch
    from diffusers import AutoencoderKL, DPMSolverMultistepScheduler
    vae = AutoencoderKL.from_pretrained(VAE_FP16, torch_dtype=torch.float16)
    pipe = clase.from_pretrained(repo, vae=vae, torch_dtype=torch.float16, variant='fp16',
                                 use_safetensors=True).to('cuda')
    # DPM++ 2M Karras: la misma calidad en 28 pasos que el de fabrica en 50.
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, use_karras_sigmas=True, algorithm_type='dpmsolver++')
    pipe.vae.enable_slicing()
    pipe.set_progress_bar_config(disable=True)
    return pipe


# Donde quedan las escenas vacias entre las dos fases. Es material de trabajo:
# lo que se versiona es el fondo ya poblado.
BASES = os.path.join(RAIZ, 'contenido', 'escenas-base')


def fase_escenas(ids, candidatas):
    """
    PRIMERA FASE: las escenas vacias de todas las carreras, y nada mas.

    Los dos modelos NO entran juntos en 16 GB de VRAM —con los dos cargados, una
    sola imagen a 832x1472 se arrastra o revienta—, asi que el generador de
    texto a imagen hace su trabajo entero y recien despues entra el de relleno.
    """
    import torch
    from diffusers import StableDiffusionXLPipeline

    os.makedirs(BASES, exist_ok=True)
    print('cargando el generador de escenas...', flush=True)
    t2i = cargar(StableDiffusionXLPipeline, BASE)

    for cid in ids:
        t = time.time()
        guion = GUIONES[cid]
        mejor = None
        for k in range(candidatas):
            semilla = 101 + k * 7
            g = torch.Generator('cuda').manual_seed(semilla)
            im = t2i(prompt=f"{guion['escena']}, {ENCUADRE}", negative_prompt=NEGATIVO,
                     height=GEN_H, width=GEN_W, guidance_scale=6.5,
                     num_inference_steps=PASOS, generator=g).images[0]
            im = im.resize((ANCHO, ALTO), Image.Resampling.LANCZOS)
            puntaje, sitios = puntuar_escena(im)
            if mejor is None or puntaje > mejor[0]:
                mejor = (puntaje, im, sitios, semilla)
        puntaje, im, sitios, semilla = mejor
        im.save(os.path.join(BASES, f'{cid}.jpg'), quality=95)
        with open(os.path.join(BASES, f'{cid}.json'), 'w', encoding='utf-8') as f:
            json.dump({'semilla': semilla, 'puntaje': puntaje, 'sitios': sitios}, f, indent=2)
        print(f'  {cid:18} semilla {semilla}  puntaje {puntaje:.2f}  ({time.time()-t:.0f}s)', flush=True)

    del t2i
    torch.cuda.empty_cache()


def fase_objetos(ids, juez, umbral=UMBRAL, tanda=0, pintar=None, afinar=None, repaso=None):
    """
    SEGUNDA FASE: los cinco instrumentos adentro de cada escena, y despues la
    pasada de armonia sobre ellos (armonizar). `pintar` y `afinar` se inyectan
    en las pruebas; sin ellos se cargan los modelos.
    """
    inp = None
    if pintar is None:
        from diffusers import StableDiffusionXLInpaintPipeline
        print('cargando el generador de relleno...', flush=True)
        inp = cargar(StableDiffusionXLInpaintPipeline, INPAINT)

    hechas, repasar = [], {}
    for cid in ids:
        t = time.time()
        base = os.path.join(BASES, f'{cid}.jpg')
        if not os.path.exists(base):
            print(f'  {cid}: falta la escena base, salteada', flush=True)
            continue
        fondo = Image.open(base).convert('RGB')
        # Los sitios se vuelven a elegir sobre la escena guardada en vez de leer
        # los de la primera fase: es barato, y asi ajustar como se eligen no
        # obliga a regenerar todas las escenas.
        sitios = elegir_sitios(fondo)

        sitios_por_objeto, mascaras_por_objeto, del_png = {}, {}, []
        for (oid, texto), sitio in zip(GUIONES[cid]['objetos'], sitios):
            fondo, m, razon, presencia, intentos, con_png = meter_con_reintento(
                inp, fondo, sitio, texto, semilla_de(oid, tanda),
                juez=juez, umbral=umbral, pintar=pintar, png=png_del_objeto(cid, oid))
            sitios_por_objeto[oid] = sitio
            mascaras_por_objeto[oid] = m
            if con_png:
                del_png.append(oid)
            print(f'    {oid:24} {informe(razon, presencia, intentos, umbral)}', flush=True)

        destino = guardar(cid, fondo, sitios_por_objeto, mascaras_por_objeto,
                          sorted(sitios_por_objeto))
        hechas.append(cid)
        orden = orden_de_objetos(cid)
        repasar[cid] = sorted(orden.index(oid) for oid in del_png)
        print(f'  {cid}: {time.time()-t:.0f}s -> {os.path.relpath(destino, RAIZ)}', flush=True)

    if inp is not None:
        import torch
        del inp
        torch.cuda.empty_cache()

    # Cada carrera ya quedo escrita entera: si la armonia se corta, lo que
    # queda es lo pintado sin armonizar, que es una carrera coherente.
    if hechas:
        armonizar(hechas, tanda=tanda, afinar=afinar, repasar=repasar, repaso=repaso,
                  juez=juez, umbral=umbral)


def informe(razon, presencia, intentos, umbral=UMBRAL):
    """Una linea por objeto pintado, con el aviso si no paso los dos controles."""
    paso = 0.25 <= razon <= 1.4 and esta_presente(presencia, umbral)
    return f'area {razon:4.2f}  presencia {presencia:4.2f}  x{intentos}' + ('' if paso else '   <-- revisar')


def revisar(ids, juez, umbral=UMBRAL):
    """
    Que objetos estan de verdad en las fotos ya generadas. Juzga el recorte de
    cada uno, imprime la tabla, arma la hoja de objetos para mirarla a ojo y
    devuelve los ausentes como [(carrera, objeto)].
    """
    ausentes, filas = [], []
    for cid in ids:
        destino = os.path.join(CARRERAS, cid, 'fondos', FONDO_ID)
        foto = Image.open(os.path.join(destino, 'imagen.jpg')).convert('RGB')
        meta = leer_metadata(destino)
        textos = dict(GUIONES[cid]['objetos'])
        for i, oid in enumerate(orden_de_objetos(cid)):
            recorte = recorte_de_caja(foto, meta['recortes'][i]['caja'])
            presencia = juez(recorte, textos[oid])
            presente = esta_presente(presencia, umbral)
            if not presente:
                ausentes.append((cid, oid))
            filas.append((cid, i, oid, recorte, presencia, presente))
            print(f'  {cid:18} {i} {oid:26} {presencia:4.2f}' + ('' if presente else '   <-- falta'),
                  flush=True)
    hoja_de_objetos(filas)
    print(f'{len(ausentes)} de {len(filas)} objetos no estan en su foto:')
    print('  --solo ' + ','.join(f'{c}:{o}' for c, o in ausentes))
    return ausentes


def hoja_de_objetos(filas, salida=None):
    """Cada objeto recortado de su foto, con su presencia: para mirar a ojo lo que dijo el juez."""
    lado, pie, columnas = 150, 18, 5
    filas_de_hoja = (len(filas) + columnas - 1) // columnas
    hoja = Image.new('RGB', (columnas * lado, filas_de_hoja * (lado + pie)), (14, 14, 18))
    d = ImageDraw.Draw(hoja)
    for n, (cid, i, oid, recorte, presencia, presente) in enumerate(filas):
        x, y = (n % columnas) * lado, (n // columnas) * (lado + pie)
        miniatura = recorte.copy()
        miniatura.thumbnail((lado, lado))
        hoja.paste(miniatura, (x + (lado - miniatura.width) // 2, y))
        d.text((x + 3, y + lado + 2), f'{cid[:11]} {i} {presencia:.2f}',
               fill=(240, 220, 160) if presente else (255, 90, 90))
    salida = salida or os.path.join(RAIZ, 'contenido', 'objetos-contacto.jpg')
    hoja.save(salida, quality=90)
    print('hoja de objetos:', salida)
    return salida


def interpretar_solo(texto):
    """'electrica:motor-trifasico,civil:hormigonera' -> [(carrera, objeto), ...]."""
    pares = []
    for parte in (p.strip() for p in texto.split(',')):
        if not parte:
            continue
        cid, _, oid = parte.partition(':')
        if cid not in GUIONES or oid not in dict(GUIONES[cid]['objetos']):
            raise ValueError(f'no conozco {parte!r}: es carrera:objeto, con los ids de las carpetas')
        pares.append((cid, oid))
    return pares


def repintar(pares, juez, umbral=UMBRAL, tanda=0, pintar=None, afinar=None, con_png=False,
             repaso=None):
    """
    Pinta adentro de la foto que ya esta los objetos de `pares`, cada uno en su
    mismo sitio, y deja intactos los demas: nada de volver a generar la escena.
    Por carrera, la foto se abre una vez y se guarda una vez —recomprimir el JPEG
    por cada objeto la iria gastando—, y de cada repintado se reescriben solo
    su recorte y su caja.

    CADA CARRERA SE ESCRIBE ENTERA AL TERMINARLA: foto, recortes y metadata
    juntos. Una corrida que se corta a mitad —sin memoria, Ctrl+C— deja la
    carrera en curso como estaba; con los recortes escritos al vuelo quedaban
    siluetas nuevas sobre la foto vieja, y ninguna prueba lo nota porque las
    cajas viejas siguen en su sitio. Las carreras que ya terminaron si quedaron
    escritas: volver a correr la misma lista las repintaria encima.

    Antes de pintar, el sitio vuelve a la escena vacia (restaurar_sitio), si
    esta: el modelo se ancla a lo que hay en el ovalo, y encima de lo pintado
    antes lo repetia.

    Despues, la pasada de armonia, y solo alrededor de lo repintado: los
    objetos que ya estaban no se tocan. Lo que salio del PNG se repasa antes
    con su propio texto (armonizar). `con_png` hace que todos los intentos
    arranquen del PNG (--con-png).

    `pintar` y `afinar` se inyectan en las pruebas; sin ellos se cargan los
    modelos.
    """
    inp = None
    if pintar is None:
        from diffusers import StableDiffusionXLInpaintPipeline
        print('cargando el generador de relleno...', flush=True)
        inp = cargar(StableDiffusionXLInpaintPipeline, INPAINT)

    repintados, repasar = {}, {}
    for cid in dict.fromkeys(c for c, _ in pares):
        t = time.time()
        destino = os.path.join(CARRERAS, cid, 'fondos', FONDO_ID)
        foto = Image.open(os.path.join(destino, 'imagen.jpg')).convert('RGB')
        meta = leer_metadata(destino)
        orden = orden_de_objetos(cid)
        textos = dict(GUIONES[cid]['objetos'])
        ruta_vacia = os.path.join(BASES, f'{cid}.jpg')
        vacia = Image.open(ruta_vacia).convert('RGB') if os.path.exists(ruta_vacia) else None
        mascaras, repasar[cid] = {}, []
        for oid in (o for c, o in pares if c == cid):
            indice = orden.index(oid)
            if vacia is not None:
                foto = restaurar_sitio(foto, vacia, sitio_de(meta, indice))
            foto, mascaras[indice], razon, presencia, intentos, del_png = meter_con_reintento(
                inp, foto, sitio_de(meta, indice), textos[oid],
                semilla_de(oid, tanda, repintado=True), juez=juez, umbral=umbral, pintar=pintar,
                png=png_del_objeto(cid, oid), sin_png=0 if con_png else None)
            if del_png:
                repasar[cid].append(indice)
            print(f'    {cid} {indice} {oid:24} {informe(razon, presencia, intentos, umbral)}',
                  flush=True)
        for indice, m in mascaras.items():
            meta['recortes'][indice]['caja'] = guardar_recorte(destino, indice, m)
        foto.save(os.path.join(destino, 'imagen.jpg'), quality=94)
        escribir_metadata(destino, meta)
        repintados[cid] = sorted(mascaras)
        print(f'  {cid}: {time.time()-t:.0f}s', flush=True)

    if inp is not None:
        import torch
        del inp
        torch.cuda.empty_cache()

    if repintados:
        armonizar(list(repintados), tanda=tanda, afinar=afinar, solo=repintados,
                  repasar=repasar, repaso=repaso, juez=juez, umbral=umbral)


# ------------------------------------------------------------------- armonia
#
# Pintado de a uno, cada objeto sale con su propia luz y su propio grano
# —limpio, saturado, como foto de producto— y se lee pegado encima de la
# escena: fue lo primero que se noto en Produccion. Una pasada del generador de
# la foto a poca fuerza, sobre la foto entera, le da a todo la misma luz y la
# misma textura; y de ella se queda solo lo de alrededor de los objetos. El
# resto de la escena no se toca, y sigue calzando con su version apaisada.

# Cuanto puede cambiar la pasada. Poca: la forma del objeto tiene que quedar,
# porque su silueta es la que el espejo recorta.
FUERZA_ARMONIA = 0.3
# Hasta donde llega alrededor de cada silueta, en fraccion del ancho: lo justo
# para la sombra de contacto y el reflejo.
ALCANCE_ARMONIA = 0.05
NEGATIVO_ARMONIA = ('cartoon, cgi, 3d render, sticker, pasted, cut out, product photo, '
                    'studio lighting, text, watermark, blurry, deformed')


def mascara_de_armonia(mascaras, ancho=ANCHO, alto=ALTO):
    """
    Donde se queda la pasada: entera adentro de cada silueta, y apagandose
    hasta ALCANCE_ARMONIA del ancho afuera de ella.
    """
    siluetas = np.zeros((alto, ancho), dtype=bool)
    for m in mascaras:
        siluetas |= np.asarray(m) > 60
    if not siluetas.any():
        return Image.new('L', (ancho, alto), 0)
    distancia = ndimage.distance_transform_edt(~siluetas)
    peso = np.clip(1 - distancia / (ALCANCE_ARMONIA * ancho), 0, 1)
    return Image.fromarray(np.uint8(np.round(peso * 255)))


def mascara_del_recorte(destino, recorte):
    """
    La silueta de un objeto a la medida de la foto, armada de su recortes/<n>.png
    (la silueta recortada a su caja, en el alfa) y de su caja.
    """
    completa = Image.new('L', (ANCHO, ALTO), 0)
    with Image.open(os.path.join(destino, recorte['archivo'])) as png:
        alfa = png.getchannel('A') if 'A' in png.getbands() else png.convert('L')
        completa.paste(alfa, (round(recorte['caja'][0] * ANCHO), round(recorte['caja'][1] * ALTO)))
    return completa


# EL REPASO DE LO QUE SALE DEL PNG. Plantado, el objeto conserva el aspecto de
# su PNG —una foto de producto, o un icono como el de la base de datos— y se lee
# pegado encima. Un repaso local con el generador de la foto, con el texto del
# objeto y mas fuerza que la armonia, lo vuelve parte de la escena: a 0,5 el
# icono pasa a ser un aparato de metal y el panel solar toma la luz del lugar,
# y la forma se conserva, que es lo que el espejo recorta. A 0,65 ya cambiaba
# de forma.
FUERZA_REPASO = 0.5
NEGATIVO_REPASO = ('3d render, cgi, icon, illustration, cartoon, neon, sticker, pasted, cut out, '
                   'product photo, studio lighting, blurry, deformed')


def repaso_del_objeto(pipe, imagen, texto, semilla):
    """El repaso local de un objeto, con el generador de la foto (img2img)."""
    import torch
    g = torch.Generator('cuda').manual_seed(semilla)
    return pipe(
        prompt=f'{texto}, photorealistic, real photo, natural light of the room, detailed',
        negative_prompt=NEGATIVO_REPASO, image=imagen, strength=FUERZA_REPASO,
        guidance_scale=6.5, num_inference_steps=PASOS, generator=g,
    ).images[0]


def ventana_del_objeto(silueta, factor=2.2):
    """Un cuadrado alrededor de la silueta, factor veces su lado, adentro de la foto."""
    x0, y0, x1, y1 = silueta.getbbox()
    lado = min(ANCHO, ALTO, int(max(x1 - x0, y1 - y0) * factor))
    vx = max(0, min(ANCHO - lado, (x0 + x1) // 2 - lado // 2))
    vy = max(0, min(ALTO - lado, (y0 + y1) // 2 - lado // 2))
    return vx, vy, vx + lado, vy + lado


def armonia_del_generador(pipe, imagen, texto, semilla):
    """La pasada de armonia, con el generador de la foto (img2img)."""
    import torch
    g = torch.Generator('cuda').manual_seed(semilla)
    return pipe(
        prompt=f'{texto}, photorealistic, natural light', negative_prompt=NEGATIVO_ARMONIA,
        image=imagen, strength=FUERZA_ARMONIA, guidance_scale=6.0,
        num_inference_steps=PASOS, generator=g,
    ).images[0]


def no_lo_borro(juez, antes, despues, recorte, texto, umbral):
    """
    Si una pasada dejo al objeto donde estaba. Sin juez, se confia en la pasada.
    Se descarta solo si el objeto queda por debajo del umbral Y peor que antes:
    un objeto que el juez ya no veia no se le puede reprochar a la pasada.
    """
    if juez is None:
        return True
    previa = juez(recorte_de_caja(antes, recorte['caja']), texto)
    nueva = juez(recorte_de_caja(despues, recorte['caja']), texto)
    return not (nueva < umbral and nueva < previa)


def armonizar(ids, tanda=0, afinar=None, solo=None, repasar=None, repaso=None, juez=None,
              umbral=UMBRAL):
    """
    Pasa la armonia sobre la foto de cada carrera, alrededor de sus objetos, y
    la guarda. Lee las siluetas de los recortes: sirve igual recien pintada que
    para las fotos que ya estan (--armonizar). `solo` ({carrera: [indices]})
    la limita a esos objetos: un repintado armoniza lo que pinto.

    `repasar` ({carrera: [indices]}) son los que salieron del PNG: antes de la
    pasada, cada uno se repasa con su texto (repaso_del_objeto).

    LA ARMONIA NO PUEDE BORRAR UN OBJETO. A la maqueta del puente —fina, clara
    sobre una mesada gris— el repaso la disolvio en el concreto: 0,93 al
    pintarla, 0,17 despues. Con `juez`, el repaso o la pasada que deja a un
    objeto por debajo del umbral se descarta para ese objeto (no_lo_borro).

    `afinar` y `repaso` se inyectan en las pruebas; sin ellos se carga el
    generador de la foto.
    """
    repasar = repasar or {}
    base = None
    if afinar is None or (any(repasar.values()) and repaso is None):
        from diffusers import StableDiffusionXLImg2ImgPipeline
        print('cargando el generador de escenas...', flush=True)
        base = cargar(StableDiffusionXLImg2ImgPipeline, BASE)
        base.vae.enable_tiling()
        afinar = afinar or armonia_del_generador
        repaso = repaso or repaso_del_objeto

    for cid in ids:
        t = time.time()
        destino = os.path.join(CARRERAS, cid, 'fondos', FONDO_ID)
        foto = Image.open(os.path.join(destino, 'imagen.jpg')).convert('RGB')
        recortes = leer_metadata(destino)['recortes']
        textos = dict(GUIONES[cid]['objetos'])
        orden = orden_de_objetos(cid)
        for i in repasar.get(cid, []):
            silueta = mascara_del_recorte(destino, recortes[i])
            if not silueta.getbbox():
                continue
            caja = ventana_del_objeto(silueta)
            lado = caja[2] - caja[0]
            ventana = foto.crop(caja)
            salida = repaso(base, ventana.resize((1024, 1024), Image.Resampling.LANCZOS),
                            textos[orden[i]], semilla_de(orden[i], tanda)).convert('RGB')
            salida = salida.resize((lado, lado), Image.Resampling.LANCZOS)
            repasada = foto.copy()
            repasada.paste(Image.composite(salida, ventana, mascara_de_armonia([silueta]).crop(caja)),
                           caja[:2])
            if no_lo_borro(juez, foto, repasada, recortes[i], textos[orden[i]], umbral):
                foto = repasada
            else:
                print(f'    {cid} {i} {orden[i]}: el repaso lo borraba, se descarta', flush=True)
        indices = list(solo[cid] if solo is not None else range(len(recortes)))
        siluetas = {i: mascara_del_recorte(destino, recortes[i]) for i in indices}
        mascara = mascara_de_armonia(list(siluetas.values()))
        pasada = afinar(base, foto, GUIONES[cid]['escena'], semilla_de(cid, tanda)).convert('RGB')
        if pasada.size != foto.size:
            pasada = pasada.resize(foto.size, Image.Resampling.LANCZOS)
        final = Image.composite(pasada, foto, mascara)
        for i in indices:
            if not no_lo_borro(juez, foto, final, recortes[i], textos[orden[i]], umbral):
                final = Image.composite(foto, final, mascara_de_armonia([siluetas[i]]))
                print(f'    {cid} {i} {orden[i]}: la armonia lo borraba, queda como estaba', flush=True)
        final.save(os.path.join(destino, 'imagen.jpg'), quality=94)
        print(f'  {cid}: armonizada en {time.time()-t:.0f}s', flush=True)

    if base is not None:
        import torch
        del base
        torch.cuda.empty_cache()


# ------------------------------------------------------------------ apaisada
#
# La pantalla del evento puede ser vertical u horizontal, y el fondo tiene que
# llenarla igual. La foto vertical no se puede estirar —se deforma— ni agrandar
# hasta cubrir —se corta arriba y abajo, donde estan los objetos—, asi que en
# una pantalla apaisada va entera en el medio y los costados los pone la
# version apaisada: la MISMA escena extendida a 16:9, con la foto centrada a
# todo el alto. El espejo dibuja la foto encima y de la apaisada usa solo los
# costados, asi que los objetos, la mano y las fichas no se enteran.

APAISADA = (1920, 1080)
# El modelo pinta de a una ventana cuadrada del alto de la imagen, a la medida
# que mejor maneja.
GEN_VENTANA = 1024
# Cuanto se mete la mascara en lo que ya esta pintado, en pixeles de APAISADA:
# el modelo cose el borde en vez de pegarse a el, y la ventana nueva se funde
# con la anterior.
SOLAPE = 16
EXTENSION = ('the same place continuing to the side, natural continuation, sharp focus, '
             'everything in focus, photorealistic')
NEGATIVO_APAISADO = NEGATIVO + (', signature, seam, border, frame, split screen, collage, '
                                 'bokeh, depth of field, out of focus')


def a_todo_el_alto(foto, alto):
    """La foto con `alto` de alto, sin deformarla."""
    return foto.resize((round(foto.width * alto / foto.height), alto), Image.Resampling.LANCZOS)


def lienzo_apaisado(foto, vacia=None):
    """
    El punto de partida de la version apaisada, en APAISADA: la foto en el
    medio, a todo el alto, y en los costados la escena REFLEJADA EN EL BORDE,
    como en un espejo. El reflejo no es lo que queda —el modelo pinta encima
    casi por completo— pero le da los colores, la luz y la textura de la foto:
    arrancando de la foto desenfocada los costados salian blandos, y arrancando
    de la nada, de otro color.

    Y EL MODELO NO VE LOS OBJETOS: si esta, lo que se pone en el medio y se
    refleja es la escena VACIA (`vacia`, la de antes de pintar los objetos,
    contenido/escenas-base/). Viendo la foto los repetia —un segundo brazo
    robotico pegado a la costura, cajas sembradas alrededor del pallet, el ancla
    continuada en una losa curva—; la foto se pega recien en componer_apaisada.
    Sin la escena vacia se usa la foto, con ese riesgo.
    """
    ancho, alto = APAISADA
    escena = a_todo_el_alto(vacia or foto, alto)
    medio = escena
    reflejo = ImageOps.mirror(escena)
    lado = medio.width
    x0 = (ancho - lado) // 2
    x1 = x0 + lado

    lienzo = Image.new('RGB', (ancho, alto))
    # Hacia cada borde, de a un ancho de foto: el reflejo pegado a la foto, y
    # despues la escena derecha otra vez, para que cada costura sea un espejo.
    for i, x in enumerate(range(x0 - lado, -lado, -lado)):
        lienzo.paste(reflejo if i % 2 == 0 else escena, (x, 0))
    for i, x in enumerate(range(x1, ancho, lado)):
        lienzo.paste(reflejo if i % 2 == 0 else escena, (x, 0))
    lienzo.paste(medio, (x0, 0))
    return lienzo


def ventanas_de_extension(ancho, alto, ancho_foto):
    """
    Los pasos para extender la foto hasta los bordes, como [(x_ventana, desde,
    hasta)]: cada ventana es cuadrada, del alto de la imagen, y pinta de `desde`
    a `hasta` al lado de lo que ya esta.

    DE A POCO, NUNCA DE UNA: pintando los dos costados juntos el modelo tenia que
    inventar dos tercios del lienzo y armaba otra escena, que se leia como una
    foto pegada al lado. Asi lo que falta nunca pasa de lo que la foto deja libre
    en una ventana, y el resto de la ventana es escena que el modelo continua.
    """
    paso = alto - ancho_foto
    if paso <= 0:
        raise ValueError('la foto tiene que ser mas angosta que una ventana cuadrada')
    x0 = (ancho - ancho_foto) // 2
    x1 = x0 + ancho_foto
    pasos = []
    borde = x0
    while borde > 0:
        desde = max(0, borde - paso)
        pasos.append((desde, desde, borde))
        borde = desde
    borde = x1
    while borde < ancho:
        hasta = min(ancho, borde + paso)
        pasos.append((hasta - alto, borde, hasta))
        borde = hasta
    return pasos


def mascara_de_ventana(lado, desde, hasta):
    """Lo que se repinta en una ventana: de `desde` a `hasta`, y SOLAPE de cada lado, suave."""
    mascara = Image.new('L', (lado, lado), 0)
    mascara.paste(255, (max(0, desde - SOLAPE), 0, min(lado, hasta + SOLAPE), lado))
    return mascara.filter(ImageFilter.GaussianBlur(SOLAPE / 2))


# El ancho de la costura, en pixeles de APAISADA: lo que el costado tarda en
# pasar del reflejo de la escena, pegado al borde, a lo que pinto el modelo.
# Angosto a proposito: la luz ya la iguala igualar_tono, y con 32 los estantes
# de Fisico-Matematico se veian dobles, el reflejo y lo pintado superpuestos.
FUNDIDO = 12
# Hasta donde llega la correccion de tono desde cada borde, y cuanto se suaviza
# a lo alto la diferencia medida: es la luz lo que se corrige, no el detalle.
CORRECCION = 240
SUAVIDAD_DEL_TONO = 40


def igualar_tono(final, x0, x1, medio):
    """
    LA COSTURA EN BAJA FRECUENCIA. Aunque el borde calce, lo pintado puede quedar
    mas claro o mas oscuro que la foto, y se ve una franja de arriba a abajo. A
    lo largo de cada borde se mide la diferencia de color entre la foto y lo
    pintado —justo afuera del fundido, que lo va a tapar—, se la suaviza a lo
    alto y se le suma a lo pintado, apagandose hasta CORRECCION pixeles afuera.
    """
    pixeles = np.asarray(final, dtype=np.float32).copy()
    foto = np.asarray(medio, dtype=np.float32)
    franja = 8

    def diferencia(de_la_foto, de_lo_pintado):
        d = de_la_foto.mean(axis=1) - de_lo_pintado.mean(axis=1)
        return ndimage.gaussian_filter1d(d, SUAVIDAD_DEL_TONO, axis=0)

    desde = max(0, x0 - CORRECCION)
    pintado = pixeles[:, x0 - FUNDIDO - franja:x0 - FUNDIDO]
    peso = np.linspace(0, 1, x0 - desde, endpoint=False, dtype=np.float32) + 1 / (x0 - desde)
    pixeles[:, desde:x0] += diferencia(foto[:, :franja], pintado)[:, None, :] * peso[None, :, None]

    hasta = min(pixeles.shape[1], x1 + CORRECCION)
    pintado = pixeles[:, x1 + FUNDIDO:x1 + FUNDIDO + franja]
    peso = np.linspace(1, 0, hasta - x1, endpoint=False, dtype=np.float32)
    pixeles[:, x1:hasta] += diferencia(foto[:, -franja:], pintado)[:, None, :] * peso[None, :, None]

    return Image.fromarray(np.uint8(np.clip(np.round(pixeles), 0, 255)))


def componer_apaisada(lienzo, foto, vacia=None):
    """
    La version apaisada final: los costados pintados y, en el medio, la foto
    ORIGINAL a todo el alto. La que pasa por el modelo vuelve un poco cambiada,
    y el medio tiene que calzar con la foto que el espejo dibuja encima.

    LA COSTURA: lo que el modelo pinta justo afuera del borde nunca es igual a la
    foto, y en una pantalla grande se veia una linea. Pegado a cada borde el
    costado es el reflejo de la escena —que continua la foto pixel a pixel— y en
    FUNDIDO pixeles se funde con lo pintado. Se refleja la escena vacia si esta:
    los objetos de los costados llegan a catorce pixeles del borde.
    """
    ancho, alto = APAISADA
    final = lienzo.convert('RGB').resize((ancho, alto), Image.Resampling.LANCZOS)
    medio = a_todo_el_alto(foto.convert('RGB'), alto)
    reflejo = ImageOps.mirror(a_todo_el_alto((vacia or foto).convert('RGB'), alto))
    x0 = (ancho - medio.width) // 2
    x1 = x0 + medio.width
    final = igualar_tono(final, x0, x1, medio)

    def rampa(desde, hasta):
        fila = np.linspace(desde, hasta, FUNDIDO, dtype=np.float32)
        return Image.fromarray(np.uint8(np.round(np.tile(fila, (alto, 1)))))

    final.paste(reflejo.crop((reflejo.width - FUNDIDO, 0, reflejo.width, alto)),
                (x0 - FUNDIDO, 0), rampa(0, 255))
    final.paste(reflejo.crop((0, 0, FUNDIDO, alto)), (x1, 0), rampa(255, 0))
    final.paste(medio, (x0, 0))
    return final


def pintar_costados(pipe, ventana, mascara, texto, semilla):
    """Una ventana de la version apaisada, con el modelo de relleno."""
    import torch
    g = torch.Generator('cuda').manual_seed(semilla)
    return pipe(
        prompt=texto, negative_prompt=NEGATIVO_APAISADO,
        image=ventana, mask_image=mascara, height=ventana.height, width=ventana.width,
        # No 1: de la nada los costados salian de otro color. Lo poco que queda
        # del arranque reflejado es lo que trae la luz de la foto.
        strength=0.99, guidance_scale=7.0, num_inference_steps=PASOS, generator=g,
    ).images[0]


# La pasada fina: cuanto puede cambiar el generador de la foto. Poco, para que
# la composicion quede y gane la textura de la foto.
FUERZA_FINA = 0.35


def afinar_apaisada(pipe, imagen, texto, semilla):
    """La pasada fina de la version apaisada, con el generador de la foto (img2img)."""
    import torch
    g = torch.Generator('cuda').manual_seed(semilla)
    return pipe(
        prompt=f'{texto}, sharp, detailed', negative_prompt=NEGATIVO_APAISADO,
        image=imagen, strength=FUERZA_FINA, guidance_scale=6.5,
        num_inference_steps=PASOS, generator=g,
    ).images[0]


def apaisar(ids, tanda=0, pintar=None, afinar=None):
    """
    Escribe la version apaisada de cada fondo (imagen-apaisada.jpg) a partir de
    su foto actual. La foto vertical, sus recortes y su metadata no se tocan, y
    como de la apaisada se usan solo los costados, repintar un objeto despues no
    la invalida: los objetos no llegan al borde de la foto.

    Dos fases, porque los dos modelos no entran juntos en 16 GB:

      1. Los costados, de a ventanas (ventanas_de_extension), con el modelo de
         relleno: es el que sabe continuar lo que ve.
      2. LA PASADA FINA, con el generador de la foto. El de relleno deja los
         costados mas blandos que la foto, y el borde se leia como una costura:
         repasando la imagen entera a poca fuerza, los costados ganan la textura
         de la foto sin cambiar lo que son.

    Todas las semillas son de la misma tanda: si un costado sale con algo que
    parece uno de los cinco objetos, o con la costura a la vista, `--semilla 1`.
    `pintar` y `afinar` se inyectan en las pruebas; sin ellos se cargan los
    modelos.
    """
    ancho, alto = APAISADA

    inp = None
    if pintar is None:
        from diffusers import StableDiffusionXLInpaintPipeline
        print('cargando el generador de relleno...', flush=True)
        inp = cargar(StableDiffusionXLInpaintPipeline, INPAINT)
        pintar = pintar_costados

    extendidas = {}
    for cid in ids:
        t = time.time()
        foto = Image.open(os.path.join(CARRERAS, cid, 'fondos', FONDO_ID, 'imagen.jpg')).convert('RGB')
        ruta_vacia = os.path.join(BASES, f'{cid}.jpg')
        vacia = Image.open(ruta_vacia).convert('RGB') if os.path.exists(ruta_vacia) else None
        if vacia is None:
            print(f'  {cid}: sin escena vacia, se refleja la foto con sus objetos', flush=True)
        lienzo = lienzo_apaisado(foto, vacia)
        texto = f"{GUIONES[cid]['escena']}, {EXTENSION}"
        ventanas = ventanas_de_extension(ancho, alto, a_todo_el_alto(foto, alto).width)
        for i, (x, desde, hasta) in enumerate(ventanas):
            ventana = lienzo.crop((x, 0, x + alto, alto))
            mascara = mascara_de_ventana(alto, desde - x, hasta - x)
            pintada = pintar(inp, ventana.resize((GEN_VENTANA, GEN_VENTANA), Image.Resampling.LANCZOS),
                             mascara.resize((GEN_VENTANA, GEN_VENTANA), Image.Resampling.LANCZOS),
                             texto, semilla_de(cid, tanda) + i * SALTO_DE_SEMILLA)
            lienzo.paste(pintada.convert('RGB').resize((alto, alto), Image.Resampling.LANCZOS),
                         (x, 0), mascara)
        extendidas[cid] = (foto, vacia, lienzo, texto,
                           semilla_de(cid, tanda) + len(ventanas) * SALTO_DE_SEMILLA)
        print(f'  {cid}: costados en {time.time()-t:.0f}s', flush=True)

    if inp is not None:
        import torch
        del inp
        torch.cuda.empty_cache()

    base = None
    if afinar is None:
        from diffusers import StableDiffusionXLImg2ImgPipeline
        print('cargando el generador de escenas...', flush=True)
        base = cargar(StableDiffusionXLImg2ImgPipeline, BASE)
        base.vae.enable_tiling()
        afinar = afinar_apaisada

    for cid, (foto, vacia, lienzo, texto, semilla) in extendidas.items():
        t = time.time()
        afinada = afinar(base, lienzo, texto, semilla)
        componer_apaisada(afinada, foto, vacia).save(
            os.path.join(CARRERAS, cid, 'fondos', FONDO_ID, 'imagen-apaisada.jpg'), quality=94)
        print(f'  {cid}: pasada fina en {time.time()-t:.0f}s', flush=True)

    if base is not None:
        import torch
        del base
        torch.cuda.empty_cache()


def hoja_de_apaisadas():
    """Todas las versiones apaisadas, para mirar a ojo las costuras y que no sobre nada."""
    ids = sorted(GUIONES)
    W, H, columnas = 480, 270, 3
    filas = (len(ids) + columnas - 1) // columnas
    hoja = Image.new('RGB', (columnas * (W + 8) + 8, filas * (H + 30) + 8), (14, 14, 18))
    d = ImageDraw.Draw(hoja)
    for i, cid in enumerate(ids):
        ruta = os.path.join(CARRERAS, cid, 'fondos', FONDO_ID, 'imagen-apaisada.jpg')
        if not os.path.exists(ruta):
            continue
        x, y = 8 + (i % columnas) * (W + 8), 8 + (i // columnas) * (H + 30)
        with Image.open(ruta) as apaisada:
            hoja.paste(apaisada.convert('RGB').resize((W, H), Image.Resampling.LANCZOS), (x, y + 22))
        d.text((x, y + 4), cid, fill=(240, 220, 160))
    salida = os.path.join(RAIZ, 'contenido', 'apaisadas-contacto.jpg')
    hoja.save(salida, quality=92)
    print('hoja de apaisadas:', salida)


def hoja_de_contacto():
    """Todas, una al lado de la otra, para mirarlas juntas."""
    ids = sorted(GUIONES)
    W = 250; H = int(W * ALTO / ANCHO)
    hoja = Image.new('RGB', (W * 6 + 7 * 8, (H + 30) * 2 + 8), (14, 14, 18))
    d = ImageDraw.Draw(hoja)
    for i, cid in enumerate(ids):
        ruta = os.path.join(CARRERAS, cid, 'fondos', FONDO_ID, 'imagen.jpg')
        if not os.path.exists(ruta):
            continue
        x = 8 + (i % 6) * (W + 8); y = 8 + (i // 6) * (H + 30)
        hoja.paste(Image.open(ruta).resize((W, H), Image.Resampling.LANCZOS), (x, y + 22))
        d.text((x, y + 4), cid, fill=(240, 220, 160))
    salida = os.path.join(RAIZ, 'contenido', 'escenas-contacto.jpg')
    hoja.save(salida, quality=92)
    print('hoja de contacto:', salida)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('carreras', nargs='*', help='ids a generar (por defecto, todas)')
    ap.add_argument('--candidatas', type=int, default=8, help='escenas a probar por carrera')
    ap.add_argument('--hoja', action='store_true', help='solo rearmar la hoja de contacto')
    ap.add_argument('--fase', choices=['escenas', 'objetos'], help='correr una sola fase')
    ap.add_argument('--revisar', action='store_true',
                    help='decir que objetos no estan pintados en las fotos actuales')
    ap.add_argument('--repintar', action='store_true',
                    help='pintar en la foto actual los objetos de --solo, en su mismo sitio')
    ap.add_argument('--solo', default='', help='carrera:objeto separados por coma, para --repintar')
    ap.add_argument('--umbral', type=float, default=UMBRAL,
                    help='presencia desde la que un objeto cuenta como pintado')
    ap.add_argument('--semilla', type=int, default=0, metavar='N',
                    help='otra tanda de semillas (1, 2, ...) para --repintar, --fase objetos y '
                         '--apaisar: con la misma foto y el mismo texto, la tanda 0 pinta siempre '
                         'lo mismo')
    ap.add_argument('--con-png', action='store_true',
                    help='con --repintar: todos los intentos arrancan del PNG del objeto plantado')
    ap.add_argument('--repasar', action='store_true',
                    help='repasar con su propio texto los objetos de --solo, sin repintarlos')
    ap.add_argument('--armonizar', action='store_true',
                    help='pasar la armonia sobre los objetos de las fotos actuales, sin repintar')
    ap.add_argument('--apaisar', action='store_true',
                    help='extender las fotos actuales a 16:9, para pantallas apaisadas '
                         '(imagen-apaisada.jpg)')
    args = ap.parse_args()

    if args.hoja:
        hoja_de_contacto()
        return

    ids = args.carreras or sorted(GUIONES)
    desconocidas = [c for c in ids if c not in GUIONES]
    if desconocidas:
        sys.exit(f'no conozco: {", ".join(desconocidas)} (las de foto real no se generan: '
                 'ver herramientas/ubicar.py)')

    if args.armonizar:
        armonizar(ids, tanda=args.semilla)
        hoja_de_contacto()
        return

    if args.repasar:
        try:
            pares = interpretar_solo(args.solo)
        except ValueError as error:
            sys.exit(str(error))
        if not pares:
            sys.exit('--repasar necesita --solo carrera:objeto,...')
        indices = {}
        for cid, oid in pares:
            indices.setdefault(cid, []).append(orden_de_objetos(cid).index(oid))
        armonizar(list(indices), tanda=args.semilla, solo=indices, repasar=indices)
        hoja_de_contacto()
        return

    if args.apaisar:
        apaisar(ids, tanda=args.semilla)
        hoja_de_apaisadas()
        return

    if args.revisar or args.repintar:
        # Lo que se repinta es una lista revisada a ojo, nunca la auditoria
        # cruda: un objeto presente que el juez diera por ausente se arruinaria.
        try:
            pares = interpretar_solo(args.solo)
        except ValueError as error:
            sys.exit(str(error))
        if args.repintar and not pares:
            sys.exit('--repintar necesita --solo carrera:objeto,...: la lista de --revisar, mirada a ojo')
        juez = Juez()
        if args.revisar:
            revisar(ids, juez, args.umbral)
        if args.repintar:
            repintar(pares, juez, args.umbral, tanda=args.semilla, con_png=args.con_png)
            hoja_de_contacto()
        return

    if args.fase in (None, 'escenas'):
        print('== FASE 1: las escenas', flush=True)
        fase_escenas(ids, args.candidatas)
    if args.fase in (None, 'objetos'):
        print('== FASE 2: los objetos adentro', flush=True)
        fase_objetos(ids, Juez(), args.umbral, tanda=args.semilla)

    hoja_de_contacto()


if __name__ == '__main__':
    main()

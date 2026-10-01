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
    python herramientas/escenas.py                # las doce
    python herramientas/escenas.py quimica civil  # solo esas
    python herramientas/escenas.py --hoja         # rearma la hoja de contacto

Necesita el entorno con torch/diffusers (ver docs/contenido.md). Es el unico
codigo del proyecto que baja modelos: se corre una vez, en desarrollo.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

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
# apoyan en la mesada o en el piso; en el centro alto, lo que se cuelga.
#
# El id de cada objeto es su carpeta en contenido/carreras/<id>/objetos/.
GUIONES = {
    'agrimensura': {
        'escena': 'surveying instrument laboratory interior, empty workbenches and bare shelves '
                  'along both side walls, tripods folded against the wall, cool daylight',
        'objetos': [
            ('prisma-topografico', 'a surveying reflector prism on a small stand, on the shelf'),
            ('nivel-automatico', 'a yellow automatic surveying level instrument, on the shelf'),
            ('receptor-gnss', 'a black GNSS survey antenna on a metal bracket, high on the wall'),
            ('estacion-total', 'a total station survey instrument on a yellow tripod, on the floor'),
            ('mira-estadal', 'a red and white striped levelling staff rod leaning against the bench'),
        ],
    },
    'alimentos': {
        'escena': 'food science pilot plant interior, empty stainless steel benches and bare '
                  'shelves along both side walls, tiled walls, bright even light',
        'objetos': [
            ('placa-petri', 'a stack of glass petri dishes with red agar, on the shelf'),
            ('refractometro', 'a small digital handheld refractometer, on the shelf'),
            ('espectrofotometro', 'a dark grey spectrophotometer with a blue display, on the high shelf'),
            ('centrifuga', 'a white laboratory centrifuge machine, on the steel bench'),
            ('equipo-coccion', 'a stainless steel induction cooking plate, on the steel bench'),
        ],
    },
    'civil': {
        'escena': 'concrete materials testing laboratory interior, empty concrete benches and '
                  'steel racks along both side walls, bare grey walls, overhead lighting',
        'objetos': [
            ('casco-seguridad', 'a bright yellow construction safety helmet, on the shelf'),
            ('cono-abrams', 'a steel slump test cone for concrete, on the shelf'),
            ('puente-atirantado', 'a dark steel scale model of a cable-stayed bridge, high on the wall'),
            ('hormigonera', 'a small orange portable concrete mixer, on the floor'),
            ('viga-acero', 'a rusted steel I-beam girder lying on the concrete bench'),
        ],
    },
    'computacion': {
        'escena': 'computer engineering laboratory interior, empty light grey workbenches and bare '
                  'white shelves along both side walls, white walls, bright neutral daylight',
        'objetos': [
            ('arbol-binario', 'a printed binary tree diagram poster in a frame, on the shelf'),
            ('base-datos', 'a small rack of hard disk drives with blue lights, on the shelf'),
            ('algoritmo', 'a large flowchart diagram poster in a black frame, high on the wall'),
            ('laptop', 'an open silver laptop computer, on the workbench'),
            ('servidor', 'a rack mounted blade server chassis with status lights, on the bench'),
        ],
    },
    'comunicacion': {
        'escena': 'radio frequency laboratory interior, empty instrument benches and bare equipment '
                  'racks along both side walls, grey walls, cool even light',
        'objetos': [
            ('bobina-fibra', 'a spool of yellow optical fiber cable, on the shelf'),
            ('satelite-comunicaciones', 'a scale model of a communications satellite, on the shelf'),
            ('torre-telecomunicaciones', 'a dark steel lattice telecom tower model on a bracket, high on the wall'),
            ('analizador-espectro', 'a rack spectrum analyzer with a glowing screen, on the bench'),
            ('antena-parabolica', 'a white parabolic dish antenna on a stand, on the bench'),
        ],
    },
    'electrica': {
        'escena': 'electrical machines laboratory interior, empty workbenches and bare steel racks '
                  'along both side walls, grey concrete walls, overhead lighting',
        'objetos': [
            ('multimetro', 'a yellow digital multimeter with test leads, on the shelf'),
            # La cadena de aisladores va al hueco de arriba al centro porque es
            # lo unico de esta carrera que CUELGA: el panel solar pedido ahi
            # salia pintado del color de la pared y no aparecia.
            ('panel-solar', 'a dark blue photovoltaic solar panel leaning, on the shelf'),
            ('cadena-aisladores', 'a chain of brown porcelain insulator discs hanging from the ceiling'),
            ('motor-trifasico', 'a blue three phase induction electric motor, on the bench'),
            ('transformador-trifasico', 'a grey three phase power transformer, on the floor'),
        ],
    },
    'fisico-matematico': {
        'escena': 'physics optics laboratory interior, empty optical tables and bare white shelves '
                  'along both side walls, light grey walls, bright even daylight',
        'objetos': [
            ('prisma-optico', 'a triangular glass optical prism splitting light, on the shelf'),
            ('giroscopio', 'a brass precision gyroscope on its stand, on the shelf'),
            ('pendulo-foucault', 'a brass pendulum bob hanging from a long wire from the ceiling'),
            ('osciloscopio', 'a digital oscilloscope with a glowing waveform screen, on the table'),
            ('superficie-3d', 'a white 3d printed mathematical saddle surface model, on the table'),
        ],
    },
    'forestal': {
        'escena': 'forest logging yard, stacks of cut logs piled along both sides, empty dirt track '
                  'down the middle, tall pine trees, soft overcast daylight',
        'objetos': [
            ('forcipula', 'a blue forestry caliper tool, resting on the log stack'),
            ('plantin', 'a small pine seedling in a plastic tube, on the log stack'),
            ('dron-multiespectral', 'a black quadcopter survey drone flying in the air'),
            ('motosierra', 'an orange professional chainsaw lying on the cut logs'),
            ('autocargador', 'a yellow forestry forwarder machine parked among the logs'),
        ],
    },
    'mecanica': {
        'escena': 'mechanical engineering workshop interior, empty steel workbenches and bare tool '
                  'racks along both side walls, machine tools, warm industrial lighting',
        'objetos': [
            ('llave-dinamometrica', 'a chrome torque wrench tool, on the shelf'),
            ('rotor-turbina', 'a polished steel turbine rotor disc with blades, on the shelf'),
            ('bomba-centrifuga', 'a green centrifugal water pump mounted high on the wall'),
            ('motor-seccionado', 'a cutaway sectioned combustion engine on a stand, on the floor'),
            ('torno-cnc', 'an industrial CNC lathe machine, on the workshop floor'),
        ],
    },
    'naval': {
        'escena': 'shipyard workshop interior, empty steel workbenches and bare racks along both '
                  'side walls, a ship hull in the background, cool daylight',
        'objetos': [
            ('timon', 'a wooden ship steering wheel, mounted on the wall'),
            ('rov', 'a yellow underwater remotely operated vehicle, on the shelf'),
            ('remolcador', 'a red and black scale model of a harbour tugboat, high on the wall'),
            ('ancla', 'a heavy black stockless ship anchor, on the concrete floor'),
            ('helice', 'a large bronze marine propeller, standing on the floor'),
        ],
    },
    'produccion': {
        'escena': 'factory assembly hall interior, empty steel workbenches and bare pallet racking '
                  'along both sides, polished concrete floor, overhead industrial lighting',
        'objetos': [
            ('calibre-digital', 'a stainless digital vernier caliper, on the shelf'),
            ('engranaje-industrial', 'a large polished steel industrial gear, on the shelf'),
            ('cinta-transportadora', 'a dark steel roller conveyor with cardboard boxes, high across the wall'),
            ('pallet', 'a wooden pallet stacked with cardboard boxes, on the floor'),
            ('brazo-robotico', 'an orange articulated industrial robot arm, on the floor'),
        ],
    },
    'quimica': {
        'escena': 'chemistry laboratory interior, empty black benchtops and bare white wall shelves '
                  'on both the left and right sides, tall window at the far end, warm morning light',
        'objetos': [
            ('matraz-erlenmeyer', 'a conical glass Erlenmeyer flask with amber liquid, on the shelf'),
            ('bomba-peristaltica', 'a blue peristaltic laboratory pump with orange tubing, on the shelf'),
            ('intercambiador-placas', 'a blue plate heat exchanger unit mounted high on the wall'),
            ('columna-destilacion', 'a tall glass distillation column with clamps, on the black bench'),
            ('reactor-agitado', 'a stainless steel stirred reactor vessel with a motor, on the bench'),
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


def puntuar_escena(im):
    """
    Que tan util es una escena: cuanto suman sus cinco sitios, mas un premio por
    tener el centro despejado, que es donde va la persona.
    """
    sitios = elegir_sitios(im)
    borde = _mapas(im)[1]
    centro = float(_caja(borde, 0.27 * ANCHO, 0.30 * ALTO, 0.73 * ANCHO, 0.95 * ALTO).mean())
    despejado = max(0.0, 1.0 - centro / 90.0)
    return sum(s['puntaje'] for s in sitios) + 2.5 * despejado, sitios


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


def meter_objeto(pipe, escena, sitio, texto, semilla, ventana=2.3):
    """Pinta `texto` dentro de la escena, en `sitio`. Devuelve (escena, mascara)."""
    lado = sitio['escala'] * ANCHO
    S = int(min(ANCHO, ALTO, lado * ventana))
    cx, cy = sitio['x'] * ANCHO, sitio['y'] * ALTO
    x0 = int(min(max(0, cx - S / 2), ANCHO - S))
    y0 = int(min(max(0, cy - S / 2), ALTO - S))

    antes = escena.crop((x0, y0, x0 + S, y0 + S))
    k = 1024 / S
    mw, mh = lado * k, lado * k * 1.25
    mcx, mcy = (cx - x0) * k, (cy - y0) * k
    mask = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(mask).ellipse([mcx - mw / 2, mcy - mh / 2, mcx + mw / 2, mcy + mh / 2], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(18))

    import torch
    g = torch.Generator('cuda').manual_seed(semilla)
    pintada = pipe(
        prompt=f'{texto}, photorealistic, detailed, sharp, natural shadow',
        negative_prompt='floating, levitating, pasted, sticker, cut out, text, watermark, '
                        'blurry, deformed, duplicated',
        image=antes.resize((1024, 1024), Image.Resampling.LANCZOS), mask_image=mask,
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


def meter_con_reintento(pipe, escena, sitio, texto, semilla, intentos=3):
    """
    Un objeto que no se ve no sirve: la mascara sale casi vacia cuando el modelo
    lo pinto del color de la pared. Se prueba con otra semilla hasta que la
    silueta ocupe una fraccion razonable de su sitio.
    """
    objetivo = np.pi * (sitio['escala'] * ANCHO / 2) ** 2
    mejor = None
    for i in range(intentos):
        nueva, m = meter_objeto(pipe, escena, sitio, texto, semilla + i * 977)
        area = float(np.count_nonzero(np.asarray(m) > 60))
        razon = area / objetivo
        if mejor is None or abs(razon - 0.55) < abs(mejor[0] - 0.55):
            mejor = (razon, nueva, m)
        if 0.25 <= razon <= 1.4:
            return nueva, m, razon, i + 1
    return mejor[1], mejor[2], mejor[0], intentos


# -------------------------------------------------------------------- salida

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
        m = mascaras_por_objeto[oid]
        caja = m.getbbox() or (0, 0, ANCHO, ALTO)
        # LA MASCARA VA EN EL CANAL ALFA, no en el gris: el espejo la usa con
        # `destination-in`, y el lienzo mira el alfa. Un PNG en escala de grises
        # tiene alfa 255 en todos lados y recortaria la caja entera en vez de la
        # silueta. Es la misma traduccion que hace silueta.js con la mascara de
        # MediaPipe, y por el mismo motivo.
        trozo = m.crop(caja)
        blanco = Image.new('L', trozo.size, 255)
        Image.merge('RGBA', (blanco, blanco, blanco, trozo)).save(
            os.path.join(destino, 'recortes', f'{i}.png'))
        lugares.append({'x': round(sitio['x'], 4), 'y': round(sitio['y'], 4),
                        'escala': round(sitio['escala'], 4)})
        recortes.append({
            'archivo': f'recortes/{i}.png',
            'caja': [round(caja[0] / ANCHO, 5), round(caja[1] / ALTO, 5),
                     round(caja[2] / ANCHO, 5), round(caja[3] / ALTO, 5)],
        })

    meta = {'lugar': lugares[0], 'escondites': lugares[1:], 'recortes': recortes}
    with open(os.path.join(destino, 'metadata.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write('\n')
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


def fase_objetos(ids):
    """SEGUNDA FASE: los cinco instrumentos adentro de cada escena."""
    import torch
    from diffusers import StableDiffusionXLInpaintPipeline

    print('cargando el generador de relleno...', flush=True)
    inp = cargar(StableDiffusionXLInpaintPipeline, INPAINT)

    for cid in ids:
        t = time.time()
        base = os.path.join(BASES, f'{cid}.jpg')
        if not os.path.exists(base):
            print(f'  {cid}: falta la escena base, salteada', flush=True)
            continue
        fondo = Image.open(base).convert('RGB')
        # Los sitios se vuelven a elegir sobre la escena guardada en vez de leer
        # los de la primera fase: es barato, y asi ajustar como se eligen no
        # obliga a regenerar las doce escenas.
        sitios = elegir_sitios(fondo)

        sitios_por_objeto, mascaras_por_objeto = {}, {}
        for (oid, texto), sitio in zip(GUIONES[cid]['objetos'], sitios):
            fondo, m, razon, intentos = meter_con_reintento(
                inp, fondo, sitio, texto, sum(map(ord, oid)) * 37 % 9000)
            sitios_por_objeto[oid] = sitio
            mascaras_por_objeto[oid] = m
            aviso = '' if 0.25 <= razon <= 1.4 else '   <-- revisar'
            print(f'    {oid:24} area {razon:4.2f}  x{intentos}{aviso}', flush=True)

        destino = guardar(cid, fondo, sitios_por_objeto, mascaras_por_objeto,
                          sorted(sitios_por_objeto))
        print(f'  {cid}: {time.time()-t:.0f}s -> {os.path.relpath(destino, RAIZ)}', flush=True)

    del inp
    torch.cuda.empty_cache()


def hoja_de_contacto():
    """Las doce, una al lado de la otra, para mirarlas juntas."""
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
    args = ap.parse_args()

    if args.hoja:
        hoja_de_contacto()
        return

    ids = args.carreras or sorted(GUIONES)
    desconocidas = [c for c in ids if c not in GUIONES]
    if desconocidas:
        sys.exit(f'no conozco: {", ".join(desconocidas)}')

    if args.fase in (None, 'escenas'):
        print('== FASE 1: las escenas', flush=True)
        fase_escenas(ids, args.candidatas)
    if args.fase in (None, 'objetos'):
        print('== FASE 2: los objetos adentro', flush=True)
        fase_objetos(ids)

    hoja_de_contacto()


if __name__ == '__main__':
    main()

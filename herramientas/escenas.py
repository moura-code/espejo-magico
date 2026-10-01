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
    python herramientas/escenas.py --revisar      # que objetos no estan pintados
    python herramientas/escenas.py --repintar --solo electrica:motor-trifasico,...
                                                  # pinta esos en la foto actual

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
# apoyan en la mesada o en el piso; en el centro alto, lo que se cuelga.
#
# El id de cada objeto es su carpeta en contenido/carreras/<id>/objetos/.
GUIONES = {
    'agrimensura': {
        'escena': 'surveying instrument laboratory interior, empty workbenches and bare shelves '
                  'along both side walls, tripods folded against the wall, cool daylight',
        'objetos': [
            ('prisma-topografico', 'a yellow and black surveying reflector prism on a small stand, on the shelf'),
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
            ('placa-petri', 'a stack of petri dishes filled with bright red agar, on the shelf'),
            ('refractometro', 'a small digital handheld refractometer, on the shelf'),
            ('espectrofotometro', 'a dark grey spectrophotometer with a blue display, on the high shelf'),
            ('centrifuga', 'a white and blue benchtop laboratory centrifuge with a round lid, on the steel bench'),
            ('equipo-coccion', 'a black glass induction cooking plate with red controls, on the steel bench'),
        ],
    },
    'civil': {
        'escena': 'concrete materials testing laboratory interior, empty concrete benches and '
                  'steel racks along both side walls, bare grey walls, overhead lighting',
        'objetos': [
            ('casco-seguridad', 'a bright yellow construction safety helmet, on the shelf'),
            ('cono-abrams', 'a steel slump test cone for concrete, on the shelf'),
            ('puente-atirantado', 'a dark steel scale model of a cable-stayed bridge hanging from the ceiling on thin wires'),
            ('hormigonera', 'a small orange portable concrete mixer, on the floor'),
            ('viga-acero', 'a short rusty orange steel I-beam lying on the concrete bench'),
        ],
    },
    'computacion': {
        'escena': 'computer engineering laboratory interior, empty light grey workbenches and bare '
                  'white shelves along both side walls, white walls, bright neutral daylight',
        'objetos': [
            ('arbol-binario', 'a black framed poster of a colorful binary tree diagram, on the shelf'),
            ('base-datos', 'a black network storage server with glowing blue lights, on the shelf'),
            ('algoritmo', 'a large flowchart diagram poster in a black frame, high on the wall'),
            ('laptop', 'an open black laptop computer with a glowing blue screen, on the workbench'),
            ('servidor', 'a black rack mounted blade server with green status lights, on the bench'),
        ],
    },
    'comunicacion': {
        'escena': 'radio frequency laboratory interior, empty instrument benches and bare equipment '
                  'racks along both side walls, grey walls, cool even light',
        'objetos': [
            ('bobina-fibra', 'a spool of yellow optical fiber cable, on the shelf'),
            ('satelite-comunicaciones', 'a scale model of a communications satellite, on the shelf'),
            ('torre-telecomunicaciones', 'a red and white steel lattice telecom tower model hanging from the ceiling on wires'),
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
            ('transformador-trifasico', 'a large grey power transformer with brown porcelain bushings, on the floor'),
        ],
    },
    'fisico-matematico': {
        'escena': 'physics optics laboratory interior, empty optical tables and bare white shelves '
                  'along both side walls, light grey walls, bright even daylight',
        'objetos': [
            ('prisma-optico', 'a triangular glass prism casting a bright rainbow of colors, on the shelf'),
            ('giroscopio', 'a brass precision gyroscope on its stand, on the shelf'),
            ('pendulo-foucault', 'a brass pendulum bob hanging from a long wire from the ceiling'),
            ('osciloscopio', 'a digital oscilloscope with a glowing waveform screen, on the table'),
            ('superficie-3d', 'an orange 3d printed mathematical saddle surface model, on the table'),
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
            ('llave-dinamometrica', 'a large red and chrome torque wrench, on the shelf'),
            ('rotor-turbina', 'a polished steel turbine rotor disc with blades, on the shelf'),
            ('bomba-centrifuga', 'a green centrifugal water pump mounted high on the wall'),
            ('motor-seccionado', 'a cutaway sectioned combustion engine on a stand, on the floor'),
            ('torno-cnc', 'a compact grey and green CNC lathe machine, on the workshop floor'),
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
            ('calibre-digital', 'a large digital caliper with a yellow display, on the shelf'),
            ('engranaje-industrial', 'a large polished steel industrial gear, on the shelf'),
            ('cinta-transportadora', 'an overhead industrial roller conveyor with cardboard boxes hanging from the ceiling'),
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
            ('intercambiador-placas', 'a compact blue plate heat exchanger unit hanging from the ceiling on chains'),
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


def recorte_para_juzgar(imagen, mascara, margen=0.15):
    """Lo que se le muestra al juez: donde quedo la silueta pintada, con un poco de aire."""
    return recorte_de_caja(imagen, caja_de_mascara(mascara), margen)


def meter_con_reintento(pipe, escena, sitio, texto, semilla, intentos=6, juez=None,
                        umbral=UMBRAL, pintar=None):
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

    Devuelve (escena, mascara, razon de area, presencia, intentos usados).
    """
    pintar = pintar or meter_objeto
    objetivo = np.pi * (sitio['escala'] * ANCHO / 2) ** 2
    mejor = None
    for i in range(intentos):
        nueva, m = pintar(pipe, escena, sitio, texto, semilla + i * 977)
        razon = float(np.count_nonzero(np.asarray(m) > 60)) / objetivo
        presencia = juez(recorte_para_juzgar(nueva, m), texto) if juez else 1.0
        if 0.25 <= razon <= 1.4 and esta_presente(presencia, umbral):
            return nueva, m, razon, presencia, i + 1
        # Entre los que no pasan, el que mas se parece al objeto; a igual
        # presencia, el de area mas razonable.
        clave = (presencia, -abs(razon - 0.55))
        if mejor is None or clave > mejor[0]:
            mejor = (clave, nueva, m, razon, presencia)
    _, nueva, m, razon, presencia = mejor
    return nueva, m, razon, presencia, intentos


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


def fase_objetos(ids, juez, umbral=UMBRAL):
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
            fondo, m, razon, presencia, intentos = meter_con_reintento(
                inp, fondo, sitio, texto, sum(map(ord, oid)) * 37 % 9000,
                juez=juez, umbral=umbral)
            sitios_por_objeto[oid] = sitio
            mascaras_por_objeto[oid] = m
            print(f'    {oid:24} {informe(razon, presencia, intentos, umbral)}', flush=True)

        destino = guardar(cid, fondo, sitios_por_objeto, mascaras_por_objeto,
                          sorted(sitios_por_objeto))
        print(f'  {cid}: {time.time()-t:.0f}s -> {os.path.relpath(destino, RAIZ)}', flush=True)

    del inp
    torch.cuda.empty_cache()


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
    """'electrica:motor-trifasico,quimica:columna-destilacion' -> [(carrera, objeto), ...]."""
    pares = []
    for parte in (p.strip() for p in texto.split(',')):
        if not parte:
            continue
        cid, _, oid = parte.partition(':')
        if cid not in GUIONES or oid not in dict(GUIONES[cid]['objetos']):
            raise ValueError(f'no conozco {parte!r}: es carrera:objeto, con los ids de las carpetas')
        pares.append((cid, oid))
    return pares


def repintar(pares, juez, umbral=UMBRAL):
    """
    Pinta adentro de la foto que ya esta los objetos de `pares`, cada uno en su
    mismo sitio, y deja intactos los demas: nada de volver a generar la escena.
    Por carrera, la foto se abre una vez y se guarda una vez —recomprimir el JPEG
    por cada objeto la iria gastando—, y de cada repintado se reescriben solo
    su recorte y su caja.
    """
    import torch
    from diffusers import StableDiffusionXLInpaintPipeline

    print('cargando el generador de relleno...', flush=True)
    inp = cargar(StableDiffusionXLInpaintPipeline, INPAINT)

    for cid in dict.fromkeys(c for c, _ in pares):
        t = time.time()
        destino = os.path.join(CARRERAS, cid, 'fondos', FONDO_ID)
        foto = Image.open(os.path.join(destino, 'imagen.jpg')).convert('RGB')
        meta = leer_metadata(destino)
        orden = orden_de_objetos(cid)
        textos = dict(GUIONES[cid]['objetos'])
        for oid in (o for c, o in pares if c == cid):
            indice = orden.index(oid)
            # Otra semilla que la de la primera vez: con esa no se pinto.
            semilla = (sum(map(ord, oid)) * 37 + 4999) % 9000
            foto, m, razon, presencia, intentos = meter_con_reintento(
                inp, foto, sitio_de(meta, indice), textos[oid], semilla,
                juez=juez, umbral=umbral)
            meta['recortes'][indice]['caja'] = guardar_recorte(destino, indice, m)
            print(f'    {cid} {indice} {oid:24} {informe(razon, presencia, intentos, umbral)}',
                  flush=True)
        foto.save(os.path.join(destino, 'imagen.jpg'), quality=94)
        escribir_metadata(destino, meta)
        print(f'  {cid}: {time.time()-t:.0f}s', flush=True)

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
    ap.add_argument('--revisar', action='store_true',
                    help='decir que objetos no estan pintados en las fotos actuales')
    ap.add_argument('--repintar', action='store_true',
                    help='pintar en la foto actual los objetos de --solo, en su mismo sitio')
    ap.add_argument('--solo', default='', help='carrera:objeto separados por coma, para --repintar')
    ap.add_argument('--umbral', type=float, default=UMBRAL,
                    help='presencia desde la que un objeto cuenta como pintado')
    args = ap.parse_args()

    if args.hoja:
        hoja_de_contacto()
        return

    ids = args.carreras or sorted(GUIONES)
    desconocidas = [c for c in ids if c not in GUIONES]
    if desconocidas:
        sys.exit(f'no conozco: {", ".join(desconocidas)}')

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
            repintar(pares, juez, args.umbral)
            hoja_de_contacto()
        return

    if args.fase in (None, 'escenas'):
        print('== FASE 1: las escenas', flush=True)
        fase_escenas(ids, args.candidatas)
    if args.fase in (None, 'objetos'):
        print('== FASE 2: los objetos adentro', flush=True)
        fase_objetos(ids, Juez(), args.umbral)

    hoja_de_contacto()


if __name__ == '__main__':
    main()

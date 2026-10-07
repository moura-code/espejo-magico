# Pruebas de herramientas/ubicar.py: encontrar el PNG de cada objeto adentro de
# una foto real, y escribir donde quedo en el metadata.json del fondo. Con fotos
# sinteticas: una textura de fondo y un objeto pegado en un lugar y a un tamaño
# que la prueba conoce.
#
#   python -m unittest discover -s tests/herramientas -v
import io
import json
import os
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'herramientas'))

import ubicar  # noqa: E402


def textura(alto, ancho, semilla, suave=2.5):
    """Ruido de color suavizado: algo con detalle, como una mesada o una pared."""
    azar = np.random.default_rng(semilla)
    ruido = ndimage.gaussian_filter(azar.random((alto, ancho, 3)), sigma=(suave, suave, 0))
    ruido = (ruido - ruido.min()) / (ruido.max() - ruido.min())
    return Image.fromarray((ruido * 255).astype(np.uint8), 'RGB')


def objeto(ancho=90, alto=60, borde=0, semilla=11):
    """Un PNG con una silueta irregular —una elipse y una pata— y `borde` pixeles transparentes alrededor."""
    cuerpo = textura(alto, ancho, semilla, suave=1.2).convert('RGBA')
    silueta = Image.new('L', (ancho, alto), 0)
    dibujo = ImageDraw.Draw(silueta)
    dibujo.ellipse((0, 0, ancho - 1, int(alto * 0.75)), fill=255)
    dibujo.rectangle((int(ancho * 0.4), int(alto * 0.5), int(ancho * 0.6), alto - 1), fill=255)
    cuerpo.putalpha(silueta)
    if not borde:
        return cuerpo
    png = Image.new('RGBA', (ancho + 2 * borde, alto + 2 * borde), (0, 0, 0, 0))
    png.paste(cuerpo, (borde, borde))
    return png


def pegar(foto, png, x, y, escala):
    """La foto con el PNG pegado en (x, y) a `escala`, como lo haria un editor de imagenes."""
    w, h = round(png.width * escala), round(png.height * escala)
    grande = png.resize((w, h), Image.Resampling.LANCZOS)
    salida = foto.convert('RGBA')
    salida.alpha_composite(grande, (x, y))
    return salida.convert('RGB'), (x, y, x + w, y + h)


def como_jpeg(foto, calidad=85):
    buffer = io.BytesIO()
    foto.save(buffer, 'JPEG', quality=calidad)
    buffer.seek(0)
    return Image.open(buffer).convert('RGB')


class Ubicar(unittest.TestCase):
    FOTO = (480, 300)

    def assertCajaCerca(self, caja, esperada, tolerancia=1.5):
        self.assertTrue(all(abs(a - b) <= tolerancia for a, b in zip(caja, esperada)),
                        f'{caja} no es {esperada}')

    def test_encuentra_el_png_donde_se_pego_y_a_su_tamano(self):
        png = objeto()
        foto, esperada = pegar(textura(*self.FOTO[::-1], semilla=3), png, 230, 95, 1.37)
        hallado = ubicar.ubicar(foto, png)
        self.assertCajaCerca(hallado['caja_px'], esperada)
        self.assertAlmostEqual(hallado['escala'], 1.37, delta=0.015)
        self.assertGreater(hallado['parecido'], 0.95)

    # Un PNG mas grande que como aparece en la foto: se achica para calzar.
    def test_tambien_si_en_la_foto_es_mas_chico_que_su_png(self):
        png = objeto(ancho=150, alto=100)
        foto, esperada = pegar(textura(*self.FOTO[::-1], semilla=4), png, 40, 150, 0.72)
        self.assertCajaCerca(ubicar.ubicar(foto, png)['caja_px'], esperada)

    # La caja es la del PNG ENTERO: el espejo lo dibuja entero adentro de ella, y
    # una caja de lo que se ve, con el PNG de bordes transparentes metido
    # adentro, lo achicaria y se correria de lo que se ve en la foto.
    def test_la_caja_es_la_del_png_entero_con_sus_bordes_transparentes(self):
        png = objeto(borde=8)
        foto, esperada = pegar(textura(*self.FOTO[::-1], semilla=5), png, 120, 60, 1.25)
        self.assertCajaCerca(ubicar.ubicar(foto, png)['caja_px'], esperada)

    # La foto se exporta en JPEG y a veces se le retoca la luz despues de pegar
    # los objetos: lo que se compara es la forma de la luz, no su nivel.
    def test_resiste_el_jpeg_y_un_retoque_de_luz(self):
        png = objeto()
        foto, esperada = pegar(textura(*self.FOTO[::-1], semilla=6), png, 300, 170, 1.1)
        arreglo = np.asarray(foto, dtype=np.float32) * 0.8 + 30
        retocada = como_jpeg(Image.fromarray(np.clip(arreglo, 0, 255).astype(np.uint8)))
        self.assertCajaCerca(ubicar.ubicar(retocada, png)['caja_px'], esperada, tolerancia=2)

    def test_un_png_todo_transparente_no_se_puede_ubicar(self):
        with self.assertRaises(ValueError):
            ubicar.ubicar(textura(100, 160, semilla=1), Image.new('RGBA', (40, 30), (0, 0, 0, 0)))


class LugarDeLaCaja(unittest.TestCase):
    # El lugar del espejo es un circulo: centro y diametro en fraccion del ANCHO
    # de la foto. El PNG que llega volando se dibuja con su lado mas largo en ese
    # diametro, asi que el diametro tiene que ser el lado mas largo de la caja:
    # al aterrizar cae exacto encima del que ya esta en la foto.
    def test_centro_de_la_caja_y_su_lado_mas_largo(self):
        self.assertEqual(ubicar.lugar_de_la_caja([0.1, 0.2, 0.3, 0.5], 1000, 500),
                         {'x': 0.2, 'y': 0.35, 'escala': 0.2})
        # Alto en fraccion del alto: 0.6 * 500 = 300 px, que son 0.3 del ancho.
        self.assertEqual(ubicar.lugar_de_la_caja([0.1, 0.2, 0.2, 0.8], 1000, 500),
                         {'x': 0.15, 'y': 0.5, 'escala': 0.3})


class UbicarFondo(unittest.TestCase):
    """La carrera entera: lee la foto y los PNG de las carpetas y escribe el metadata del fondo."""

    def armar(self, raiz, metadata=None):
        carrera = os.path.join(raiz, 'quimica')
        fondo = os.path.join(carrera, 'fondos', 'laboratorio')
        os.makedirs(fondo)
        with open(os.path.join(carrera, 'carrera.json'), 'w', encoding='utf-8') as f:
            json.dump({'nombre': 'Química', 'color': '#ff5d8f', 'maite': 'quimica',
                       'fondo': 'laboratorio'}, f)
        foto = textura(300, 480, semilla=9)
        # Las carpetas se crean al reves del alfabeto: el orden lo pone ubicar.
        for nombre, x, y, escala, semilla in (('secador', 300, 40, 1.4, 21),
                                              ('matraz', 40, 160, 1.0, 22)):
            png = objeto(semilla=semilla)
            carpeta = os.path.join(carrera, 'objetos', nombre)
            os.makedirs(carpeta)
            png.save(os.path.join(carpeta, 'imagen.png'))
            foto, _ = pegar(foto, png, x, y, escala)
        foto.save(os.path.join(fondo, 'imagen.jpg'), quality=95)
        if metadata is not None:
            with open(os.path.join(fondo, 'metadata.json'), 'w', encoding='utf-8') as f:
                json.dump(metadata, f)
        return carrera, fondo

    def leer(self, fondo):
        with open(os.path.join(fondo, 'metadata.json'), encoding='utf-8') as f:
            return json.load(f)

    def test_escribe_cajas_lugar_y_escondites_en_el_orden_de_las_carpetas(self):
        with tempfile.TemporaryDirectory() as raiz:
            carrera, fondo = self.armar(raiz)
            hallados = ubicar.ubicar_fondo(carrera, salida=io.StringIO())
            meta = self.leer(fondo)

        self.assertEqual([h['objeto'] for h in hallados], ['matraz', 'secador'])
        matraz, secador = meta['cajas']
        self.assertAlmostEqual(matraz[0], 40 / 480, delta=0.004)
        self.assertAlmostEqual(matraz[1], 160 / 300, delta=0.006)
        self.assertAlmostEqual(secador[0], 300 / 480, delta=0.004)
        # El del carrusel es el primero, y vuela a su propia caja.
        self.assertEqual(meta['lugar'], ubicar.lugar_de_la_caja(matraz, 480, 300))
        self.assertEqual(meta['escondites'], [ubicar.lugar_de_la_caja(secador, 480, 300)])

    def test_conserva_lo_demas_del_metadata(self):
        with tempfile.TemporaryDirectory() as raiz:
            carrera, fondo = self.armar(raiz, metadata={'nota': 'foto de la catedra'})
            ubicar.ubicar_fondo(carrera, salida=io.StringIO())
            self.assertEqual(self.leer(fondo)['nota'], 'foto de la catedra')

    # Un fondo generado ya sabe donde esta cada objeto, y lo sabe mejor: su
    # mascara es la silueta con la que se lo pinto.
    def test_no_toca_un_fondo_generado(self):
        with tempfile.TemporaryDirectory() as raiz:
            carrera, fondo = self.armar(raiz, metadata={'recortes': []})
            with self.assertRaises(ValueError):
                ubicar.ubicar_fondo(carrera, salida=io.StringIO())
            self.assertEqual(self.leer(fondo), {'recortes': []})


if __name__ == '__main__':
    unittest.main()

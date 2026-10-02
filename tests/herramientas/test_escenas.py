# Pruebas de las partes de herramientas/escenas.py que no necesitan la GPU: el
# orden de los objetos, sus sitios, sus recortes, como se guardan y el
# reintento que exige que el objeto este pintado. El modelo de relleno y CLIP
# se reemplazan por funciones falsas.
#
#   python -m unittest discover -s tests/herramientas -v
import io
import os
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'herramientas'))

import escenas  # noqa: E402
from presencia import texto_del_objeto  # noqa: E402


def leer(ruta):
    with open(ruta, 'rb') as f:
        return f.read()


class ConColores:
    def assertColor(self, pixel, esperado, tolerancia=3):
        self.assertTrue(all(abs(a - b) <= tolerancia for a, b in zip(pixel, esperado)),
                        f'{pixel} no es {esperado}')


def sin_cambios(pipe, imagen, texto, semilla):
    """Una pasada de armonia falsa que no cambia nada."""
    return imagen


def en_verde(pipe, imagen, texto, semilla):
    """Una pasada de armonia falsa que deja todo verde: se ve donde se quedo."""
    return Image.new('RGB', imagen.size, (40, 160, 60))


def pintado_en(escena, sitio, lado=120):
    """Lo que devolveria el relleno: la escena con un cuadrado en el sitio, y su silueta."""
    cx, cy = int(sitio['x'] * escenas.ANCHO), int(sitio['y'] * escenas.ALTO)
    caja = (cx - lado // 2, cy - lado // 2, cx + lado // 2, cy + lado // 2)
    nueva = escena.copy()
    nueva.paste((200, 40, 40), caja)
    mascara = Image.new('L', (escenas.ANCHO, escenas.ALTO), 0)
    mascara.paste(255, caja)
    return nueva, mascara


class PuntuarEscena(unittest.TestCase):
    # ARRIBA AL CENTRO NO PUEDE HABER UNA LUZ. Ahi va lo que cuelga del techo, y
    # sobre una luz el modelo la continua en vez de pintar el objeto: asi
    # fallaron la cinta, el puente, la torre y el intercambiador, una y otra vez.
    # Basta una tira angosta: la luz del medio de un pasillo es asi.
    def test_una_luz_arriba_al_centro_le_resta_a_la_escena(self):
        gris = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (110, 110, 110))
        con_luz = gris.copy()
        con_luz.paste((250, 250, 250), (520, 0, 560, 600))
        sin, con = escenas.puntuar_escena(gris)[0], escenas.puntuar_escena(con_luz)[0]
        self.assertGreater(sin - con, 3, (sin, con))

    # La misma tira lejos del sitio no cambia nada: lo que se castiga es la luz
    # justo donde va a colgar el objeto, no cualquier luz del techo.
    def test_una_luz_lejos_del_sitio_no_resta(self):
        gris = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (110, 110, 110))
        con_luz = gris.copy()
        con_luz.paste((250, 250, 250), (300, 0, 340, 120))
        sin, con = escenas.puntuar_escena(gris)[0], escenas.puntuar_escena(con_luz)[0]
        self.assertLess(abs(sin - con), 1, (sin, con))


class OrdenDeObjetos(unittest.TestCase):
    # El espejo numera los objetos por el orden alfabetico de sus carpetas: el
    # recorte <n>.png y el sitio n tienen que ser del mismo objeto que el n del
    # catalogo, o la mascara del motor recortaria el panel solar.
    def test_es_el_alfabetico(self):
        self.assertEqual(
            escenas.orden_de_objetos('electrica'),
            ['cadena-aisladores', 'motor-trifasico', 'multimetro', 'panel-solar',
             'transformador-trifasico'],
        )

    def test_coincide_con_las_carpetas_del_contenido(self):
        for cid in escenas.GUIONES:
            carpetas = sorted(os.listdir(os.path.join(escenas.CARRERAS, cid, 'objetos')))
            self.assertEqual(escenas.orden_de_objetos(cid), carpetas, cid)


class SitioDe(unittest.TestCase):
    def test_el_cero_es_el_lugar_y_los_demas_los_escondites(self):
        meta = {'lugar': {'x': 0.1}, 'escondites': [{'x': 0.2}, {'x': 0.3}]}
        self.assertEqual(escenas.sitio_de(meta, 0), {'x': 0.1})
        self.assertEqual(escenas.sitio_de(meta, 2), {'x': 0.3})


class RecorteDeCaja(unittest.TestCase):
    def test_agranda_la_caja_y_la_acota_a_la_imagen(self):
        imagen = Image.new('RGB', (1000, 2000))
        # 200x200 desde (0, 1000), mas la mitad de cada lado, cortado en el borde.
        recorte = escenas.recorte_de_caja(imagen, [0.0, 0.5, 0.2, 0.6], margen=0.5)
        self.assertEqual(recorte.size, (300, 400))


class GuardarRecorte(unittest.TestCase):
    def test_escribe_la_mascara_en_el_alfa_y_devuelve_su_caja(self):
        mascara = Image.new('L', (escenas.ANCHO, escenas.ALTO), 0)
        mascara.paste(255, (108, 192, 216, 384))
        with tempfile.TemporaryDirectory() as destino:
            caja = escenas.guardar_recorte(destino, 3, mascara)
            png = Image.open(os.path.join(destino, 'recortes', '3.png'))
            self.assertEqual(png.mode, 'RGBA')
            self.assertEqual(png.size, (108, 192))
            self.assertEqual(png.getchannel('A').getextrema(), (255, 255))
        self.assertEqual(caja, [0.1, 0.1, 0.2, 0.2])


class Metadata(unittest.TestCase):
    def test_lo_que_se_escribe_se_lee_igual(self):
        meta = {'lugar': {'x': 0.5, 'y': 0.2, 'escala': 0.16}, 'escondites': [],
                'recortes': [{'archivo': 'recortes/0.png', 'caja': [0.1, 0.1, 0.2, 0.2]}]}
        with tempfile.TemporaryDirectory() as destino:
            escenas.escribir_metadata(destino, meta)
            self.assertEqual(escenas.leer_metadata(destino), meta)
            with open(os.path.join(destino, 'metadata.json'), encoding='utf-8') as f:
                self.assertTrue(f.read().endswith('}\n'))


class MeterConReintento(unittest.TestCase):
    SITIO = {'x': 0.5, 'y': 0.5, 'escala': 0.17}

    def pintor(self, areas):
        """Un relleno falso: cada intento deja una silueta del area pedida, en fracciones del sitio."""
        objetivo = np.pi * (self.SITIO['escala'] * escenas.ANCHO / 2) ** 2
        semillas = []

        def pintar(pipe, escena, sitio, texto, semilla):
            m = np.zeros((escenas.ALTO, escenas.ANCHO), np.uint8)
            m.flat[: int(areas[len(semillas)] * objetivo)] = 255
            semillas.append(semilla)
            return Image.new('RGB', (escenas.ANCHO, escenas.ALTO)), Image.fromarray(m)

        return pintar, semillas

    @staticmethod
    def juez(presencias):
        return lambda recorte, texto: presencias.pop(0)

    def meter(self, areas, presencias=None, intentos=3):
        pintar, semillas = self.pintor(areas)
        juez = self.juez(list(presencias)) if presencias is not None else None
        _, _, razon, presencia, usados, _ = escenas.meter_con_reintento(
            None, None, self.SITIO, 'a blue motor, on the bench', 100,
            intentos=intentos, juez=juez, umbral=0.5, pintar=pintar)
        return razon, presencia, usados, semillas

    # EL BUG DE LOS 25 OBJETOS: la pared repintada tiene buena area y no es el
    # objeto. Con el juez, ese intento no pasa.
    def test_una_pared_repintada_no_pasa_por_objeto(self):
        razon, presencia, usados, _ = self.meter([0.6, 0.6], [0.1, 0.9])
        self.assertEqual(usados, 2)
        self.assertAlmostEqual(presencia, 0.9)

    def test_sin_juez_basta_el_area(self):
        razon, _, usados, _ = self.meter([0.1, 0.6])
        self.assertEqual(usados, 2)
        self.assertAlmostEqual(razon, 0.6, places=2)

    def test_si_ninguno_pasa_queda_el_que_mas_se_parece(self):
        _, presencia, usados, _ = self.meter([0.6, 0.6, 0.6], [0.2, 0.4, 0.3])
        self.assertEqual(usados, 3)
        self.assertAlmostEqual(presencia, 0.4)

    def test_cada_intento_usa_otra_semilla(self):
        *_, semillas = self.meter([0.6, 0.6, 0.6], [0.1, 0.1, 0.1])
        self.assertEqual(semillas, [100, 1077, 2054])


class InterpretarSolo(unittest.TestCase):
    def test_carrera_y_objeto_separados_por_coma(self):
        self.assertEqual(
            escenas.interpretar_solo('electrica:motor-trifasico, quimica:columna-destilacion'),
            [('electrica', 'motor-trifasico'), ('quimica', 'columna-destilacion')],
        )

    def test_vacio_es_ninguno(self):
        self.assertEqual(escenas.interpretar_solo(''), [])

    def test_un_id_que_no_existe_no_se_repinta(self):
        with self.assertRaises(ValueError):
            escenas.interpretar_solo('electrica:motor')
        with self.assertRaises(ValueError):
            escenas.interpretar_solo('electricidad:motor-trifasico')


class PlantarElObjeto(ConColores, unittest.TestCase):
    """
    SOBRE UNA SUPERFICIE LISA Y PAREJA EL RELLENO NO PINTA NADA. Con un estante
    gris oscuro debajo del ovalo, el modelo copiaba el estante, el texto no
    importaba y el resultado era el mismo con cualquier semilla: el panel solar,
    la base de datos y el matraz fallaron tres vueltas seguidas. Plantado el
    PNG del objeto en el ovalo, el modelo arranca de el, lo repinta con la luz
    del lugar y sale al primer intento.
    """

    @staticmethod
    def png_rojo(ancho=200, alto=100):
        png = Image.new('RGBA', (ancho + 40, alto + 40), (0, 0, 0, 0))
        png.paste((220, 30, 30, 255), (20, 20, 20 + ancho, 20 + alto))
        return png

    @staticmethod
    def mascara(caja=(312, 262, 712, 762)):
        m = Image.new('L', (1024, 1024), 0)
        m.paste(255, caja)
        return m

    # DEL TAMAÑO DEL SITIO, NO DEL OVALO ENTERO. Plantado a todo el ovalo —con
    # su borde difuminado— el objeto salia mas grande que su sitio: la base de
    # datos y el servidor pasaban el area maxima del control (1,68 y 1,58
    # contra 1,4). Va al 75 % del ovalo.
    def test_planta_el_png_centrado_y_al_tamano_del_sitio(self):
        ventana = Image.new('RGB', (1024, 1024), (60, 60, 60))
        plantada = escenas.plantar_objeto(ventana, self.mascara(), self.png_rojo())
        # El ovalo mide 400x500 y deja 300x375; el PNG, sin su borde
        # transparente, 200x100: crece hasta 300x150, centrado en (512, 512).
        self.assertColor(plantada.getpixel((512, 512)), (220, 30, 30))
        self.assertColor(plantada.getpixel((370, 512)), (220, 30, 30))
        # Ocupa de x=362 a x=662 y de y=437 a y=587: afuera, la ventana.
        self.assertColor(plantada.getpixel((340, 512)), (60, 60, 60))
        self.assertColor(plantada.getpixel((512, 425)), (60, 60, 60))
        self.assertColor(plantada.getpixel((100, 100)), (60, 60, 60))

    # LO FINO SE PLANTA ENTERO. La maqueta del puente —cables y un tablero
    # finito, el 27 % de su caja— al tamaño del sitio quedaba con lineas de un
    # par de pixeles, y el modelo las borraba a cualquier fuerza. Un PNG que
    # llena menos del 30 % de su caja va a todo el ovalo.
    def test_un_png_fino_se_planta_a_todo_el_ovalo(self):
        fino = Image.new('RGBA', (240, 140), (0, 0, 0, 0))
        dibujo = ImageDraw.Draw(fino)
        dibujo.line([(20, 20), (220, 120)], fill=(220, 30, 30, 255), width=6)
        dibujo.line([(20, 120), (220, 20)], fill=(220, 30, 30, 255), width=6)
        self.assertLess(escenas.cobertura(fino), 0.3)
        self.assertEqual(escenas.tamano_plantado(fino), 1.0)
        self.assertGreater(escenas.cobertura(self.png_rojo()), 0.9)
        self.assertEqual(escenas.tamano_plantado(self.png_rojo()), escenas.TAMANO_PLANTADO)

    def test_no_toca_la_ventana_que_recibe(self):
        ventana = Image.new('RGB', (1024, 1024), (60, 60, 60))
        escenas.plantar_objeto(ventana, self.mascara(), self.png_rojo())
        self.assertColor(ventana.getpixel((512, 512)), (60, 60, 60))

    def test_sin_png_la_ventana_queda_igual(self):
        ventana = Image.new('RGB', (1024, 1024), (60, 60, 60))
        self.assertIs(escenas.plantar_objeto(ventana, self.mascara(), None), ventana)

    def test_el_png_de_un_objeto_sale_de_su_carpeta(self):
        with tempfile.TemporaryDirectory() as raiz:
            carpeta = os.path.join(raiz, 'electrica', 'objetos', 'panel-solar')
            os.makedirs(carpeta)
            self.png_rojo().save(os.path.join(carpeta, 'imagen.png'))
            with mock.patch.object(escenas, 'CARRERAS', raiz):
                png = escenas.png_del_objeto('electrica', 'panel-solar')
                self.assertEqual(png.mode, 'RGBA')
                self.assertEqual(png.size, (240, 140))
                self.assertIsNone(escenas.png_del_objeto('electrica', 'no-existe'))


class ReintentoConElPng(unittest.TestCase):
    """meter_con_reintento: la mitad de los intentos con la ventana como esta y la otra mitad con el PNG plantado."""
    SITIO = {'x': 0.5, 'y': 0.5, 'escala': 0.17}

    def meter(self, presencias, png, sin_png=None):
        llamadas = []
        objetivo = np.pi * (self.SITIO['escala'] * escenas.ANCHO / 2) ** 2

        def pintar(pipe, escena, sitio, texto, semilla, png=None):
            llamadas.append((semilla, png))
            m = np.zeros((escenas.ALTO, escenas.ANCHO), np.uint8)
            m.flat[: int(0.6 * objetivo)] = 255
            return Image.new('RGB', (escenas.ANCHO, escenas.ALTO)), Image.fromarray(m)

        juez = lambda recorte, texto: presencias.pop(0)
        _, _, _, presencia, usados, con_png = escenas.meter_con_reintento(
            None, None, self.SITIO, 'a blue motor, on the bench', 100,
            intentos=6, juez=juez, umbral=0.5, pintar=pintar, png=png, sin_png=sin_png)
        self.con_png = con_png
        return llamadas, presencia, usados

    def test_si_el_relleno_solo_no_pinta_nada_prueba_con_el_png(self):
        png = Image.new('RGBA', (10, 10))
        llamadas, presencia, usados = self.meter([0.0, 0.0, 0.0, 0.95], png)
        self.assertEqual(usados, 4)
        self.assertAlmostEqual(presencia, 0.95)
        self.assertEqual([p is png for _, p in llamadas], [False, False, False, True])
        # Las semillas siguen siendo las de la tanda, en orden.
        self.assertEqual([s for s, _ in llamadas], [100, 1077, 2054, 3031])

    def test_sin_png_todos_los_intentos_son_con_la_ventana_como_esta(self):
        llamadas, _, usados = self.meter([0.0] * 6, None)
        self.assertEqual(usados, 6)
        self.assertEqual([p for _, p in llamadas], [None] * 6)

    def test_lo_que_sale_solo_no_necesita_el_png(self):
        llamadas, _, usados = self.meter([0.97], Image.new('RGBA', (10, 10)))
        self.assertEqual(usados, 1)
        self.assertEqual([p for _, p in llamadas], [None])
        self.assertFalse(self.con_png)

    # El que sale del PNG lo dice: es el que va a pedir el repaso local.
    def test_avisa_si_el_que_quedo_salio_del_png(self):
        self.meter([0.0, 0.0, 0.0, 0.95], Image.new('RGBA', (10, 10)))
        self.assertTrue(self.con_png)

    # Si ninguno pasa y el mejor es uno sin PNG, no hay nada que repasar.
    def test_si_ninguno_pasa_avisa_segun_el_mejor(self):
        self.meter([0.4, 0.0, 0.0, 0.1, 0.1, 0.1], Image.new('RGBA', (10, 10)))
        self.assertFalse(self.con_png)
        self.meter([0.0, 0.0, 0.0, 0.1, 0.4, 0.1], Image.new('RGBA', (10, 10)))
        self.assertTrue(self.con_png)

    # --con-png: el juez puede dar por bueno lo que no es —un gancho oxidado
    # por una viga oxidada—, y entonces el PNG no llega nunca. Con sin_png=0
    # todos los intentos arrancan de el.
    def test_sin_png_cero_arranca_del_png_desde_el_primer_intento(self):
        png = Image.new('RGBA', (10, 10))
        llamadas, _, usados = self.meter([0.97], png, sin_png=0)
        self.assertEqual(usados, 1)
        self.assertIs(llamadas[0][1], png)


class SemillaDe(unittest.TestCase):
    # Las fotos que ya estan se pintaron con estas semillas: la tanda 0 tiene que
    # repetirlas, o rearmar una carrera con --fase objetos ya no devolveria los
    # objetos que habian salido bien.
    def test_la_tanda_cero_repite_las_semillas_de_siempre(self):
        self.assertEqual(escenas.semilla_de('motor-trifasico'), 4090)
        self.assertEqual(escenas.semilla_de('motor-trifasico', repintado=True), 89)

    # --semilla 1 tiene que probar semillas NUEVAS: una tanda que repitiera
    # intentos de otra gastaria la placa en lo que ya fallo.
    def test_ninguna_tanda_repite_un_intento_de_otra(self):
        def intentos_de(semilla):
            usadas = []

            def pintar(pipe, escena, sitio, texto, s):
                usadas.append(s)
                # Una silueta vacia no pasa el control de area: se usan todos.
                return (Image.new('RGB', (escenas.ANCHO, escenas.ALTO)),
                        Image.new('L', (escenas.ANCHO, escenas.ALTO), 0))

            escenas.meter_con_reintento(None, None, {'x': 0.5, 'y': 0.5, 'escala': 0.17},
                                        'a blue motor, on the bench', semilla, pintar=pintar)
            return usadas

        tandas = [intentos_de(escenas.semilla_de('motor-trifasico'))]
        tandas += [intentos_de(escenas.semilla_de('motor-trifasico', tanda=t, repintado=True))
                   for t in range(4)]
        todas = [s for tanda in tandas for s in tanda]
        self.assertGreater(len(tandas[0]), 1)
        self.assertEqual(len(todas), len(set(todas)))


class Repintar(ConColores, unittest.TestCase):
    """
    repintar() sin GPU: el relleno es falso y la carrera vive en una carpeta
    temporal; el control de area, los recortes y el metadata son los de verdad.
    """
    # Un sitio por objeto de electrica, en el orden de sus carpetas
    # (cadena-aisladores, motor-trifasico, multimetro, panel-solar, transformador).
    SITIOS = [{'x': 0.5, 'y': 0.2, 'escala': 0.16}, {'x': 0.13, 'y': 0.55, 'escala': 0.17},
              {'x': 0.13, 'y': 0.35, 'escala': 0.17}, {'x': 0.87, 'y': 0.35, 'escala': 0.17},
              {'x': 0.87, 'y': 0.55, 'escala': 0.17}]

    def setUp(self):
        temporal = tempfile.TemporaryDirectory()
        self.addCleanup(temporal.cleanup)
        self.raiz = temporal.name
        self.destino = os.path.join(self.raiz, 'electrica', 'fondos', 'escena')
        os.makedirs(os.path.join(self.destino, 'recortes'))
        Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (90, 90, 90)).save(
            os.path.join(self.destino, 'imagen.jpg'), quality=94)
        recortes = []
        for i, s in enumerate(self.SITIOS):
            Image.new('RGBA', (40, 40), (255, 255, 255, 255)).save(
                os.path.join(self.destino, 'recortes', f'{i}.png'))
            recortes.append({'archivo': f'recortes/{i}.png',
                             'caja': [s['x'] - 0.02, s['y'] - 0.01, s['x'] + 0.02, s['y'] + 0.01]})
        escenas.escribir_metadata(self.destino, {'lugar': self.SITIOS[0],
                                                 'escondites': self.SITIOS[1:],
                                                 'recortes': recortes})

    def correr(self, pares, tanda=0, cortar_en=None, afinar=sin_cambios, con_png=False,
               repaso=sin_cambios):
        """repintar con el relleno falso. En el intento `cortar_en` se corta, como sin memoria."""
        semillas = []
        self.pngs = []

        def pintar(pipe, escena, sitio, texto, semilla, png=None):
            semillas.append(semilla)
            self.pngs.append(png)
            if len(semillas) == cortar_en:
                raise RuntimeError('CUDA out of memory')
            return pintado_en(escena, sitio)

        with mock.patch.object(escenas, 'CARRERAS', self.raiz), redirect_stdout(io.StringIO()):
            escenas.repintar(pares, juez=None, tanda=tanda, pintar=pintar, afinar=afinar,
                             con_png=con_png, repaso=repaso)
        return semillas

    def con_un_png(self, oid='motor-trifasico'):
        carpeta = os.path.join(self.raiz, 'electrica', 'objetos', oid)
        os.makedirs(carpeta, exist_ok=True)
        Image.new('RGBA', (20, 20), (0, 0, 255, 255)).save(os.path.join(carpeta, 'imagen.png'))

    def archivos(self):
        """Los bytes de todo lo que repintar puede escribir."""
        nombres = ['imagen.jpg', 'metadata.json'] + [f'recortes/{i}.png' for i in range(5)]
        return {n: leer(os.path.join(self.destino, n)) for n in nombres}

    @staticmethod
    def cambiados(antes, despues):
        return sorted(n for n in antes if antes[n] != despues[n])

    # La tanda tiene que llegar al relleno: si se quedara en el camino,
    # reintentar con --semilla daria exactamente lo mismo que la vez anterior.
    def test_usa_la_tanda_pedida(self):
        self.assertEqual(self.correr([('electrica', 'motor-trifasico')]), [89])
        self.assertEqual(self.correr([('electrica', 'motor-trifasico')], tanda=2), [11813])

    # LOS QUE YA ESTAN NO SE TOCAN: de un repintado cambian su recorte y su
    # caja, y nada mas. Los sitios tampoco se mueven.
    def test_reescribe_solo_el_recorte_y_la_caja_de_lo_repintado(self):
        antes, meta_antes = self.archivos(), escenas.leer_metadata(self.destino)
        self.correr([('electrica', 'motor-trifasico')])
        despues, meta = self.archivos(), escenas.leer_metadata(self.destino)

        self.assertEqual(self.cambiados(antes, despues),
                         ['imagen.jpg', 'metadata.json', 'recortes/1.png'])
        self.assertEqual(meta['lugar'], meta_antes['lugar'])
        self.assertEqual(meta['escondites'], meta_antes['escondites'])
        self.assertNotEqual(meta['recortes'][1]['caja'], meta_antes['recortes'][1]['caja'])
        for i in (0, 2, 3, 4):
            self.assertEqual(meta['recortes'][i], meta_antes['recortes'][i])

    # LO REPINTADO SE ARMONIZA, Y SOLO ESO. La pasada de armonia se queda
    # alrededor de lo que se pinto: los objetos que ya estaban no se tocan.
    def test_armoniza_solo_alrededor_de_lo_repintado(self):
        self.correr([('electrica', 'motor-trifasico')], afinar=en_verde)
        with Image.open(os.path.join(self.destino, 'imagen.jpg')) as foto:
            self.assertColor(foto.getpixel((140, 1056)), (40, 160, 60))
            # En el sitio de otro objeto, y lejos de todo, la foto como estaba.
            self.assertColor(foto.getpixel((940, 672)), (90, 90, 90))
            self.assertColor(foto.getpixel((540, 1700)), (90, 90, 90))

    # REPINTAR ARRANCA DE LA ESCENA VACIA. El modelo se ancla a lo que hay en el
    # ovalo: repintando encima de un objeto ya pintado, lo repetia. Si esta la
    # escena vacia de la carrera, su sitio se restaura antes de pintar.
    def test_el_sitio_se_restaura_desde_la_escena_vacia_antes_de_pintar(self):
        bases = os.path.join(self.raiz, 'escenas-base')
        os.makedirs(bases)
        Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (10, 200, 10)).save(
            os.path.join(bases, 'electrica.jpg'), quality=94)
        vistos = []

        def pintar(pipe, escena, sitio, texto, semilla, png=None):
            vistos.append(escena.getpixel((round(sitio['x'] * escenas.ANCHO),
                                           round(sitio['y'] * escenas.ALTO))))
            return pintado_en(escena, sitio)

        with mock.patch.object(escenas, 'CARRERAS', self.raiz), \
                mock.patch.object(escenas, 'BASES', bases), redirect_stdout(io.StringIO()):
            escenas.repintar([('electrica', 'motor-trifasico')], juez=None, pintar=pintar,
                             afinar=sin_cambios, repaso=sin_cambios)
        self.assertColor(vistos[0], (10, 200, 10), tolerancia=8)
        # Lejos del sitio, la foto como estaba.
        with Image.open(os.path.join(self.destino, 'imagen.jpg')) as foto:
            self.assertColor(foto.getpixel((540, 1800)), (90, 90, 90))

    def test_restaurar_un_sitio_toca_solo_su_ovalo(self):
        foto = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (90, 90, 90))
        vacia = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (10, 200, 10))
        sitio = {'x': 0.5, 'y': 0.5, 'escala': 0.17}
        restaurada = escenas.restaurar_sitio(foto, vacia, sitio)
        self.assertColor(restaurada.getpixel((540, 960)), (10, 200, 10))
        self.assertColor(restaurada.getpixel((540, 1400)), (90, 90, 90))
        self.assertColor(restaurada.getpixel((100, 960)), (90, 90, 90))
        self.assertColor(foto.getpixel((540, 960)), (90, 90, 90))

    def test_con_png_el_relleno_arranca_del_png_desde_el_primer_intento(self):
        self.con_un_png()
        self.correr([('electrica', 'motor-trifasico')], con_png=True)
        self.assertEqual(self.pngs[0].size, (20, 20))

    # LO QUE SALE DEL PNG SE REPASA. Plantado, el objeto conserva el aspecto de
    # su PNG —foto de producto, o un icono—, y se lee pegado: un repaso local
    # con el generador de la foto, con el texto del objeto, lo vuelve parte de la
    # escena. Se queda alrededor del objeto, y el texto es el suyo.
    def test_lo_que_sale_del_png_se_repasa_con_su_texto(self):
        self.con_un_png()
        textos = []

        def repaso(pipe, imagen, texto, semilla):
            textos.append(texto)
            return Image.new('RGB', imagen.size, (40, 160, 60))

        self.correr([('electrica', 'motor-trifasico')], con_png=True, repaso=repaso)
        self.assertEqual(textos, [dict(escenas.GUIONES['electrica']['objetos'])['motor-trifasico']])
        with Image.open(os.path.join(self.destino, 'imagen.jpg')) as foto:
            self.assertColor(foto.getpixel((140, 1056)), (40, 160, 60))
            self.assertColor(foto.getpixel((940, 672)), (90, 90, 90))

    def test_lo_que_sale_sin_png_no_se_repasa(self):
        llamado = []
        self.correr([('electrica', 'motor-trifasico')],
                    repaso=lambda pipe, imagen, texto, semilla: llamado.append(texto) or imagen)
        self.assertEqual(llamado, [])

    # UNA CORRIDA CORTADA NO DEJA UNA CARRERA A MEDIAS. Con recortes nuevos sobre
    # la foto vieja el espejo levantaria otra silueta que la pintada, y las
    # pruebas no lo notan: las cajas viejas siguen en su sitio.
    def test_si_se_corta_a_mitad_la_carrera_queda_como_estaba(self):
        antes = self.archivos()
        with self.assertRaises(RuntimeError):
            self.correr([('electrica', 'motor-trifasico'), ('electrica', 'panel-solar')],
                        cortar_en=2)
        self.assertEqual(self.cambiados(antes, self.archivos()), [])


class FaseObjetos(ConColores, unittest.TestCase):
    def rearmar(self, afinar=sin_cambios):
        """fase_objetos de electrica sobre una escena vacia gris, con el relleno falso."""
        semillas = []

        def pintar(pipe, escena, sitio, texto, semilla):
            semillas.append(semilla)
            return pintado_en(escena, sitio)

        temporal = tempfile.TemporaryDirectory()
        self.addCleanup(temporal.cleanup)
        raiz = temporal.name
        bases = os.path.join(raiz, 'escenas-base')
        os.makedirs(bases)
        Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (90, 90, 90)).save(
            os.path.join(bases, 'electrica.jpg'))
        with mock.patch.object(escenas, 'BASES', bases), \
                mock.patch.object(escenas, 'CARRERAS', raiz), redirect_stdout(io.StringIO()):
            escenas.fase_objetos(['electrica'], juez=None, tanda=1, pintar=pintar, afinar=afinar)
        return semillas, os.path.join(raiz, 'electrica', 'fondos', 'escena')

    # La salida de emergencia del plan —rearmar una carrera desde su escena
    # vacia— tambien tiene que poder pedir otra tanda.
    def test_usa_la_tanda_pedida(self):
        semillas, _ = self.rearmar()
        # El primero de GUIONES['electrica'] es el multimetro: 4922 en la tanda 0.
        self.assertEqual(semillas[0], 10784)

    def test_rearmar_una_carrera_la_armoniza(self):
        _, destino = self.rearmar(afinar=en_verde)
        lugar = escenas.leer_metadata(destino)['lugar']
        with Image.open(os.path.join(destino, 'imagen.jpg')) as foto:
            x, y = round(lugar['x'] * escenas.ANCHO), round(lugar['y'] * escenas.ALTO)
            self.assertColor(foto.getpixel((x, y)), (40, 160, 60))
            # Abajo al centro, donde va la persona, no hay objetos: no se toca.
            self.assertColor(foto.getpixel((540, 1800)), (90, 90, 90))


class Armonia(ConColores, unittest.TestCase):
    """
    Pintado de a uno, cada objeto sale con su propia luz y se lee pegado encima.
    La pasada de armonia repasa la foto a poca fuerza y se queda solo alrededor
    de los objetos.
    """

    @staticmethod
    def silueta(caja):
        m = Image.new('L', (escenas.ANCHO, escenas.ALTO), 0)
        m.paste(255, caja)
        return m

    # El alcance es el 5 % del ancho: 54 px en el espejo.
    def test_la_mascara_cubre_la_silueta_y_se_apaga_hacia_afuera(self):
        m = escenas.mascara_de_armonia([self.silueta((500, 900, 600, 1000))])
        self.assertEqual(m.getpixel((550, 950)), 255)
        self.assertTrue(100 < m.getpixel((627, 950)) < 160, m.getpixel((627, 950)))
        self.assertEqual(m.getpixel((660, 950)), 0)
        self.assertEqual(m.getpixel((100, 100)), 0)

    def test_sin_siluetas_no_toca_nada(self):
        m = escenas.mascara_de_armonia([Image.new('L', (escenas.ANCHO, escenas.ALTO), 0)])
        self.assertEqual(m.getextrema(), (0, 0))

    # El recorte guardado y su caja devuelven la silueta en su lugar: es como
    # la pasada sabe donde estan los objetos de una foto que ya esta hecha.
    def test_la_silueta_vuelve_de_su_recorte_y_su_caja(self):
        with tempfile.TemporaryDirectory() as destino:
            caja = escenas.guardar_recorte(destino, 2, self.silueta((108, 192, 216, 384)))
            vuelta = escenas.mascara_del_recorte(destino, {'archivo': 'recortes/2.png', 'caja': caja})
        self.assertEqual(vuelta.size, (escenas.ANCHO, escenas.ALTO))
        self.assertEqual(vuelta.getbbox(), (108, 192, 216, 384))

    def foto_con_objetos(self, raiz):
        """Una carrera gris con dos objetos rojos, sus recortes y su metadata."""
        destino = os.path.join(raiz, 'electrica', 'fondos', 'escena')
        os.makedirs(destino)
        foto = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (90, 90, 90))
        cajas = [(100, 500, 200, 600), (880, 500, 980, 600)]
        for caja in cajas:
            foto.paste((220, 30, 30), caja)
        foto.save(os.path.join(destino, 'imagen.jpg'), quality=94)
        recortes = [{'archivo': f'recortes/{i}.png',
                     'caja': escenas.guardar_recorte(destino, i, self.silueta(caja))}
                    for i, caja in enumerate(cajas)]
        escenas.escribir_metadata(destino, {'lugar': {}, 'escondites': [], 'recortes': recortes})
        return destino

    @staticmethod
    def juez_del_rojo(recorte, texto):
        """Un juez falso: el objeto esta si en su recorte queda rojo."""
        r, g, b = recorte.convert('RGB').resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
        return 0.95 if r > g + 30 else 0.05

    # LA ARMONIA NO PUEDE BORRAR UN OBJETO. A la maqueta del puente —fina, clara
    # sobre una mesada gris— el repaso la disolvio en el concreto: 0,93 al
    # pintarla, 0,17 despues. Con el juez, el repaso que hace desaparecer un
    # objeto se descarta y queda como estaba.
    def test_el_repaso_que_borra_un_objeto_se_descarta(self):
        with tempfile.TemporaryDirectory() as raiz:
            destino = self.foto_con_objetos(raiz)
            gris = lambda pipe, imagen, texto, semilla: Image.new('RGB', imagen.size, (90, 90, 90))
            with mock.patch.object(escenas, 'CARRERAS', raiz), redirect_stdout(io.StringIO()):
                escenas.armonizar(['electrica'], afinar=sin_cambios, repasar={'electrica': [0]},
                                  repaso=gris, juez=self.juez_del_rojo)
            with Image.open(os.path.join(destino, 'imagen.jpg')) as foto:
                self.assertColor(foto.getpixel((150, 550)), (220, 30, 30), tolerancia=12)

    def test_la_pasada_que_borra_un_objeto_lo_deja_como_estaba(self):
        with tempfile.TemporaryDirectory() as raiz:
            destino = self.foto_con_objetos(raiz)
            gris = lambda pipe, imagen, texto, semilla: Image.new('RGB', imagen.size, (90, 90, 90))
            with mock.patch.object(escenas, 'CARRERAS', raiz), redirect_stdout(io.StringIO()):
                escenas.armonizar(['electrica'], afinar=gris, juez=self.juez_del_rojo)
            with Image.open(os.path.join(destino, 'imagen.jpg')) as foto:
                self.assertColor(foto.getpixel((150, 550)), (220, 30, 30), tolerancia=12)
                self.assertColor(foto.getpixel((930, 550)), (220, 30, 30), tolerancia=12)

    # La que no borra nada queda: la guarda no frena la armonia.
    def test_la_pasada_que_no_borra_nada_queda(self):
        with tempfile.TemporaryDirectory() as raiz:
            destino = self.foto_con_objetos(raiz)
            rojiza = lambda pipe, imagen, texto, semilla: Image.new('RGB', imagen.size, (200, 60, 40))
            with mock.patch.object(escenas, 'CARRERAS', raiz), redirect_stdout(io.StringIO()):
                escenas.armonizar(['electrica'], afinar=rojiza, juez=self.juez_del_rojo)
            with Image.open(os.path.join(destino, 'imagen.jpg')) as foto:
                self.assertColor(foto.getpixel((150, 550)), (200, 60, 40), tolerancia=12)

    def test_armoniza_alrededor_de_cada_objeto_y_pide_su_tanda(self):
        pedidos = []

        def armonia(pipe, imagen, texto, semilla):
            pedidos.append((texto, semilla))
            return en_verde(pipe, imagen, texto, semilla)

        with tempfile.TemporaryDirectory() as raiz:
            destino = os.path.join(raiz, 'electrica', 'fondos', 'escena')
            os.makedirs(destino)
            Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (90, 90, 90)).save(
                os.path.join(destino, 'imagen.jpg'), quality=94)
            recortes = [{'archivo': f'recortes/{i}.png',
                         'caja': escenas.guardar_recorte(destino, i, self.silueta(caja))}
                        for i, caja in enumerate([(100, 500, 200, 600), (880, 500, 980, 600)])]
            escenas.escribir_metadata(destino, {'lugar': {}, 'escondites': [], 'recortes': recortes})

            with mock.patch.object(escenas, 'CARRERAS', raiz), redirect_stdout(io.StringIO()):
                escenas.armonizar(['electrica'], tanda=1, afinar=armonia)

            with Image.open(os.path.join(destino, 'imagen.jpg')) as foto:
                self.assertColor(foto.getpixel((150, 550)), (40, 160, 60))
                self.assertColor(foto.getpixel((930, 550)), (40, 160, 60))
                self.assertColor(foto.getpixel((540, 1500)), (90, 90, 90))
        self.assertEqual(pedidos, [(escenas.GUIONES['electrica']['escena'], 13642)])


class Apaisada(ConColores, unittest.TestCase):
    """
    La version apaisada de un fondo: la misma escena extendida a 16:9, con la
    foto vertical centrada a todo el alto. El espejo dibuja la foto encima y de
    la apaisada usa solo los costados.
    """

    @staticmethod
    def foto():
        # Una mitad de cada color: se ve si quedo centrada y sin espejar.
        foto = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (40, 90, 160))
        foto.paste((160, 90, 40), (escenas.ANCHO // 2, 0, escenas.ANCHO, escenas.ALTO))
        return foto

    # La foto va a todo el alto en el medio: 608 px de ancho, de x=656 a x=1264.
    def test_el_lienzo_pone_la_foto_en_el_medio_a_todo_el_alto(self):
        lienzo = escenas.lienzo_apaisado(self.foto())
        self.assertEqual(lienzo.size, (1920, 1080))
        self.assertColor(lienzo.getpixel((700, 540)), (40, 90, 160))
        self.assertColor(lienzo.getpixel((1220, 540)), (160, 90, 40))

    # LOS COSTADOS ARRANCAN CON LA ESCENA REFLEJADA EN EL BORDE. Es lo que le da
    # al modelo los colores, la luz y la textura de la foto: arrancando de la
    # foto desenfocada salian blandos, y de la nada, de otro color. Y se refleja
    # la escena VACIA: reflejada la foto, sus objetos aparecerian dos veces.
    def test_los_costados_arrancan_con_la_escena_vacia_reflejada_en_el_borde(self):
        vacia = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (20, 200, 20))
        vacia.paste((200, 200, 20), (escenas.ANCHO // 2, 0, escenas.ANCHO, escenas.ALTO))
        lienzo = escenas.lienzo_apaisado(self.foto(), vacia)
        # EL MODELO NO VE LOS OBJETOS: lo que extiende es la escena vacia. Viendo
        # la foto los repetia —un segundo brazo robotico pegado a la costura en
        # Produccion, cajas sembradas por todo el piso alrededor del pallet—, y
        # la foto se pega recien al final.
        self.assertColor(lienzo.getpixel((700, 540)), (20, 200, 20))
        # Pegado al borde izquierdo de la foto va el borde izquierdo de la escena.
        self.assertColor(lienzo.getpixel((600, 540)), (20, 200, 20))
        self.assertColor(lienzo.getpixel((100, 540)), (200, 200, 20))
        # Y pegado al derecho, el derecho.
        self.assertColor(lienzo.getpixel((1320, 540)), (200, 200, 20))
        self.assertColor(lienzo.getpixel((1820, 540)), (20, 200, 20))
        # Despues de un reflejo entero, la escena sigue derecha: el borde de
        # afuera del reflejo continua en el mismo borde.
        self.assertColor(lienzo.getpixel((20, 540)), (200, 200, 20))
        self.assertColor(lienzo.getpixel((1900, 540)), (20, 200, 20))

    def test_sin_escena_vacia_refleja_la_foto(self):
        lienzo = escenas.lienzo_apaisado(self.foto())
        self.assertColor(lienzo.getpixel((600, 540)), (40, 90, 160))
        self.assertColor(lienzo.getpixel((100, 540)), (160, 90, 40))
        self.assertColor(lienzo.getpixel((1320, 540)), (160, 90, 40))
        self.assertColor(lienzo.getpixel((1820, 540)), (40, 90, 160))

    # DE A POCO, NUNCA DE UNA. Pintando los dos costados de una sola vez el
    # modelo inventaba dos tercios del lienzo y armaba otra escena: se leia como
    # una foto pegada al lado. Cada ventana es del alto de la imagen, tiene a un
    # lado lo que falta y al otro lo que ya hay, y lo que falta nunca pasa de lo
    # que la foto deja libre en una ventana cuadrada.
    def test_extiende_de_a_pasos_desde_la_foto_hacia_los_bordes(self):
        self.assertEqual(escenas.ventanas_de_extension(1920, 1080, 608), [
            (184, 184, 656), (0, 0, 184),          # izquierda: de la foto al borde
            (656, 1264, 1736), (840, 1736, 1920),  # derecha
        ])

    # Lo que pasa por el modelo vuelve un poco cambiado: el medio de la apaisada
    # es la foto original, para que calce con la que el espejo dibuja encima.
    def test_compone_los_costados_pintados_con_la_foto_original_en_el_medio(self):
        pintado = Image.new('RGB', (1920, 1080), (200, 40, 40))
        final = escenas.componer_apaisada(pintado, self.foto())
        self.assertEqual(final.size, (1920, 1080))
        self.assertColor(final.getpixel((100, 540)), (200, 40, 40))
        self.assertColor(final.getpixel((1820, 540)), (200, 40, 40))
        self.assertColor(final.getpixel((700, 540)), (40, 90, 160))
        self.assertColor(final.getpixel((1220, 540)), (160, 90, 40))

    # LA COSTURA. Lo que pinta el modelo justo afuera del borde nunca es igual a
    # la foto, y en una pantalla grande se veia una linea: pegado al borde, el
    # costado es el reflejo de la escena, que lo continua pixel a pixel, y se
    # funde con lo pintado hacia afuera. El reflejo es de la escena VACIA: los
    # objetos de los costados llegan a catorce pixeles del borde.
    def test_la_costura_es_la_escena_reflejada_fundida_con_lo_pintado(self):
        vacia = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (20, 200, 20))
        vacia.paste((200, 200, 20), (escenas.ANCHO // 2, 0, escenas.ANCHO, escenas.ALTO))
        pintado = Image.new('RGB', (1920, 1080), (200, 40, 40))
        final = escenas.componer_apaisada(pintado, self.foto(), vacia)
        # Pegado a cada borde, el borde de la escena.
        self.assertColor(final.getpixel((655, 540)), (20, 200, 20), tolerancia=12)
        self.assertColor(final.getpixel((1264, 540)), (200, 200, 20), tolerancia=12)
        # Lejos del borde, lo pintado tal cual.
        self.assertColor(final.getpixel((200, 540)), (200, 40, 40))
        self.assertColor(final.getpixel((1720, 540)), (200, 40, 40))
        # En el medio del fundido, una mezcla de los dos.
        mitad = final.getpixel((656 - escenas.FUNDIDO // 2, 540))
        self.assertTrue(20 < mitad[0] < 200 and 40 < mitad[1] < 200, mitad)

    # LA COSTURA EN BAJA FRECUENCIA. Aunque el borde calce, lo pintado puede
    # quedar mas claro o mas oscuro que la foto, y se ve una franja de arriba a
    # abajo (en Naval, el piso): la diferencia de tono a lo largo del borde se le
    # suma a lo pintado, y se va apagando hacia afuera.
    def test_cerca_del_borde_lo_pintado_toma_el_tono_de_la_foto(self):
        foto = Image.new('RGB', (escenas.ANCHO, escenas.ALTO), (160, 160, 160))
        pintado = Image.new('RGB', (1920, 1080), (100, 100, 100))
        final = escenas.componer_apaisada(pintado, foto)
        self.assertGreater(final.getpixel((600, 540))[0], 140)
        self.assertGreater(final.getpixel((1320, 540))[0], 140)
        self.assertColor(final.getpixel((200, 540)), (100, 100, 100))
        self.assertColor(final.getpixel((1720, 540)), (100, 100, 100))

    # La apaisada se suma al fondo: la foto vertical, sus recortes y su
    # metadata son lo que ya funciona en el espejo, y no se tocan.
    def test_apaisar_escribe_la_apaisada_y_no_toca_la_vertical(self):
        pedidos, afinados = [], []

        def pintar(pipe, lienzo, mascara, texto, semilla):
            pedidos.append((lienzo.size, mascara.size, texto, semilla))
            return Image.new('RGB', lienzo.size, (200, 40, 40))

        def afinar(pipe, imagen, texto, semilla):
            afinados.append((imagen.size, imagen.getpixel((100, 540)), imagen.getpixel((700, 540)),
                             semilla))
            return Image.new('RGB', imagen.size, (40, 160, 60))

        with tempfile.TemporaryDirectory() as raiz:
            destino = os.path.join(raiz, 'forestal', 'fondos', 'escena')
            os.makedirs(destino)
            self.foto().save(os.path.join(destino, 'imagen.jpg'), quality=94)
            antes = leer(os.path.join(destino, 'imagen.jpg'))

            with mock.patch.object(escenas, 'CARRERAS', raiz), \
                    mock.patch.object(escenas, 'BASES', os.path.join(raiz, 'escenas-base')), \
                    redirect_stdout(io.StringIO()):
                escenas.apaisar(['forestal'], tanda=1, pintar=pintar, afinar=afinar)

            with Image.open(os.path.join(destino, 'imagen-apaisada.jpg')) as apaisada:
                self.assertEqual(apaisada.size, (1920, 1080))
                # Los costados son lo afinado; el medio, la foto original.
                self.assertColor(apaisada.getpixel((100, 540)), (40, 160, 60), tolerancia=8)
                self.assertColor(apaisada.getpixel((700, 540)), (40, 90, 160), tolerancia=8)
            self.assertEqual(leer(os.path.join(destino, 'imagen.jpg')), antes)
            self.assertEqual(sorted(os.listdir(destino)), ['imagen-apaisada.jpg', 'imagen.jpg'])

        # Cuatro ventanas, a la medida del modelo, cada una con su semilla: la
        # tanda 0 de 'forestal' empieza en 4968 y la 1, seis intentos mas alla.
        self.assertEqual([p[:2] for p in pedidos], [((1024, 1024), (1024, 1024))] * 4)
        self.assertTrue(all(p[2].startswith(escenas.GUIONES['forestal']['escena']) for p in pedidos))
        self.assertEqual([p[3] for p in pedidos], [10830, 11807, 12784, 13761])
        # LA PASADA FINA. El modelo de relleno deja los costados mas blandos que
        # la foto, y el borde se leia como una costura: el generador de la foto
        # repasa la imagen entera, ya con los costados pintados y la foto en el
        # medio, con la semilla que sigue en la tanda.
        [(tamano, costado, medio, semilla)] = afinados
        self.assertEqual(tamano, (1920, 1080))
        self.assertColor(costado, (200, 40, 40), tolerancia=8)
        self.assertColor(medio, (40, 90, 160), tolerancia=8)
        self.assertEqual(semilla, 14738)


class LineaDeComandos(unittest.TestCase):
    def correr_main(self, *argumentos):
        """main() con las fases reemplazadas por espias: anota en self.tandas la que recibio cada una."""
        self.tandas = {}
        self.juez_creado = False

        def juez():
            self.juez_creado = True

        def repintar(pares, juez, umbral=None, tanda=0, pintar=None, con_png=False):
            self.tandas['repintar'] = tanda
            self.con_png = con_png

        def fase_objetos(ids, juez, umbral=None, tanda=0, pintar=None):
            self.tandas['fase_objetos'] = tanda

        def apaisar(ids, tanda=0, pintar=None):
            self.tandas['apaisar'] = (ids, tanda)

        def armonizar(ids, tanda=0, afinar=None, solo=None, repasar=None, repaso=None):
            self.tandas['armonizar'] = (ids, tanda)
            self.solo, self.repasar = solo, repasar

        with mock.patch.object(sys, 'argv', ['escenas.py', *argumentos]), \
                mock.patch.object(escenas, 'Juez', juez), \
                mock.patch.object(escenas, 'hoja_de_contacto', lambda: None), \
                mock.patch.object(escenas, 'hoja_de_apaisadas', lambda: None), \
                mock.patch.object(escenas, 'repintar', repintar), \
                mock.patch.object(escenas, 'fase_objetos', fase_objetos), \
                mock.patch.object(escenas, 'apaisar', apaisar), \
                mock.patch.object(escenas, 'armonizar', armonizar):
            escenas.main()

    # Armonizar las fotos que ya estan, sin repintar nada: tampoco usa al juez.
    def test_armonizar_pasa_la_tanda_y_no_carga_el_juez(self):
        self.correr_main('--armonizar', 'produccion', '--semilla', '2')
        self.assertEqual(self.tandas, {'armonizar': (['produccion'], 2)})
        self.assertFalse(self.juez_creado)

    # --repasar: el repaso local sobre objetos ya pintados, sin repintarlos. Lo
    # que salio bien del PNG antes de que existiera el repaso no tiene por que
    # volver a tirarse.
    def test_repasar_repasa_solo_esos_objetos_y_no_carga_el_juez(self):
        self.correr_main('--repasar', '--solo', 'electrica:panel-solar,quimica:matraz-erlenmeyer')
        # panel-solar es el 3 de electrica; matraz-erlenmeyer, el 3 de quimica.
        self.assertEqual(self.tandas, {'armonizar': (['electrica', 'quimica'], 0)})
        self.assertEqual(self.repasar, {'electrica': [3], 'quimica': [3]})
        self.assertEqual(self.solo, {'electrica': [3], 'quimica': [3]})
        self.assertFalse(self.juez_creado)

    def test_repasar_sin_lista_no_hace_nada(self):
        with self.assertRaises(SystemExit):
            self.correr_main('--repasar')
        self.assertEqual(self.tandas, {})

    # La extension no usa al juez: pedirlo bajaria CLIP, 1,7 GB, para nada.
    def test_apaisar_pasa_la_tanda_y_no_carga_el_juez(self):
        self.correr_main('--apaisar', 'forestal', '--semilla', '1')
        self.assertEqual(self.tandas, {'apaisar': (['forestal'], 1)})
        self.assertFalse(self.juez_creado)

    def test_semilla_llega_a_repintar(self):
        self.correr_main('--repintar', '--semilla', '2', '--solo', 'electrica:motor-trifasico')
        self.assertEqual(self.tandas, {'repintar': 2})
        self.assertFalse(self.con_png)

    def test_con_png_llega_a_repintar(self):
        self.correr_main('--repintar', '--con-png', '--solo', 'electrica:motor-trifasico')
        self.assertTrue(self.con_png)

    def test_semilla_llega_a_la_fase_de_objetos(self):
        self.correr_main('--fase', 'objetos', 'electrica', '--semilla', '1')
        self.assertEqual(self.tandas, {'fase_objetos': 1})

    # LA LISTA ES EXPLICITA: un objeto presente que el juez diera por ausente se
    # arruinaria al repintarlo, asi que --repintar sin --solo no pinta nada.
    def test_repintar_sin_lista_no_pinta_nada(self):
        with self.assertRaises(SystemExit):
            self.correr_main('--repintar')
        self.assertEqual(self.tandas, {})


class Guiones(unittest.TestCase):
    # Las superficies que nombran los VACIOS de presencia.py.
    SITIOS = {'ceiling', 'wall', 'shelf', 'bench', 'workbench', 'floor', 'logs', 'window',
              'lockers', 'racks'}

    # EL JUEZ NO LEE EL SITIO. Le pregunta a CLIP si el recorte se parece mas al
    # objeto que a un sitio vacio, y si la pregunta nombra el sitio una pared
    # vacia ya se parece un poco al objeto: justo en los del techo, que son los
    # que mas fallaron. Cada texto va 'el objeto, el sitio'.
    def test_el_juez_no_lee_el_sitio(self):
        leen_el_sitio = [
            f'{cid}:{oid}'
            for cid, guion in escenas.GUIONES.items()
            for oid, texto in guion['objetos']
            if self.SITIOS & set(re.findall(r'[a-z]+', texto_del_objeto(texto).lower()))
        ]
        self.assertEqual(leen_el_sitio, [])


if __name__ == '__main__':
    unittest.main()

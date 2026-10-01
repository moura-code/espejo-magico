# Pruebas de las partes de herramientas/escenas.py que no necesitan la GPU: el
# orden de los objetos, sus sitios, sus recortes, como se guardan y el
# reintento que exige que el objeto este pintado. El modelo de relleno y CLIP
# se reemplazan por funciones falsas.
#
#   python -m unittest discover -s tests/herramientas -v
import os
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'herramientas'))

import escenas  # noqa: E402


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
        _, _, razon, presencia, usados = escenas.meter_con_reintento(
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


if __name__ == '__main__':
    unittest.main()

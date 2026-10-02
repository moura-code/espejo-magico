# Pruebas del juez de presencia (herramientas/presencia.py). Sin CLIP: lo que se
# prueba es lo que se hace con lo que CLIP contesta.
#
#   python -m unittest discover -s tests/herramientas -v
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'herramientas'))

from presencia import esta_presente, probabilidad_del_objeto, texto_del_objeto  # noqa: E402


class TextoDelObjeto(unittest.TestCase):
    def test_saca_el_sitio(self):
        self.assertEqual(
            texto_del_objeto('a blue three phase induction electric motor, on the bench'),
            'a blue three phase induction electric motor',
        )

    def test_sin_sitio_queda_igual(self):
        texto = 'a yellow digital multimeter with test leads'
        self.assertEqual(texto_del_objeto(texto), texto)


class ProbabilidadDelObjeto(unittest.TestCase):
    def test_el_objeto_que_domina_se_lleva_casi_todo(self):
        self.assertGreater(probabilidad_del_objeto([30.0, 20.0, 21.0, 19.5]), 0.99)

    def test_un_vacio_que_domina_deja_al_objeto_en_casi_nada(self):
        self.assertLess(probabilidad_del_objeto([20.0, 30.0, 21.0]), 0.01)

    def test_empatados_se_reparten(self):
        self.assertAlmostEqual(probabilidad_del_objeto([25.0, 25.0, 25.0, 25.0]), 0.25)

    def test_no_se_desborda_con_logits_grandes(self):
        self.assertAlmostEqual(probabilidad_del_objeto([1000.0, 1000.0]), 0.5)


class EstaPresente(unittest.TestCase):
    def test_desde_el_umbral(self):
        self.assertTrue(esta_presente(0.5, umbral=0.5))
        self.assertFalse(esta_presente(0.49, umbral=0.5))


if __name__ == '__main__':
    unittest.main()

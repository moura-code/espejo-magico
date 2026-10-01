#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
herramientas/presencia.py — si un objeto esta de verdad pintado en la foto.

El generador (escenas.py) pinta cada instrumento adentro de la escena con
inpainting, y a veces el modelo NO lo pinta: rehace la pared o el estante un
poco distinto y nada mas. El control que habia media cuanto cambio la ventana,
y una pared repintada tambien cambia: asi quedaron sin pintar unos 25 de los 60
objetos, con su mascara, su latido y su ficha hablando de nada.

Aca se le pregunta a CLIP, que compara imagenes con textos, si el recorte se
parece mas al objeto que a lo que hay en un sitio vacio. Corre en CPU a
proposito: en la GPU no entra junto al modelo de relleno, y juzgar un recorte
lleva menos de un segundo.
"""
import numpy as np

MODELO = 'openai/clip-vit-large-patch14'

# Lo que se ve en un sitio donde el objeto no se pinto: las superficies que
# piden los guiones de las escenas (escenas.py) y lo que el modelo deja cuando
# repinta el techo. Si una escena nueva trae otra cosa, va aca.
VACIOS = [
    'an empty shelf',
    'a bare wall',
    'an empty workbench',
    'a ceiling with fluorescent lights',
    'empty metal lockers',
    'empty storage racks',
    'an empty floor',
    'a window',
    'tree trunks in a forest',
    'a pile of cut logs',
]

# Desde cuanta probabilidad de ser el objeto se lo da por pintado. Se calibra
# con `escenas.py --revisar` contra la tabla del plan
# (docs/superpowers/plans/2026-10-01-objetos-faltantes.md).
UMBRAL = 0.5


def texto_del_objeto(texto):
    """
    Lo que se le pregunta a CLIP: el objeto, sin donde esta. 'a blue motor, on
    the bench' -> 'a blue motor'. El sitio lo comparten los vacios, y
    compararlo empataria justo lo que se quiere distinguir.
    """
    return texto.split(',')[0].strip()


def probabilidad_del_objeto(logits):
    """
    Las similitudes de CLIP —primero la del objeto, despues las de los vacios—
    pasadas a la probabilidad de que el recorte sea el objeto (softmax).
    """
    valores = np.asarray(logits, dtype=np.float64)
    exponenciales = np.exp(valores - valores.max())
    return float(exponenciales[0] / exponenciales.sum())


def esta_presente(probabilidad, umbral=UMBRAL):
    return probabilidad >= umbral


class Juez:
    """CLIP, cargado una vez. `juez(recorte, texto)` -> probabilidad de 0 a 1."""

    def __init__(self, modelo=MODELO, dispositivo='cpu'):
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self._torch = torch
        self._modelo = CLIPModel.from_pretrained(modelo).to(dispositivo).eval()
        self._procesador = CLIPProcessor.from_pretrained(modelo)
        self._dispositivo = dispositivo

    def __call__(self, recorte, texto):
        textos = [f'a photo of {texto_del_objeto(texto)}'] + [f'a photo of {v}' for v in VACIOS]
        entradas = self._procesador(
            text=textos, images=recorte.convert('RGB'), return_tensors='pt', padding=True,
        ).to(self._dispositivo)
        with self._torch.no_grad():
            logits = self._modelo(**entradas).logits_per_image[0]
        return probabilidad_del_objeto(logits.cpu().numpy())

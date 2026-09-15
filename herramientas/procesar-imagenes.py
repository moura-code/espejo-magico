#!/usr/bin/env python3
"""
herramientas/procesar-imagenes.py

Procesa y estandariza las imágenes de los objetos para el Espejo Mágico:
- Normaliza cada objeto a un lienzo cuadrado 1:1 (768×768 px).
- Si tiene fondo claro o de estudio, remueve el fondo por floodfill y centra
  la silueta con margen armónico (~88% del diámetro).
- Si es una fotografía con fondo complejo, realiza encuadre cuadrado centrado
  y aplica una máscara circular con suavizado de bordes (anti-aliased) para
  que se integre como un medallón pulido dentro del halo dorado y el disco base.
"""

import os
import sys
import glob
import json
from PIL import Image, ImageDraw

def procesar_archivo(ruta_in, ruta_out, target_size=768):
    os.makedirs(os.path.dirname(ruta_out), exist_ok=True)
    im = Image.open(ruta_in).convert('RGBA')
    w, h = im.size

    # 1. Detectar si los bordes tienen fondo claro para removerlo
    puntos_borde = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)
    ]
    puntos_claros = []
    for bx, by in puntos_borde:
        p = im.getpixel((bx, by))
        if len(p) > 3 and p[3] == 0:
            continue
        if p[0] > 215 and p[1] > 215 and p[2] > 215:
            puntos_claros.append((bx, by))

    if len(puntos_claros) >= 2:
        for px, py in puntos_claros:
            try:
                ImageDraw.floodfill(im, (px, py), (0, 0, 0, 0), thresh=38)
            except Exception:
                pass

    # 2. Comprobar si quedó transparente
    alpha = im.split()[3]
    extrema = alpha.getextrema()
    is_transparent = extrema[0] < 200

    if is_transparent:
        bbox = im.getbbox()
        if bbox:
            obj = im.crop(bbox)
            ow, oh = obj.size
            max_inner = int(target_size * 0.88)
            escala = min(max_inner / ow, max_inner / oh)
            new_w, new_h = max(1, int(ow * escala)), max(1, int(oh * escala))
            obj_resized = obj.resize((new_w, new_h), Image.Resampling.LANCZOS)

            canvas = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
            ox = (target_size - new_w) // 2
            oy = (target_size - new_h) // 2
            canvas.paste(obj_resized, (ox, oy), obj_resized)
            canvas.save(ruta_out, 'PNG', optimize=True)
            return 'recorte', (target_size, target_size)

    # 3. Fotografía sólida: encuadre cuadrado centrado y máscara circular con anti-aliasing
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    cropped = im.crop((left, top, left + side, top + side)).resize(
        (target_size, target_size), Image.Resampling.LANCZOS
    )

    # Máscara circular con 2x supersampling para bordes impecables
    mask_hi = Image.new('L', (target_size * 2, target_size * 2), 0)
    draw = ImageDraw.Draw(mask_hi)
    draw.ellipse((8, 8, target_size * 2 - 9, target_size * 2 - 9), fill=255)
    mask = mask_hi.resize((target_size, target_size), Image.Resampling.LANCZOS)

    cropped.putalpha(mask)
    cropped.save(ruta_out, 'PNG', optimize=True)
    return 'medallon_circular', (target_size, target_size)

def procesar_todo():
    raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    descargas_dir = os.path.join(raiz, 'contenido', 'comun', 'banco', 'descargas')
    manifest_path = os.path.join(raiz, 'contenido', 'comun', 'objetos-manifest.json')

    if not os.path.exists(manifest_path):
        print(f"No se encontró el manifest en {manifest_path}")
        return

    with open(manifest_path, 'r', encoding='utf8') as f:
        manifest = json.load(f)

    print("\nProcesando y normalizando todas las imágenes de objetos (768x768 1:1)...\n")
    total = 0
    recortes = 0
    medallones = 0

    for c in manifest:
        carrera_id = c['carrera']
        for o in c['objetos']:
            obj_id = o['id']
            # Buscar archivo descargado
            archivos = glob.glob(os.path.join(descargas_dir, carrera_id, f"{obj_id}.*"))
            if not archivos:
                # Si no está en descargas, intentar usar imagen.png existente
                if o['activo']:
                    existente = os.path.join(raiz, 'contenido', 'carreras', carrera_id, 'objetos', obj_id, 'imagen.png')
                else:
                    existente = os.path.join(raiz, 'contenido', 'comun', 'banco', carrera_id, f"{obj_id}.png")
                if os.path.exists(existente):
                    archivos = [existente]
                else:
                    print(f"  [ALERTA] No se encontró imagen para {carrera_id}/{obj_id}")
                    continue

            src = archivos[0]
            if o['activo']:
                dest = os.path.join(raiz, 'contenido', 'carreras', carrera_id, 'objetos', obj_id, 'imagen.png')
            else:
                dest = os.path.join(raiz, 'contenido', 'comun', 'banco', carrera_id, f"{obj_id}.png")

            tipo, size = procesar_archivo(src, dest)
            total += 1
            if tipo == 'recorte':
                recortes += 1
                tag = 'SILUETA '
            else:
                medallones += 1
                tag = 'MEDALLON'

            print(f"  [{tag}] {carrera_id.ljust(18)} {obj_id.ljust(26)} -> {size[0]}x{size[1]}")

    print(f"\nProcesamiento completo: {total} objetos procesados ({recortes} siluetas, {medallones} medallones circulares).")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--todos':
        procesar_todo()
    elif len(sys.argv) > 2:
        in_path, out_path = sys.argv[1], sys.argv[2]
        tipo, size = procesar_archivo(in_path, out_path)
        print(f"OK: {out_path} {size} tipo={tipo}")
    else:
        print("Uso:")
        print("  procesar-imagenes.py <in_file> <out_file>")
        print("  procesar-imagenes.py --todos")

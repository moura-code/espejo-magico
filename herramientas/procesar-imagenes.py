#!/usr/bin/env python3
"""
herramientas/procesar-imagenes.py

Procesa las imágenes descargadas de Wikimedia Commons:
- Escala el lado mayor a un máximo de 768 px.
- Convierte a formato PNG RGBA.
- Si las esquinas tienen fondo claro/uniforme, aplica máscara alfa suave para transparencia.
"""

import os
import sys
import glob
from PIL import Image

def procesar_archivo(ruta_in, ruta_out, max_dim=768):
    os.makedirs(os.path.dirname(ruta_out), exist_ok=True)
    im = Image.open(ruta_in).convert('RGBA')
    im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    
    w, h = im.size
    p = im.load()
    c1, c2, c3, c4 = p[0, 0], p[w-1, 0], p[0, h-1], p[w-1, h-1]
    
    r_avg = (c1[0] + c2[0] + c3[0] + c4[0]) / 4
    g_avg = (c1[1] + c2[1] + c3[1] + c4[1]) / 4
    b_avg = (c1[2] + c2[2] + c3[2] + c4[2]) / 4
    
    is_white_or_light = (r_avg > 210 and g_avg > 210 and b_avg > 210)
    
    if is_white_or_light:
        data = list(im.getdata())
        new_data = []
        for item in data:
            r, g, b, a = item
            dr = abs(r - r_avg)
            dg = abs(g - g_avg)
            db = abs(b - b_avg)
            diff = max(dr, dg, db)
            if diff < 22:
                new_data.append((r, g, b, 0))
            elif diff < 45:
                factor = (diff - 22) / 23.0
                alpha = int(factor * a)
                new_data.append((r, g, b, alpha))
            else:
                new_data.append(item)
        im.putdata(new_data)
        
    im.save(ruta_out, 'PNG', optimize=True)
    return im.size, is_white_or_light

if __name__ == '__main__':
    if len(sys.argv) > 2:
        in_path, out_path = sys.argv[1], sys.argv[2]
        size, mask = procesar_archivo(in_path, out_path)
        print(f"OK: {out_path} {size} fondo_enmascarado={mask}")
    else:
        print("Uso: procesar-imagenes.py <in_file> <out_file>")


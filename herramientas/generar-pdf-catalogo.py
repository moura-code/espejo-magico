#!/usr/bin/env python3
"""
herramientas/generar-pdf-catalogo.py

Genera un documento PDF profesional con todos los objetos de cada ingeniería,
sus imágenes normalizadas, nombres, descripciones y figuras vectoriales asociadas.
"""

import os
import sys
import json
import base64
import subprocess
from glob import glob

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CATALOGO_JSON = os.path.join(RAIZ, 'contenido', 'catalogo.json')
HTML_OUT = os.path.join(RAIZ, 'catalogo-objetos.html')
PDF_OUT = os.path.join(RAIZ, 'catalogo-objetos-ingenierias.pdf')

from io import BytesIO
from PIL import Image

def imagen_a_base64(ruta, tamano_max=420):
    if not os.path.exists(ruta):
        return ""
    try:
        im = Image.open(ruta).convert('RGBA')
        im.thumbnail((tamano_max, tamano_max), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        im.save(buffer, format='PNG', optimize=True)
        return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}"
    except Exception:
        with open(ruta, 'rb') as f:
            return f"data:image/png;base64,{base64.b64encode(f.read()).decode('ascii')}"

def cargar_datos():
    if not os.path.exists(CATALOGO_JSON):
        # Generar catálogo si no existe
        subprocess.run(['npm', 'run', 'catalogo'], cwd=RAIZ, check=True)

    with open(CATALOGO_JSON, 'r', encoding='utf-8') as f:
        catalogo = json.load(f)

    # Cargar carreras completas con sus objetos y metadatos
    carreras = []
    for c in catalogo.get('carreras', []):
        carrera_id = c['id']
        carrera_json_path = os.path.join(RAIZ, 'contenido', 'carreras', carrera_id, 'carrera.json')
        with open(carrera_json_path, 'r', encoding='utf-8') as fp:
            c_meta = json.load(fp)

        objetos = []
        obj_dir = os.path.join(RAIZ, 'contenido', 'carreras', carrera_id, 'objetos')
        for o in c.get('objetos', []):
            o_id = o['id']
            meta_path = os.path.join(obj_dir, o_id, 'metadata.json')
            img_path = os.path.join(obj_dir, o_id, 'imagen.png')

            with open(meta_path, 'r', encoding='utf-8') as fp:
                meta = json.load(fp)

            objetos.append({
                'id': o_id,
                'nombre': meta.get('nombre', o.get('nombre', o_id)),
                'descripcion': meta.get('descripcion', o.get('descripcion', '')),
                'figura': meta.get('figura', o.get('figura', '')),
                'img_b64': imagen_a_base64(img_path)
            })

        carreras.append({
            'id': carrera_id,
            'nombre': c_meta.get('nombre', c.get('nombre', carrera_id)),
            'color': c_meta.get('color', '#00E5A0'),
            'objetos': objetos
        })

    return carreras

def construir_html(carreras):
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Catálogo de Objetos - Espejo Mágico FING</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

  @page {{
    size: A4 portrait;
    margin: 12mm 14mm 12mm 14mm;
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  body {{
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9.5pt;
    line-height: 1.45;
  }}

  /* PORTADA */
  .portada {{
    height: 268mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24mm 12mm 16mm 12mm;
    page-break-after: always;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
    position: relative;
    overflow: hidden;
  }}

  .portada::before {{
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,229,160,0.15) 0%, rgba(255,255,255,0) 70%);
  }}

  .portada-header {{
    z-index: 1;
  }}

  .portada-badge {{
    display: inline-block;
    padding: 6px 14px;
    background: #0f172a;
    color: #00E5A0;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 20px;
    margin-bottom: 24px;
  }}

  .portada-titulo {{
    font-family: 'Space Grotesk', sans-serif;
    font-size: 34pt;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.1;
    margin-bottom: 12px;
  }}

  .portada-subtitulo {{
    font-size: 14pt;
    color: #475569;
    font-weight: 500;
    margin-bottom: 30px;
  }}

  .portada-divider {{
    width: 60px;
    height: 5px;
    background: #00E5A0;
    border-radius: 3px;
    margin-bottom: 30px;
  }}

  .portada-stats {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 20px;
    z-index: 1;
  }}

  .stat-card {{
    background: #ffffff;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
  }}

  .stat-numero {{
    font-family: 'Space Grotesk', sans-serif;
    font-size: 26pt;
    font-weight: 700;
    color: #0f172a;
    line-height: 1;
  }}

  .stat-label {{
    font-size: 9pt;
    color: #64748b;
    font-weight: 600;
    margin-top: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }}

  .portada-footer {{
    border-top: 1px solid #cbd5e1;
    padding-top: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9pt;
    color: #64748b;
    z-index: 1;
  }}

  /* PÁGINA DE CARRERA */
  .carrera-page {{
    page-break-after: always;
    height: 268mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}

  .carrera-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }}

  .carrera-titulo-wrap {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .carrera-color-indicator {{
    width: 8px;
    height: 38px;
    border-radius: 4px;
  }}

  .carrera-nombre {{
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18pt;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }}

  .carrera-badge-count {{
    padding: 5px 12px;
    background: #f1f5f9;
    color: #475569;
    border-radius: 20px;
    font-size: 8.5pt;
    font-weight: 600;
  }}

  /* LISTA DE OBJETOS */
  .objetos-list {{
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-grow: 1;
  }}

  .objeto-card {{
    display: grid;
    grid-template-columns: 82px 1fr;
    gap: 14px;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 14px;
    min-height: 44mm;
  }}

  .objeto-img-container {{
    width: 78px;
    height: 78px;
    background: #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border: 2px solid #e2e8f0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.04);
  }}

  .objeto-img {{
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 50%;
  }}

  .objeto-info {{
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }}

  .objeto-header-line {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }}

  .objeto-nombre {{
    font-size: 11pt;
    font-weight: 700;
    color: #0f172a;
  }}

  .objeto-figura-badge {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 7.5pt;
    font-weight: 600;
    color: #475569;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }}

  .objeto-desc {{
    font-size: 9.5pt;
    color: #334155;
    line-height: 1.4;
  }}

  .carrera-footer-note {{
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #cbd5e1;
    font-size: 8pt;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }}
</style>
</head>
<body>

  <!-- PORTADA -->
  <div class="portada">
    <div class="portada-header">
      <div class="portada-badge">Documento Oficial · FING</div>
      <h1 class="portada-titulo">Espejo Mágico</h1>
      <p class="portada-subtitulo">Catálogo General de Objetos y Tecnologías por Ingeniería</p>
      <div class="portada-divider"></div>
      <p style="max-width: 520px; color: #475569; font-size: 10.5pt; line-height: 1.6;">
        Compendio descriptivo de los 60 elementos interactivos incorporados en la experiencia del Espejo Mágico para el stand de difusión académica de la Facultad de Ingeniería (UdelaR).
      </p>
    </div>

    <div class="portada-stats">
      <div class="stat-card">
        <div class="stat-numero">12</div>
        <div class="stat-label">Ingenierías</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero">60</div>
        <div class="stat-label">Objetos Interactivos</div>
      </div>
      <div class="stat-card">
        <div class="stat-numero">5</div>
        <div class="stat-label">Objetos por Carrera</div>
      </div>
    </div>

    <div class="portada-footer">
      <span>Facultad de Ingeniería · Universidad de la República</span>
      <span>Página 1 de {len(carreras) + 1}</span>
    </div>
  </div>
"""

    for i, c in enumerate(carreras, 1):
        color = c['color']
        html += f"""
  <!-- PÁGINA: {c['nombre']} -->
  <div class="carrera-page">
    <div>
      <div class="carrera-header">
        <div class="carrera-titulo-wrap">
          <div class="carrera-color-indicator" style="background: {color};"></div>
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: {color};">Carrera {i:02d} / 12</div>
            <h2 class="carrera-nombre">{c['nombre']}</h2>
          </div>
        </div>
        <div class="carrera-badge-count">5 objetos interactivos</div>
      </div>

      <div class="objetos-list">
"""
        for o in c['objetos']:
            html += f"""
        <div class="objeto-card">
          <div class="objeto-img-container" style="border-color: {color}44;">
            <img class="objeto-img" src="{o['img_b64']}" alt="{o['nombre']}">
          </div>
          <div class="objeto-info">
            <div class="objeto-header-line">
              <span class="objeto-nombre">{o['nombre']}</span>
              <span class="objeto-figura-badge">figura: {o['figura']}</span>
            </div>
            <p class="objeto-desc">{o['descripcion']}</p>
          </div>
        </div>
"""

        html += f"""
      </div>
    </div>

    <div class="carrera-footer-note">
      <span>Facultad de Ingeniería · {c['nombre']} (<code>{c['id']}</code>)</span>
      <span>Página {i + 1} de {len(carreras) + 1}</span>
    </div>
  </div>
"""

    html += """
</body>
</html>
"""
    return html

def main():
    print("Cargando datos del catálogo...")
    carreras = cargar_datos()
    print(f"Total de carreras cargadas: {len(carreras)}")

    print(f"Generando documento HTML en {HTML_OUT}...")
    html = construir_html(carreras)
    with open(HTML_OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Renderizando PDF con Google Chrome en {PDF_OUT}...")
    cmd = [
        'google-chrome',
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        f'--print-to-pdf={PDF_OUT}',
        HTML_OUT
    ]
    subprocess.run(cmd, check=True)

    if os.path.exists(PDF_OUT):
        tamano_mb = os.path.getsize(PDF_OUT) / (1024 * 1024)
        print(f"\n¡PDF generado exitosamente!")
        print(f"Ruta: {PDF_OUT}")
        print(f"Tamaño: {tamano_mb:.2f} MB")
    else:
        print("ERROR: No se generó el archivo PDF.")
        sys.exit(1)

if __name__ == '__main__':
    main()

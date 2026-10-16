#!/usr/bin/env python3
"""Genera los iconos de SIAF para macOS y Windows a partir de la identidad visual del logo original (192 px incrustado en
SIAF_v9_3_3.html). El logo se redibuja como formas vectoriales a 1024 px (no se amplía el PNG pequeño) siguiendo la
retícula de iconos de macOS: placa redondeada de 824 px centrada en un lienzo de 1024 px con sombra suave.

Salidas:
  build/icon.png      1024x1024 (electron-builder la usa como fuente)
  build/icon.icns     icns con 16…1024 px (Pillow escribe ICNS en cualquier sistema operativo)
  build/icon.ico      ico con 16…256 px para Windows
  src/automation-ui/icon.png  256 px para la ventana de automatización

Uso: python3 scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
SS = 4  # supermuestreo para bordes suaves
S = 1024 * SS

# Colores medidos en el logo original
VERDE_OSCURO = (21, 74, 46, 255)
VERDE = (47, 154, 95, 255)
AMBAR = (224, 162, 27, 255)
LIMA = (139, 191, 63, 255)
CAFE = (138, 90, 43, 255)
ROJO = (195, 54, 44, 255)
BLANCO = (255, 255, 255, 255)


def u(v):
    """Coordenada del logo original (192 px, placa de 7 a 185) → lienzo supermuestreado (placa de 100 a 924)."""
    placa0, placa1 = 7, 185
    return (100 + (v - placa0) * 824 / (placa1 - placa0)) * SS


def dibujar():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # sombra de la placa
    sombra = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle([100 * SS, 112 * SS, 924 * SS, 936 * SS], radius=185 * SS, fill=(0, 0, 0, 110))
    sombra = sombra.filter(ImageFilter.GaussianBlur(14 * SS))
    img.alpha_composite(sombra)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([100 * SS, 100 * SS, 924 * SS, 924 * SS], radius=185 * SS, fill=VERDE_OSCURO)
    r = 9 * 824 / 178 * SS
    # cuadrícula de potreros 3 x 2
    celdas = [(25, 32, 67, 72, VERDE), (75, 32, 117, 72, AMBAR), (125, 32, 167, 72, LIMA),
              (25, 80, 67, 120, VERDE), (75, 80, 117, 120, CAFE), (125, 80, 167, 120, VERDE)]
    for x0, y0, x1, y1, c in celdas:
        d.rounded_rectangle([u(x0), u(y0), u(x1), u(y1)], radius=r, fill=c)
    # barra inferior
    d.rounded_rectangle([u(28), u(142), u(96), u(152)], radius=5 * 824 / 178 * SS, fill=BLANCO)
    # marcador de ubicación (gota) con borde verde oscuro para separarlo de la cuadrícula
    cx, cy, rad, punta = u(118), u(108), 27 * 824 / 178 * SS, u(166)
    borde = 5 * 824 / 178 * SS
    for extra, color in ((borde, VERDE_OSCURO), (0, BLANCO)):
        d.ellipse([cx - rad - extra, cy - rad - extra, cx + rad + extra, cy + rad + extra], fill=color)
        # lados tangentes al círculo desde la punta: sin juntas visibles
        R = rad + extra
        cos_a = R / (punta + extra - cy)
        sin_a = (1 - cos_a ** 2) ** 0.5
        d.polygon([(cx - R * sin_a, cy + R * cos_a), (cx + R * sin_a, cy + R * cos_a), (cx, punta + extra)], fill=color)
    rr = 12 * 824 / 178 * SS
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=ROJO)
    return img.resize((1024, 1024), Image.LANCZOS)


def main():
    (RAIZ / 'build').mkdir(exist_ok=True)
    icono = dibujar()
    icono.save(RAIZ / 'build' / 'icon.png')
    icono.save(RAIZ / 'build' / 'icon.icns', sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
    # Windows: .ico con todos los tamaños que usan el Explorador, la barra de tareas y el menú Inicio
    icono.save(RAIZ / 'build' / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    destino = RAIZ / 'src' / 'automation-ui'
    destino.mkdir(parents=True, exist_ok=True)
    icono.resize((256, 256), Image.LANCZOS).save(destino / 'icon.png')
    print('Iconos generados en build/ y src/automation-ui/')


if __name__ == '__main__':
    main()

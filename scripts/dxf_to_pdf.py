#!/usr/bin/env python3
"""Convierte los planos DXF a PDF vectorial, preservando líneas y cotas (MTEXT).

Uso: python3 scripts/dxf_to_pdf.py
Genera los PDFs en assets/drawings/.
"""
import math
import os

import ezdxf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

# (archivo de entrada, archivo de salida, título)
JOBS = [
    ("Archivos/Plano - Vista superior.dxf", "assets/drawings/plano-vista-superior.pdf", "Plano - Vista Superior"),
    ("Archivos/Plano - Vista 3D.dxf",       "assets/drawings/plano-vista-3d.pdf",       "Plano - Vista 3D"),
]

# Color por capa
LAYER_COLORS = {
    "PROFILEEDGES":    ("#1a1a1a", 0.8),
    "SECTIONCUTEDGES": ("#1a1a1a", 1.4),
    "0":               ("#333333", 0.6),
    "Defpoints":       ("#999999", 0.4),
}
TEXT_COLOR = "#c0392b"  # cotas en rojo para que resalten


def strip_mtext(raw: str) -> str:
    """Limpia códigos de formato MTEXT dejando solo el texto visible."""
    import re
    s = raw
    s = re.sub(r"\\[A-Za-z][^;]*;", "", s)  # \fArial; \H0.2; etc.
    s = s.replace("\\P", "\n")
    s = re.sub(r"[{}]", "", s)
    s = s.replace("\\~", " ")
    return s.strip()


def convert(infile: str, outfile: str, title: str):
    doc = ezdxf.readfile(infile)
    msp = doc.modelspace()

    fig, ax = plt.subplots(figsize=(16, 11))
    ax.set_aspect("equal")
    ax.axis("off")

    xs, ys = [], []

    # Líneas
    for e in msp.query("LINE"):
        layer = e.dxf.layer
        color, lw = LAYER_COLORS.get(layer, ("#333333", 0.6))
        x0, y0 = e.dxf.start.x, e.dxf.start.y
        x1, y1 = e.dxf.end.x, e.dxf.end.y
        ax.plot([x0, x1], [y0, y1], color=color, linewidth=lw, solid_capstyle="round")
        xs += [x0, x1]
        ys += [y0, y1]

    # Cotas / textos (MTEXT)
    for e in msp.query("MTEXT"):
        txt = strip_mtext(e.text)
        if not txt:
            continue
        ix, iy = e.dxf.insert.x, e.dxf.insert.y
        h = getattr(e.dxf, "char_height", 0.2) or 0.2
        rot = getattr(e.dxf, "rotation", 0.0) or 0.0
        ax.text(
            ix, iy, txt,
            fontsize=max(6, h * 32),
            color=TEXT_COLOR,
            rotation=rot,
            ha="left", va="bottom",
            rotation_mode="anchor",
            zorder=5,
            fontweight="bold",
        )
        xs.append(ix)
        ys.append(iy)

    if xs and ys:
        pad_x = (max(xs) - min(xs)) * 0.04 + 0.5
        pad_y = (max(ys) - min(ys)) * 0.04 + 0.5
        ax.set_xlim(min(xs) - pad_x, max(xs) + pad_x)
        ax.set_ylim(min(ys) - pad_y, max(ys) + pad_y)

    ax.set_title(title, fontsize=16, color="#1a1a1a", pad=18, fontweight="bold")

    os.makedirs(os.path.dirname(outfile), exist_ok=True)
    with PdfPages(outfile) as pdf:
        pdf.savefig(fig, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"OK  {infile}  ->  {outfile}")


if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(here)
    for infile, outfile, title in JOBS:
        convert(infile, outfile, title)

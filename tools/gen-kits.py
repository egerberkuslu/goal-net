#!/usr/bin/env python3
"""Forma desenleri: FLUX siyah-beyaz swatch çizer, Pillow oyunun renklerine boyar.

  $VIDEO_LAB/audio-tools/.venv/bin/python tools/gen-kits.py                 # iki preset
  ... tools/gen-kits.py --variants 3 --out /tmp/adaylar                     # adaylar
  ... tools/gen-kits.py --only sari-kirmizi-desen

Neden FLUX'a 256×256 silindirik forma şeridi çizdirilmiyor: şeridin düzeni
(göğüs U=0.25, sırt U=0.75, koltuk altı dikiş, numara U=0.75/V=0.62, dikey
flip) kanvas hattının bilgisi; FLUX bunu tutturamaz ve numara/kenar/gölge
adımlarıyla kavga eder. Gövde yayın kamerasından ~20 px — okunacak tek şey
kalın, yüksek kontrastlı bir desen.

O yüzden FLUX yalnızca **siyah şekiller / beyaz zemin** bir desen swatch'ı
üretir; burada eşiklenip maske olur ve preset'in KENDİ base/accent hex'leriyle
boyanır. Palet oyunun paleti kalır — stil kalkanı bu. Kanvas (kitTexture.js)
bunu taban dolgusunun üstüne `drawImage` ile koyar, gerisini kendi yapar.

Çıktı 256×256 WebP → packages/client/src/view/kits/<preset>.webp.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
VIDEO_LAB = Path(os.environ.get("VIDEO_LAB", REPO.parent / "video-lab")).resolve()
OUT_DIR = REPO / "packages/client/src/view/kits"

GEN = 512  # FLUX üretim boyutu (16'nın katı); 256'ya indirilir
OUT = 256  # kitTexture.js kanvasıyla aynı
STEPS = 4

# Preset anahtarı, base, accent, motif, seed. Hex'ler kitTexture.js'teki
# KIT_PRESETS ile aynı; test anahtar↔dosya eşleşmesini kontrol eder, hex'i
# değil, o yüzden iki renk burada tekrar edilebilir.
PRESETS = [
    ("sari-kirmizi-desen", "#a4032c", "#f7b512", "bold chevron pattern", 101),
    ("siyah-beyaz-desen", "#101014", "#f2f2f2", "bold diagonal sash bands", 202),
]

PROMPT = (
    "seamless flat pattern swatch, black shapes on white background, {motif}, "
    "bold, high contrast, thick strokes, no gradient, no text, no letters, "
    "no watermark, vector"
)


def load_pipeline():
    sys.path.insert(0, str(VIDEO_LAB / "gen-tools"))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    from images import load_pipeline as _load  # type: ignore

    return _load("cuda")


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def tint(swatch, base: str, accent: str):
    """Siyah-beyaz swatch → maske → base zemin üstüne accent şekiller."""
    from PIL import Image, ImageOps

    g = ImageOps.autocontrast(swatch.convert("L"))
    # Şekiller siyah (koyu) — accent orada; zemin beyaz — base orada.
    mask = g.point(lambda v: 255 if v < 128 else 0)
    out = Image.new("RGB", swatch.size, hex_rgb(base))
    out.paste(Image.new("RGB", swatch.size, hex_rgb(accent)), mask=mask)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", type=int, default=1)
    ap.add_argument("--only", default="")
    ap.add_argument("--out", default=str(OUT_DIR))
    args = ap.parse_args()

    from PIL import Image
    import torch

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    presets = [p for p in PRESETS if not only or p[0] in only]
    if not presets:
        print("--only hiçbir preset ile eşleşmedi", file=sys.stderr)
        return 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    pipe = load_pipeline()
    for key, base, accent, motif, seed in presets:
        for v in range(args.variants):
            s = seed + v * 1000
            img = pipe(
                PROMPT.format(motif=motif),
                width=GEN,
                height=GEN,
                num_inference_steps=STEPS,
                guidance_scale=0.0,
                generator=torch.Generator("cpu").manual_seed(s),
            ).images[0]
            img = img.resize((OUT, OUT), Image.LANCZOS)
            coloured = tint(img, base, accent)
            suffix = f"-v{v + 1}" if args.variants > 1 else ""
            path = out / f"{key}{suffix}.webp"
            coloured.save(path, "WEBP", quality=90, method=6)
            # Ham swatch da yanına, göz kararı için (adaylarda işe yarar).
            if args.variants > 1:
                img.save(out / f"{key}{suffix}.raw.webp", "WEBP", quality=80)
            print(f"  {path.name}  seed={s}  {path.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

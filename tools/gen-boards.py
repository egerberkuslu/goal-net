#!/usr/bin/env python3
"""Reklam panoları için FLUX ile düz vektör banner üret.

  VIDEO_LAB=~/Desktop/video-lab
  $VIDEO_LAB/audio-tools/.venv/bin/python tools/gen-boards.py            # 6 pano
  ... tools/gen-boards.py --variants 3 --out /tmp/adaylar               # 18 aday
  ... tools/gen-boards.py --only navy,red                                # seçili

Neden burada FLUX'a yazı yazdırılmıyor: schnell Q4'te harfler güvenilmez, ve
BoxGeometry'nin ±x / ±z yüzlerinde UV yönü ayna olabilir — soyut şekilde
görünmez, harfte "ƎLOV" olur. Pano yayın kamerasından ~250×30 px; okunacak tek
şey renk ve kalın şekil. Sahte marka adları istenirse ayrı adımda kanvasla.

Neden 1024×256 üretip 1024×128'e küçültülüyor: schnell 8:1 gibi uç oranlarda
deseni tekrarlayıp bulanıklaştırıyor; 4:1 üretim + Lanczos yarıya indirme hem
gürültüyü ortalıyor hem oranı oyunun 6×0.75 m panosuna (8:1) getiriyor.

Çıktı WebP: kök .gitignore'da `*.png` var, PNG sessizce takip dışı kalırdı.
Dosyalar `packages/client/src/view/boards/` altına gider; oyun bunları
import.meta.glob ile bulur (bkz. view/scene.js, ADR-0010).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
VIDEO_LAB = Path(os.environ.get("VIDEO_LAB", REPO.parent / "video-lab")).resolve()
OUT_DIR = REPO / "packages/client/src/view/boards"

# Üretim ve hedef boyutlar (16'nın katı olmalı).
GEN_W, GEN_H = 1024, 256
OUT_W, OUT_H = 1024, 128
STEPS = 4  # schnell

# Altı renk ailesi: oyunun mevcut dört pano rengi (lacivert, bordo, yeşil,
# hardal) + tribün lacivertiyle uyumlu iki nötr. Hepsi beyazla, iki renk.
# Seed'ler sabit: cache anahtarı prompt+seed, aynı komut aynı görseli verir.
FAMILIES = [
    # (ad, renk tarifi, seed)
    ("navy", "deep navy blue", 11),
    ("red", "dark crimson red", 23),
    ("green", "forest green", 37),
    ("gold", "mustard gold", 41),
    ("teal", "dark teal", 53),
    ("grey", "charcoal grey", 67),
]

PROMPT = (
    "flat vector sports sponsor banner, wide horizontal strip, "
    "bold geometric shapes, two colours only: {colour} and white, "
    "hard clean edges, minimal, no gradient, no text, no letters, "
    "no logo, no watermark, no photo"
)


def load_pipeline():
    """video-lab'ın kendi yükleyicisi: GGUF transformer + NF4 T5, CPU offload."""
    sys.path.insert(0, str(VIDEO_LAB / "gen-tools"))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    from images import load_pipeline as _load  # type: ignore

    return _load("cuda")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", type=int, default=1, help="renk başına aday sayısı")
    ap.add_argument("--only", default="", help="virgülle aile adları")
    ap.add_argument("--out", default=str(OUT_DIR), help="hedef klasör")
    args = ap.parse_args()

    from PIL import Image
    import torch

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    families = [f for f in FAMILIES if not only or f[0] in only]
    if not families:
        print("--only hiçbir aileyle eşleşmedi", file=sys.stderr)
        return 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    pipe = load_pipeline()
    for name, colour, seed in families:
        for v in range(args.variants):
            s = seed + v * 1000
            prompt = PROMPT.format(colour=colour)
            img = pipe(
                prompt,
                width=GEN_W,
                height=GEN_H,
                num_inference_steps=STEPS,
                guidance_scale=0.0,
                generator=torch.Generator("cpu").manual_seed(s),
            ).images[0]
            img = img.convert("RGB").resize((OUT_W, OUT_H), Image.LANCZOS)
            suffix = f"-v{v + 1}" if args.variants > 1 else ""
            path = out / f"board-{name}{suffix}.webp"
            img.save(path, "WEBP", quality=90, method=6)
            print(f"  {path.name}  seed={s}  {path.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

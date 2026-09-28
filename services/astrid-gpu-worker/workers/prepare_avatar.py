#!/usr/bin/env python3
"""
Förbereder avataren för MuseTalk 1.5 — EN stillbild i 2x.

Källan är stillbilden uppskalad 2x, så att munregionen får dubbelt så många
pixlar in i UNet:et; motorn skalar tillbaka regionen till 1x när den blandar
in den i den riktiga stillbilden. Landmärkena tas med MediaPipe (Apache 2.0)
i stället för DWPose (icke-kommersiell licens).

Resultatet läggs i results/v15/avatars/<id>/ med exakt samma filer som
MuseTalks egen förberedelse ger, fast med en enda bildruta:

    full_imgs/00000000.png   2x-bilden
    coords.pkl               [bbox]        ansiktsrutan (x1,y1,x2,y2) i 2x
    mask/00000000.png        blandningsmasken (käkläge, kinder 90 px)
    mask_coords.pkl          [crop_box]    maskens ruta i 2x
    latents.pt               [latent]      VAE-latenten för UNet
    avator_info.json

Går på CPU (Docker-bygget) såväl som GPU (kallstart): VAE och ansiktsparsern
väljer själva. Bara VAE:n laddas — UNet:et behövs inte här.

    cd /workspace/MuseTalk && /workspace/mt-venv/bin/python /workspace/workers/prepare_avatar.py \
        --image /workspace/avatar/talk_base.png --id astrid_talk2x --scale 2
"""
import argparse
import json
import os
import pickle
import sys

os.chdir("/workspace/MuseTalk")
sys.path.insert(0, "/workspace/MuseTalk")
sys.path.insert(0, "/workspace")

import cv2
import torch

from preprocessing_mp import landmarks68, bbox_from_landmarks
from musetalk.models.vae import VAE
from musetalk.utils.blending import get_image_prepare_material
from musetalk.utils.face_parsing import FaceParsing

ap = argparse.ArgumentParser()
ap.add_argument("--image", required=True)
ap.add_argument("--id", default="astrid_talk2x")
ap.add_argument("--scale", type=int, default=2)
ap.add_argument("--bbox_shift", type=int, default=0)
ap.add_argument("--extra_margin", type=int, default=10, help="MuseTalk v15-standard")
ap.add_argument("--parsing_mode", default="jaw")
ap.add_argument("--cheek", type=int, default=90)
a = ap.parse_args()

src = cv2.imread(a.image)
assert src is not None, f"kunde inte läsa {a.image}"
h, w = src.shape[:2]
big = cv2.resize(src, (w * a.scale, h * a.scale), interpolation=cv2.INTER_LANCZOS4) if a.scale != 1 else src.copy()
print(f"källa {w}x{h} → {big.shape[1]}x{big.shape[0]} (x{a.scale}) · {'cuda' if torch.cuda.is_available() else 'cpu'}")

lm = landmarks68(big)
assert lm is not None, "MediaPipe hittade inget ansikte"
x1, y1, x2, y2 = bbox_from_landmarks(lm, big.shape[0], a.bbox_shift)
y2 = min(y2 + a.extra_margin, big.shape[0])
bbox = [int(x1), int(y1), int(x2), int(y2)]
print(f"bbox (2x): {bbox}  → {bbox[2]-bbox[0]}x{bbox[3]-bbox[1]} px")

vae = VAE(model_path="./models/sd-vae/")
crop = big[bbox[1]:bbox[3], bbox[0]:bbox[2]]
crop256 = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_LANCZOS4)
with torch.no_grad():
    latent = vae.get_latents_for_unet(crop256)

fp = FaceParsing(left_cheek_width=a.cheek, right_cheek_width=a.cheek)
mask, crop_box = get_image_prepare_material(big, bbox, fp=fp, mode=a.parsing_mode)
print(f"crop_box (2x): {crop_box}  mask {mask.shape}")

base = f"./results/v15/avatars/{a.id}"
os.makedirs(f"{base}/full_imgs", exist_ok=True)
os.makedirs(f"{base}/mask", exist_ok=True)
os.makedirs(f"{base}/vid_output", exist_ok=True)
cv2.imwrite(f"{base}/full_imgs/00000000.png", big)
cv2.imwrite(f"{base}/mask/00000000.png", mask)
with open(f"{base}/coords.pkl", "wb") as f: pickle.dump([bbox], f)
with open(f"{base}/mask_coords.pkl", "wb") as f: pickle.dump([list(crop_box)], f)
torch.save([latent.cpu()], f"{base}/latents.pt")
with open(f"{base}/avator_info.json", "w") as f:
    json.dump({"avatar_id": a.id, "video_path": a.image, "bbox_shift": a.bbox_shift,
               "version": "v15", "scale": a.scale, "source_size": [w, h],
               "extra_margin": a.extra_margin, "parsing_mode": a.parsing_mode, "cheek": a.cheek}, f)
print(f"AVATAR_KLAR {base}")

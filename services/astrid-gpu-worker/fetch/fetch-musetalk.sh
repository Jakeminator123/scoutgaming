#!/bin/bash
# MuseTalk-vikterna med aria2 x16 (huggingface-cli/xet hänger på strypta nät; aria2 är dessutom snabbast i bygget)
set -e
cd /workspace/MuseTalk
mkdir -p models/face-parse-bisent models/mediapipe models/musetalkV15 models/sd-vae models/whisper results/v15/avatars
a(){ aria2c -q -x16 -s16 -k4M --file-allocation=none -c -d "$(dirname "$2")" -o "$(basename "$2")" "$1" && echo "klar $2 $(stat -c%s "$2")" || { echo "FEL $2"; return 1; }; }
H=https://huggingface.co
a $H/TMElyralab/MuseTalk/resolve/main/musetalkV15/musetalk.json models/musetalkV15/musetalk.json
a $H/stabilityai/sd-vae-ft-mse/resolve/main/config.json models/sd-vae/config.json
for f in config.json generation_config.json preprocessor_config.json tokenizer_config.json tokenizer.json vocab.json merges.txt special_tokens_map.json added_tokens.json normalizer.json; do a $H/openai/whisper-tiny/resolve/main/$f models/whisper/$f; done
a $H/openai/whisper-tiny/resolve/main/pytorch_model.bin models/whisper/pytorch_model.bin
a $H/openai/whisper-tiny/resolve/main/model.safetensors models/whisper/model.safetensors
a $H/stabilityai/sd-vae-ft-mse/resolve/main/diffusion_pytorch_model.bin models/sd-vae/diffusion_pytorch_model.bin
a https://download.pytorch.org/models/resnet18-5c106cde.pth models/face-parse-bisent/resnet18-5c106cde.pth
a https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task models/mediapipe/face_landmarker.task
a $H/TMElyralab/MuseTalk/resolve/main/musetalkV15/unet.pth models/musetalkV15/unet.pth
# Ansiktsparsern ligger officiellt bara på Google Drive (gdown, kvotstrypt ibland). Prova HF-spegeln först.
a $H/camenduru/MuseTalk/resolve/main/face-parse-bisent/79999_iter.pth models/face-parse-bisent/79999_iter.pth \
  || gdown -q 154JgKpzCPW82qINcVieuPH3fZ2e0P812 -O models/face-parse-bisent/79999_iter.pth
[ "$(stat -c%s models/face-parse-bisent/79999_iter.pth)" -gt 50000000 ] || { echo "FEL face-parse: för liten fil"; exit 1; }
echo "klar face-parse $(stat -c%s models/face-parse-bisent/79999_iter.pth)"
du -sh models
echo MT_FETCH_KLAR

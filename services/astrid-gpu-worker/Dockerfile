# GPU-arbetare för Astrid (Croupier) på RunPod Serverless: MuseTalk 1.5-läppsynk på dealerns stillbild.
#
# Samma recept som demopodden: avataren är stillbilden i 2x, det genererade ansiktet blandas i
# munmaskens ruta och läggs som overlay på basens ORÖRDA yuv420p-plan. Utanför munnen är varje
# bildruta byte-identisk med stillbilden, och klippet börjar och slutar i den (ankarlås).
#
# GPU på endpointen: RTX 4090 eller L40S (sm_89). torch är cu121 — RTX 5090 (sm_120) stöds INTE.
FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime
LABEL org.opencontainers.image.source="https://github.com/Jakeminator123/scoutgaming" \
      org.opencontainers.image.title="Croupier Astrid GPU worker"

ENV DEBIAN_FRONTEND=noninteractive PIP_NO_CACHE_DIR=1 PYTHONUNBUFFERED=1
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      ffmpeg git aria2 curl libgl1 libegl1 libgles2 libglib2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# MuseTalk pinnad till en känd commit (2025-09-26) — main kan ändras under fötterna på oss.
ARG MUSETALK_SHA=0a89dec45a0192b824e3cf4daf96c239440c5ed8
RUN mkdir MuseTalk && cd MuseTalk && git init -q && \
    git fetch -q --depth 1 https://github.com/TMElyralab/MuseTalk.git $MUSETALK_SHA && \
    git checkout -q FETCH_HEAD && rm -rf .git

# mt-venv: MuseTalk kräver transformers 4.39.2. Delar basens torch 2.3.1+cu121.
RUN python -m venv --system-site-packages /workspace/mt-venv && \
    /workspace/mt-venv/bin/pip install -q -U pip "setuptools<81" wheel && \
    /workspace/mt-venv/bin/pip install -q "numpy<2" opencv-python-headless "transformers==4.39.2" \
      "huggingface_hub==0.25.2" diffusers accelerate librosa soundfile einops omegaconf pillow gdown mediapipe websockets

# Vikter (hämtas i bygget — lagren ovanför cachas, rör dem inte i onödan)
COPY fetch/ /workspace/fetch/
RUN sed -i 's/\r$//' /workspace/fetch/*.sh && \
    ln -sf /workspace/mt-venv/bin/gdown /usr/local/bin/gdown && \
    bash /workspace/fetch/fetch-musetalk.sh

RUN pip install -q runpod

# Kod + Astrids stillbild (1x som png + råa yuv420p-plan, BT.709)
COPY assets/ /workspace/avatar/
COPY workers/ /workspace/workers/
COPY handler.py /workspace/handler.py
RUN sed -i 's/\r$//' /workspace/workers/*.py /workspace/handler.py && \
    ln -sf /workspace/workers/preprocessing_mp.py /workspace/preprocessing_mp.py

# Both avatars must be ready before publishing an image. A failed preparation is
# a failed build, not additional work silently deferred to the first visitor.
RUN cd /workspace/MuseTalk && /workspace/mt-venv/bin/python /workspace/workers/prepare_avatar.py \
      --image /workspace/avatar/talk_base.png --id astrid_talk2x --scale 2

# Spelets startbild (1080x1920, H3:s ruta 0) — väljs med AVATAR_ID=astrid_spel2x på endpointen/templaten
RUN cd /workspace/MuseTalk && /workspace/mt-venv/bin/python /workspace/workers/prepare_avatar.py \
      --image /workspace/avatar/astrid_spel2x/talk_base.png --id astrid_spel2x --scale 2

ENV AVATAR_ID=astrid_talk2x
# NVENC: containern behöver drivrutinens video-del (libnvidia-encode) — utan den faller motorn till x264
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility,video
CMD ["python", "-u", "/workspace/handler.py"]

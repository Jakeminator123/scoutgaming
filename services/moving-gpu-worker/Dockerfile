# syntax=docker/dockerfile:1
# Required: ubuntu:24.04@sha256:<reviewed digest>. Never default to a floating tag.
ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS runtime
ARG BASE_IMAGE
RUN printf '%s' "$BASE_IMAGE" | grep -Eq '^ubuntu(:24[.]04)?@sha256:[a-f0-9]{64}$' && \
    . /etc/os-release && test "$ID" = ubuntu && test "$VERSION_ID" = 24.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
# BuildKit downloads with its CA store; the minimal Ubuntu base has none yet.
# This exact deb was verified against the signed snapshot package index.
ADD --checksum=sha256:641de77d8f142cfd62a1a6f964ba67b20754d3337c480efb529d086075a06c9a https://snapshot.ubuntu.com/ubuntu/20261016T000000Z/pool/main/c/ca-certificates/ca-certificates_20240203_all.deb /tmp/ca-certificates.deb
# Immutable Ubuntu archive snapshot; package bytes remain part of image digest.
RUN dpkg-deb --extract /tmp/ca-certificates.deb /tmp/ca-bootstrap && \
    mkdir -p /etc/ssl/certs && \
    cat /tmp/ca-bootstrap/usr/share/ca-certificates/mozilla/*.crt > /etc/ssl/certs/ca-certificates.crt && \
    rm -rf /tmp/ca-certificates.deb /tmp/ca-bootstrap && \
    rm -f /etc/apt/sources.list.d/ubuntu.sources && \
    printf '%s\n' 'deb [check-valid-until=no signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://snapshot.ubuntu.com/ubuntu/20261016T000000Z noble main universe' \
      'deb [check-valid-until=no signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://snapshot.ubuntu.com/ubuntu/20261016T000000Z noble-updates main universe' \
      'deb [check-valid-until=no signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://snapshot.ubuntu.com/ubuntu/20261016T000000Z noble-security main universe' \
      > /etc/apt/sources.list && \
    apt-get -o APT::Update::Error-Mode=any update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg git ca-certificates libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/* && python3 -c 'import sys; assert sys.version_info[:3] == (3,12,3)'
WORKDIR /opt/moving-worker
COPY requirements.lock wheels.lock ./
RUN python3 -m venv /workspace/mt-venv && \
    /workspace/mt-venv/bin/python -m pip install --no-deps --require-hashes --only-binary=:all: -r wheels.lock && \
    /workspace/mt-venv/bin/python -m pip check
RUN mkdir -p /workspace/MuseTalk && cd /workspace/MuseTalk && git init -q && \
    git fetch -q --depth 1 https://github.com/TMElyralab/MuseTalk.git 0a89dec45a0192b824e3cf4daf96c239440c5ed8 && \
    git checkout -q FETCH_HEAD && test "$(git rev-parse HEAD)" = 0a89dec45a0192b824e3cf4daf96c239440c5ed8 && rm -rf .git && chmod -R a=rX /workspace/MuseTalk
COPY . .
RUN /workspace/mt-venv/bin/python fetch_models.py /workspace/MuseTalk/models && \
    chmod -R a=rX /workspace/MuseTalk/models /opt/moving-worker && \
    /workspace/mt-venv/bin/python -c 'from contracts import verify_release; print(verify_release("."))' && \
    /workspace/mt-venv/bin/python -m unittest discover -s tests -v
# Models/source are immutable; the mounted /banks volume is read-only.
# Per-job verified extraction and ephemeral engine files go under /tmp.
RUN useradd --uid 10001 --create-home worker
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 NVIDIA_DRIVER_CAPABILITIES=compute,utility,video \
    OMP_NUM_THREADS=4 OPENBLAS_NUM_THREADS=4 MKL_NUM_THREADS=4 MOVING_BANK_STORE=/banks
USER 10001
ENTRYPOINT ["/workspace/mt-venv/bin/python", "/opt/moving-worker/entrypoint.py"]

# Opt-in SDK image; package resolution stays separate from the verified renderer.
FROM runtime AS serverless
USER root
RUN /workspace/mt-venv/bin/python -m pip install --no-deps --require-hashes --only-binary=:all: -r serverless-wheels.lock && \
    /workspace/mt-venv/bin/python -m pip check
RUN --network=none /workspace/mt-venv/bin/python -c 'import runpod, serverless; from importlib.metadata import version; assert version("runpod") == "1.12.0"'
ENV RUNPOD_LOG_LEVEL=ERROR
USER 10001
ENTRYPOINT ["/workspace/mt-venv/bin/python", "/opt/moving-worker/serverless.py"]

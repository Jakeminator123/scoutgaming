# syntax=docker/dockerfile:1
FROM ghcr.io/jakeminator123/moving-gpu-worker@sha256:eb5a6b4707eaba54839cc562b554ff7a8af37f5897e739a5533f2357f867135a
USER root
WORKDIR /opt/moving-prep
COPY . .
RUN /workspace/mt-venv/bin/python contracts.py && \
    /workspace/mt-venv/bin/python -m pip install --no-deps --require-hashes --only-binary=:all: -r wheels.lock && \
    /workspace/mt-venv/bin/python -m pip check && \
    /workspace/mt-venv/bin/python models.py --fetch /workspace/MuseTalk/models && \
    test ! -e /opt/moving-worker/vendor/preprocessing_mp.py && \
    cp sources/preprocessing_mp.py /opt/moving-worker/vendor/preprocessing_mp.py && \
    chmod -R a=rX /opt/moving-prep /workspace/MuseTalk/models /opt/moving-worker/vendor
# The inherited renderer/model source remains sealed. Only the new helper is added.
# CPU initialization catches missing native libraries, incompatible wheels and weights.
USER 10001
RUN --network=none /workspace/mt-venv/bin/python -B /opt/moving-prep/verify_runtime.py
ENTRYPOINT ["/workspace/mt-venv/bin/python", "-I", "/opt/moving-prep/sources/build-moving-speech-bank.py"]
CMD ["--help"]

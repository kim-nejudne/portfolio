# syntax=docker/dockerfile:1

# PokéTrack API — FastAPI + MongoDB.
#
# Built on a workstation and shipped to the droplet with
# `docker save | ssh 'docker load'`. The box has no memory headroom to build,
# so there is deliberately no build step that runs there.
#
# The frontend is NOT in this image. The CRA bundle is served straight off disk
# by nginx from /var/www/poketrack; only /api/ reaches this container.

# ---- deps: wheels into a relocatable prefix
FROM python:3.12-slim AS deps
WORKDIR /app

# Every pin resolves to a manylinux wheel, so no compiler is needed here and
# none is shipped in the runtime stage. If a future pin needs to build from
# source this stage is where build-essential goes — not the runtime.
COPY backend/requirements-prod.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements-prod.txt

# ---- runtime
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

COPY --from=deps /install /usr/local

# Includes backend/poc/_cache — pokeapi_service falls back to it when PokéAPI
# is unreachable, so the app still boots and plays without the network.
COPY backend/ ./

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin poketrack
USER poketrack
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=4).status==200 else 1)"

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]

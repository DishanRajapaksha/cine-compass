#!/bin/sh
set -eu
ssh gont 'sh -s' <<'REMOTE'
set -eu
cd "$HOME/Projects/cine-compass"
[ -z "$(git status --porcelain)" ] || { echo "Remote checkout has local changes" >&2; exit 1; }
git fetch origin main
git merge --ff-only origin/main
docker network inspect cinecompass_gateway >/dev/null 2>&1 || docker network create cinecompass_gateway
[ -f .env ] || { echo "Create a server-only .env before deploying." >&2; exit 1; }
docker compose -f compose.yaml -f compose.gont.yaml config --quiet
docker compose -f compose.yaml -f compose.gont.yaml up --build -d
docker compose -f compose.yaml -f compose.gont.yaml ps
REMOTE

#!/bin/sh
set -eu
ssh gont 'sh -s' <<'REMOTE'
set -eu
cd "$HOME/Projects/cine-compass"
deploy_started=$(date +%s)
compose() { docker compose -f compose.yaml -f compose.gont.yaml "$@"; }
[ -z "$(git status --porcelain)" ] || { echo "Remote checkout has local changes" >&2; exit 1; }
git fetch origin main
git merge --ff-only origin/main
docker network inspect cinecompass_gateway >/dev/null 2>&1 || docker network create cinecompass_gateway
[ -f .env ] || { echo "Create a server-only .env before deploying." >&2; exit 1; }
compose config --quiet
echo "Building the application image once..."
build_started=$(date +%s)
compose build app
echo "Build finished in $(($(date +%s) - build_started)) seconds."
echo "Running migrations and starting the application..."
start_started=$(date +%s)
compose up --no-build -d
echo "Startup finished in $(($(date +%s) - start_started)) seconds."
compose ps
echo "Deployment finished in $(($(date +%s) - deploy_started)) seconds."
REMOTE

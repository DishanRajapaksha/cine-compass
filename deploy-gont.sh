#!/bin/sh
set -eu
ssh gont 'sh -s' <<'REMOTE'
set -eu
source_dir="$HOME/Projects/cine-compass"
deployment_dir=/srv/services/cinecompass
cd "$source_dir"
deploy_started=$(date +%s)
compose() {
  sudo -n docker compose -p cinecompass \
    -f "$deployment_dir/compose.json" \
    -f "$deployment_dir/runtime.private.json" "$@"
}
sudo -n test -d "$deployment_dir/postgres"
sudo -n test -d "$deployment_dir/keys"
sudo -n test -f "$deployment_dir/compose.json"
sudo -n test -f "$deployment_dir/runtime.private.json"
compose config --quiet
[ -z "$(git status --porcelain)" ] || { echo "Remote checkout has local changes" >&2; exit 1; }
git fetch origin main
git merge --ff-only origin/main
docker network inspect cinecompass_gateway >/dev/null 2>&1 || docker network create cinecompass_gateway
echo "Building the application image once..."
build_started=$(date +%s)
docker build -t cinecompass:local "$source_dir"
image_id=$(docker image inspect cinecompass:local --format '{{.Id}}')
# Update only the app/migration image pins in the centralized deployment.
sudo -n python3 - "$deployment_dir/compose.json" "$image_id" <<'PY'
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

path = Path(sys.argv[1])
config = json.loads(path.read_text())
root = str(path.parent)
expected = {"database": (root + "/postgres", "/var/lib/postgresql"),
            "app": (root + "/keys", "/data/keys"),
            "migrate": (root + "/keys", "/data/keys")}
for service, (source, target) in expected.items():
    if not any(v.get("type") == "bind" and v.get("source") == source
               and v.get("target") == target
               for v in config["services"][service].get("volumes", [])):
        raise SystemExit("Refusing deployment: incorrect centralized mount for " + service)
for service in ("app", "migrate"):
    config["services"][service]["image"] = sys.argv[2]
metadata = path.stat()
with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as file:
    temporary = Path(file.name)
    json.dump(config, file, indent=2)
    file.write("\n")
try:
    os.chmod(temporary, stat.S_IMODE(metadata.st_mode))
    os.chown(temporary, metadata.st_uid, metadata.st_gid)
    os.replace(temporary, path)
finally:
    temporary.unlink(missing_ok=True)
PY
compose config --quiet
echo "Build finished in $(($(date +%s) - build_started)) seconds."
echo "Running migrations and starting the application..."
start_started=$(date +%s)
compose up --no-build --pull never -d
echo "Startup finished in $(($(date +%s) - start_started)) seconds."
compose ps
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors \
  --max-time 10 -H 'Host: cinecompass.talesfrom.earth' \
  http://127.0.0.1:8888/api/health >/dev/null
echo "Deployment finished in $(($(date +%s) - deploy_started)) seconds."
REMOTE

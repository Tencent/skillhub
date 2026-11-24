#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

name=$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('package.json','utf8')).name)")
version=$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('package.json','utf8')).version)")
dest=${PACK_DEST:-/tmp}
safe_name=${name#@}
safe_name=${safe_name//\//-}
tgz="$dest/$safe_name-$version.tgz"

pnpm pack --pack-destination "$dest" >/dev/null

if [[ ! -f $tgz ]]; then
  echo "missing tarball: $tgz" >&2
  exit 1
fi

mapfile -t files < <(tar -tzf "$tgz" | sed 's|^package/||' | sort)

must=(
  LICENSE
  README.md
  package.json
  cordis.patch.yml
  lib/host.js
  lib/client.js
  lib/api.js
  lib/http.js
  lib/install.js
  lib/unzip.js
  lib/config-store.js
  lib/skill-detail.js
  lib/self-update.js
  lib/plugin-market.js
  lib/dsh-cli.js
  lib/ndjson.js
  lib/restart.js
  lib/runtime-profile.js
  lib/local-api.js
  lib/categories.js
)

missing=0
for f in "${must[@]}"; do
  if ! printf '%s\n' "${files[@]}" | grep -qx "$f"; then
    echo "package missing: $f" >&2
    missing=1
  fi
done

leaked=$(printf '%s\n' "${files[@]}" | grep -E '^(src/|lib/tests/|node_modules/|\.env)' || true)
if [[ -n $leaked ]]; then
  echo "package leaked:" >&2
  echo "$leaked" >&2
  missing=1
fi

if [[ $missing -ne 0 ]]; then
  echo "package files:" >&2
  printf '  %s\n' "${files[@]}" >&2
  exit 1
fi

echo "ok $tgz (${#files[@]} files)"

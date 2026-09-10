#!/usr/bin/env bash

set -euo pipefail

readonly RELEASE_OWNER="Lukasdias"
readonly OFFICIAL_REPOSITORY="Lukasdias/vite-http-tracker"
readonly RELEASE_BRANCH="master"

fail() {
  echo "release: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando obrigatório não encontrado: $1"
}

show_help() {
  cat <<'EOF'
Usage: bash scripts/release.sh [patch|minor|major|VERSION]

Increments package.json's version (patch by default), commits the version
bump, creates an annotated version tag, pushes both, and creates a GitHub
Release with generated notes.

The command is restricted to the repository owner and must run from a clean
master branch that is synchronized with origin/master.
EOF
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_help
    return 0
  fi
  [[ $# -le 1 ]] || fail "use apenas patch, minor, major ou uma versão explícita"

  require_command git
  require_command gh
  require_command node

  [[ "$(git branch --show-current)" == "$RELEASE_BRANCH" ]] ||
    fail "execute a release a partir da branch $RELEASE_BRANCH"
  [[ -z "$(git status --porcelain)" ]] || fail "working tree não está limpa"

  local authenticated_user repository version tag local_head remote_head bump
  authenticated_user="$(gh api user --jq '.login')"
  [[ "$authenticated_user" == "$RELEASE_OWNER" ]] ||
    fail "usuário GitHub não autorizado: $authenticated_user"

  repository="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
  [[ "$repository" == "$OFFICIAL_REPOSITORY" ]] ||
    fail "repositório não autorizado: $repository"

  git fetch origin "$RELEASE_BRANCH" --quiet
  local_head="$(git rev-parse HEAD)"
  remote_head="$(git rev-parse "origin/$RELEASE_BRANCH")"
  [[ "$local_head" == "$remote_head" ]] ||
    fail "master local não está sincronizado com origin/master"

  bump="${1:-patch}"
  version="$(node - "$bump" <<'NODE'
const fs = require("fs");
const bump = process.argv.at(-1);
const packagePath = "package.json";
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const current = packageJson.version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
if (!match) throw new Error(`versão inválida no package.json: ${current}`);

let next;
if (/^\d+\.\d+\.\d+$/.test(bump)) {
  next = bump;
} else if (bump === "patch") {
  next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
} else if (bump === "minor") {
  next = `${match[1]}.${Number(match[2]) + 1}.0`;
} else if (bump === "major") {
  next = `${Number(match[1]) + 1}.0.0`;
} else {
  throw new Error(`incremento inválido: ${bump}`);
}

packageJson.version = next;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
process.stdout.write(next);
NODE
)"
  tag="v$version"
  git rev-parse "$tag" >/dev/null 2>&1 && fail "tag já existe: $tag"

  git add package.json
  git commit -m "chore: prepare release $tag"
  git push origin "$RELEASE_BRANCH"
  git tag -a "$tag" -m "Release $tag"
  git push origin "$tag"
  gh release create "$tag" \
    --repo "$OFFICIAL_REPOSITORY" \
    --target "$RELEASE_BRANCH" \
    --title "$tag" \
    --generate-notes

  echo "release: criada $tag"
}

main "$@"

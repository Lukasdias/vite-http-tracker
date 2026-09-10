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
Usage: bash scripts/release.sh

Creates an annotated version tag, pushes it to the official repository, and
creates a GitHub Release with generated notes.

The command is restricted to the repository owner and must run from a clean
master branch that is synchronized with origin/master.
EOF
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_help
    return 0
  fi
  [[ $# -eq 0 ]] || fail "argumento desconhecido: $1"

  require_command git
  require_command gh
  require_command node

  [[ "$(git branch --show-current)" == "$RELEASE_BRANCH" ]] ||
    fail "execute a release a partir da branch $RELEASE_BRANCH"
  [[ -z "$(git status --porcelain)" ]] || fail "working tree não está limpa"

  local authenticated_user repository version tag local_head remote_head
  authenticated_user="$(gh api user --jq '.login')"
  [[ "$authenticated_user" == "$RELEASE_OWNER" ]] ||
    fail "usuário GitHub não autorizado: $authenticated_user"

  repository="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
  [[ "$repository" == "$OFFICIAL_REPOSITORY" ]] ||
    fail "repositório não autorizado: $repository"

  version="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    fail "versão inválida no package.json: $version"
  tag="v$version"

  git fetch origin "$RELEASE_BRANCH" --quiet
  local_head="$(git rev-parse HEAD)"
  remote_head="$(git rev-parse "origin/$RELEASE_BRANCH")"
  [[ "$local_head" == "$remote_head" ]] ||
    fail "master local não está sincronizado com origin/master"
  git rev-parse "$tag" >/dev/null 2>&1 && fail "tag já existe: $tag"

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

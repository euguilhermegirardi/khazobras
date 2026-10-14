#!/usr/bin/env bash
# Ativa os hooks versionados em .githooks (rodar uma vez por clone).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/*
echo "Hooks ativados (core.hooksPath=.githooks)."

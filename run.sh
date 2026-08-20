#!/usr/bin/env bash
set -eo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🐳 Verifying Docker daemon status..."
if ! docker info >/dev/null 2>&1; then
  echo "❌ Error: Docker daemon is not running or accessible. Please start Docker and check user permissions."
  exit 1
fi

echo "📦 Pulling sandbox Docker runtime images..."
docker pull python:3.11-alpine
docker pull node:20-alpine
docker pull eclipse-temurin:21-alpine
docker pull gcc:latest

echo "🔧 Setting executable permissions for scripts and wrapper..."
chmod +x run.sh
[ -f "code/mvnw" ] && chmod +x code/mvnw

echo "📦 Installing frontend dependencies..."
(cd frontend && pnpm install)

echo "🚀 Starting frontend & backend services via mprocs..."
npx --yes mprocs
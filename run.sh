#!/usr/bin/env bash
set -eou

echo "📦 Installing frontend dependencies..."
cd frontend && pnpm install && cd ..

echo "🚀 Starting frontend & backend services via mprocs..."
npx mprocs

#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Job Application Studio - Linux / macOS Installer"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed! Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

echo "[1/2] Installing dependencies..."
npm install

echo ""
echo "[2/2] Running setup and Playwright browser installation..."
npm run setup

echo ""
echo "========================================================"
echo "  Installation Successful!"
echo "  Run ./start.sh to launch the application."
echo "========================================================"

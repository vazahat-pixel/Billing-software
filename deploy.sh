#!/usr/bin/env bash
# =============================================================================
# Automated 1-Click Fast Deployment Script for Billing Software
# Usage: ./deploy.sh
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/scripts/deploy-production.sh" "$@"

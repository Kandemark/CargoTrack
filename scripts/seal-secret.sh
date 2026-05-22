#!/usr/bin/env bash
# seal-secret.sh — Encrypt a Kubernetes Secret into a SealedSecret for safe git commit.
#
# Prerequisites:
#   - kubeseal CLI installed (https://github.com/bitnami-labs/sealed-secrets/releases)
#   - SealedSecrets controller running on the target cluster
#   - kubectl configured for the target cluster
#
# Usage:
#   ./scripts/seal-secret.sh <secret-name> <namespace>
#
# Example:
#   # Create a plain secret and pipe directly into kubeseal
#   kubectl create secret generic cargotrack-secrets \
#     --namespace cargotrack \
#     --from-literal=DB_PASSWORD='s3cret!' \
#     --from-literal=SECRET_KEY='django-key' \
#     --dry-run=client -o yaml | \
#     kubeseal --namespace cargotrack -o yaml > \
#     deploy/kubernetes/sealed-secrets/cargotrack-secrets.yaml
#
#   # Then commit the result:
#   git add deploy/kubernetes/sealed-secrets/cargotrack-secrets.yaml
#   git commit -m "chore: rotate secrets"
set -euo pipefail

SECRET_NAME="${1:?Usage: $0 <secret-name> <namespace>}"
NAMESPACE="${2:?Usage: $0 <secret-name> <namespace>}"
OUTPUT_DIR="deploy/kubernetes/sealed-secrets"

mkdir -p "$OUTPUT_DIR"

echo "Creating sealed secret: ${SECRET_NAME} in namespace ${NAMESPACE}"
echo "Enter secret values (Ctrl+D when done):"

# Read key=value pairs from stdin, one per line
PLAIN_ARGS=()
while IFS='=' read -r key value; do
  [[ -z "$key" ]] && continue
  PLAIN_ARGS+=(--from-literal="${key}=${value}")
done

if [[ ${#PLAIN_ARGS[@]} -eq 0 ]]; then
  echo "No values provided."
  exit 1
fi

kubectl create secret generic "$SECRET_NAME" \
  --namespace "$NAMESPACE" \
  "${PLAIN_ARGS[@]}" \
  --dry-run=client -o yaml | \
  kubeseal --namespace "$NAMESPACE" -o yaml > \
  "${OUTPUT_DIR}/${SECRET_NAME}.yaml"

echo "Sealed secret written to ${OUTPUT_DIR}/${SECRET_NAME}.yaml"
echo "Safe to commit."

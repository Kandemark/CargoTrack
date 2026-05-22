#!/usr/bin/env bash
# tf-init.sh — Initialize Terraform with remote S3 backend for the given environment.
#
# Usage:
#   ./scripts/tf-init.sh dev       # eu-west-1
#   ./scripts/tf-init.sh staging   # eu-west-1
#   ./scripts/tf-init.sh production
#
# Requires the bootstrap S3 bucket and DynamoDB table to already exist
# (created via deploy/terraform/bootstrap/).

set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|production>}"
REGION="${AWS_REGION:-eu-west-1}"

BUCKET="cargotrack-terraform-state"
TABLE="cargotrack-terraform-locks"
KEY="${ENV}/terraform.tfstate"

cd "$(dirname "$0")/../deploy/terraform"

echo "Initializing Terraform for ${ENV} environment..."
echo "  Backend: s3://${BUCKET}/${KEY}"
echo "  Lock:    dynamodb://${TABLE}"
echo "  Region:  ${REGION}"

terraform init \
  -backend-config="bucket=${BUCKET}" \
  -backend-config="key=${KEY}" \
  -backend-config="region=${REGION}" \
  -backend-config="dynamodb_table=${TABLE}" \
  -backend-config="encrypt=true"

echo "Terraform initialized for ${ENV}."
echo "Run: terraform plan -var='environment=${ENV}'"

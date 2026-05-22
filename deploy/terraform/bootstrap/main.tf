# CargoTrack Terraform Bootstrap — one-time setup for remote state storage.
#
# Creates the S3 bucket and DynamoDB lock table needed by the main Terraform
# configuration's S3 backend. Run this FIRST, from scratch, before anything else.
#
# Usage:
#   cd deploy/terraform/bootstrap
#   terraform init
#   terraform plan
#   terraform apply
#
# This module uses local state. After apply, the main configuration can use
# the remote S3 backend.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for the state resources"
  type        = string
  default     = "eu-west-1"
}

# ── S3 bucket for Terraform state ──────────────────────────────────────────
resource "aws_s3_bucket" "terraform_state" {
  bucket = "cargotrack-terraform-state"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "CargoTrack"
    Purpose     = "TerraformState"
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── DynamoDB table for state locking ───────────────────────────────────────
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "cargotrack-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project   = "CargoTrack"
    Purpose   = "TerraformStateLock"
    ManagedBy = "Terraform"
  }
}

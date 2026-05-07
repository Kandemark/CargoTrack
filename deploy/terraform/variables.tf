# CargoTrack Terraform — input variables
# Override per-environment: terraform apply -var-file="production.tfvars"

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-1"   # Closest to East Africa with full service coverage
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.31"
}

# ── Networking ──────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for subnets"
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# ── Compute ─────────────────────────────────────────────────────────────────
variable "node_instance_types" {
  description = "EKS node group instance types"
  type        = list(string)
  default     = ["t3.large", "t3a.large"]
}

# ── Database ────────────────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t3.large"
}

# ── Cache ───────────────────────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

# ── Common tags ─────────────────────────────────────────────────────────────
locals {
  common_tags = {
    Project     = "CargoTrack"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "github.com/Kandemark/CargoTrack"
  }
}

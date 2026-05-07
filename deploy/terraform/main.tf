# CargoTrack Terraform — AWS EKS infrastructure provisioning
# Usage: terraform init && terraform plan && terraform apply
# State: stored in S3 backend with DynamoDB locking (configure per-env)

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.36"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
  }

  backend "s3" {
    # Configure per-environment:
    # bucket         = "cargotrack-terraform-state"
    # key            = "production/terraform.tfstate"
    # region         = "eu-west-1"   # or af-south-1 for African region
    # dynamodb_table = "cargotrack-terraform-locks"
  }
}

# ── Provider ────────────────────────────────────────────────────────────────
provider "aws" {
  region = var.aws_region
}

# ── VPC & Networking ────────────────────────────────────────────────────────
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.17"

  name = "cargotrack-${var.environment}"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true

  tags = local.common_tags
}

# ── EKS Cluster ─────────────────────────────────────────────────────────────
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "20.30"

  cluster_name    = "cargotrack-${var.environment}"
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = var.node_instance_types
      min_size       = var.environment == "production" ? 3 : 1
      max_size       = var.environment == "production" ? 20 : 5
      desired_size   = var.environment == "production" ? 6 : 2

      disk_size = 100  # GB
    }
  }

  tags = local.common_tags
}

# ── RDS PostgreSQL + TimescaleDB ────────────────────────────────────────────
resource "aws_db_instance" "postgres" {
  identifier = "cargotrack-${var.environment}"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.environment == "production" ? 500 : 20
  max_allocated_storage = 1000
  storage_encrypted     = true
  storage_type          = "gp3"

  db_name  = "cargotrack"
  username = "cargotrack_admin"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name

  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  tags = local.common_tags
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

# ── ElastiCache Redis ────────────────────────────────────────────────────────
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "cargotrack-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.environment == "production" ? 2 : 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  tags = local.common_tags
}

# ── MSK Kafka ────────────────────────────────────────────────────────────────
resource "aws_msk_cluster" "kafka" {
  count = var.environment == "production" ? 1 : 0  # Only in production; dev uses KRaft
  cluster_name = "cargotrack-${var.environment}"

  kafka_version        = "3.7.x"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = module.vpc.private_subnets
    storage_info {
      ebs_storage_info {
        volume_size = 1000
      }
    }
    security_groups = [aws_security_group.kafka.id]
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.kafka.arn
    revision = aws_msk_configuration.kafka.latest_revision
  }

  tags = local.common_tags
}

# ── S3 Buckets (documents, logs, ML models) ─────────────────────────────────
resource "aws_s3_bucket" "documents" {
  bucket = "cargotrack-${var.environment}-documents"
  tags   = local.common_tags
}

resource "aws_s3_bucket" "logs" {
  bucket = "cargotrack-${var.environment}-logs"
  tags   = local.common_tags
}

resource "aws_s3_bucket" "ml_models" {
  bucket = "cargotrack-${var.environment}-ml-models"
  tags   = local.common_tags
}

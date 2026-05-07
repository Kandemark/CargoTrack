# CargoTrack Terraform — outputs

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "document_bucket" {
  description = "S3 bucket for shipment documents"
  value       = aws_s3_bucket.documents.bucket
}

output "log_bucket" {
  description = "S3 bucket for log archives"
  value       = aws_s3_bucket.logs.bucket
}

# Babylon Testnet Infrastructure
# Deploy: terraform apply -var-file=terraform.tfvars

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state storage - update bucket name for your AWS account
  backend "s3" {
    bucket         = "babylon-terraform-state"
    key            = "testnet/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "babylon-terraform-locks"
  }
}

# ============================================================================
# Providers
# ============================================================================

# Primary region for most resources
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "babylon"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# us-east-1 provider for CloudFront ACM certificates
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "babylon"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ============================================================================
# Variables
# ============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "testnet"
}

variable "aws_region" {
  description = "AWS region for primary resources"
  type        = string
  default     = "us-west-2"
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "babylon.market"
}

variable "api_origin" {
  description = "API backend origin domain"
  type        = string
  default     = "api.babylon.market"
}

variable "storage_gateway_origin" {
  description = "IPFS/Storage gateway origin"
  type        = string
  default     = "storage.testnet.jeju.network"
}

variable "ipfs_gateway_origin" {
  description = "IPFS gateway origin"
  type        = string
  default     = "ipfs.testnet.jeju.network"
}

variable "jns_resolver_origin" {
  description = "JNS resolver API origin"
  type        = string
  default     = "jns.testnet.jeju.network"
}

variable "enable_storage_cdn" {
  description = "Enable dedicated storage CDN"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email for CloudWatch alerts"
  type        = string
  default     = ""
}

locals {
  tags = {
    Environment = var.environment
    Project     = "babylon"
    Domain      = var.domain_name
  }
}

# ============================================================================
# Route53 DNS Zone
# ============================================================================

module "route53" {
  source = "../../modules/route53"

  environment = var.environment
  domain_name = var.domain_name
  create_zone = true
  tags        = local.tags
}

# ============================================================================
# ACM Certificate (must be in us-east-1 for CloudFront)
# ============================================================================

module "acm" {
  source = "../../modules/acm"

  providers = {
    aws = aws.us_east_1
  }

  environment         = var.environment
  domain_name         = var.domain_name
  zone_id             = module.route53.zone_id
  wait_for_validation = true
  tags                = local.tags

  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}",
    "app.${var.domain_name}",
    "ipfs.${var.domain_name}",
    "storage.${var.domain_name}",
  ]
}

# ============================================================================
# CDN (CloudFront + S3)
# ============================================================================

module "cdn" {
  source = "../../modules/cdn"

  environment            = var.environment
  domain_name            = var.domain_name
  acm_certificate_arn    = module.acm.certificate_arn
  zone_id                = module.route53.zone_id
  api_origin             = var.api_origin
  storage_gateway_origin = var.storage_gateway_origin

  # Storage CDN settings
  enable_storage_cdn  = var.enable_storage_cdn
  ipfs_gateway_origin = var.ipfs_gateway_origin
  jns_resolver_origin = var.jns_resolver_origin

  tags = local.tags
}

# ============================================================================
# Monitoring
# ============================================================================

module "monitoring" {
  source = "../../modules/monitoring"

  environment                = var.environment
  cloudfront_distribution_id = module.cdn.cloudfront_distribution_id
  alert_email                = var.alert_email
}

# ============================================================================
# Outputs
# ============================================================================

output "nameservers" {
  description = "Nameservers to configure at domain registrar"
  value       = module.route53.nameservers
}

output "zone_id" {
  description = "Route53 zone ID"
  value       = module.route53.zone_id
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = module.acm.certificate_arn
}

output "frontend_bucket" {
  description = "S3 bucket for frontend assets"
  value       = module.cdn.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = module.cdn.cloudfront_distribution_id
}

output "app_url" {
  description = "Primary frontend URL"
  value       = module.cdn.app_url
}

output "storage_cdn_urls" {
  description = "Storage CDN URLs"
  value       = module.cdn.storage_cdn_urls
}

output "deployment_info" {
  description = "Deployment information summary"
  value = {
    environment = var.environment
    domain      = var.domain_name
    app_url     = module.cdn.app_url
    api_url     = "https://api.${var.domain_name}"
    ipfs_url    = var.enable_storage_cdn ? "https://ipfs.${var.domain_name}" : null
    storage_url = var.enable_storage_cdn ? "https://storage.${var.domain_name}" : null
    s3_bucket   = module.cdn.bucket_name
    cf_dist_id  = module.cdn.cloudfront_distribution_id
  }
}

output "monitoring" {
  description = "Monitoring resources"
  value = {
    logs_bucket   = module.cdn.logs_bucket
    sns_topic     = module.monitoring.sns_topic_arn
    dashboard_url = module.monitoring.dashboard_url
  }
}


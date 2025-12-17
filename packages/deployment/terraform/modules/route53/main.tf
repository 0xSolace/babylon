# Route53 Module - DNS Hosted Zone Management for babylon.market
# Creates and manages the primary domain zone and records

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name (e.g., babylon.market)"
  type        = string
  default     = "babylon.market"
}

variable "create_zone" {
  description = "Whether to create a new hosted zone (false if zone already exists)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Create hosted zone if it doesn't exist
resource "aws_route53_zone" "main" {
  count = var.create_zone ? 1 : 0

  name    = var.domain_name
  comment = "Babylon ${var.environment} - Decentralized Prediction Markets - Managed by Terraform"

  force_destroy = var.environment != "mainnet"

  tags = merge(
    var.tags,
    {
      Name        = "${var.domain_name}-zone"
      Environment = var.environment
      Project     = "babylon"
    }
  )
}

# Data source for existing zone (used when create_zone = false)
data "aws_route53_zone" "existing" {
  count = var.create_zone ? 0 : 1

  name         = var.domain_name
  private_zone = false
}

locals {
  zone_id     = var.create_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.existing[0].zone_id
  nameservers = var.create_zone ? aws_route53_zone.main[0].name_servers : data.aws_route53_zone.existing[0].name_servers
}

# Outputs
output "zone_id" {
  description = "Route53 zone ID"
  value       = local.zone_id
}

output "zone_name" {
  description = "Route53 zone name"
  value       = var.domain_name
}

output "nameservers" {
  description = "Route53 nameservers (update at domain registrar)"
  value       = local.nameservers
}

output "zone_arn" {
  description = "Route53 zone ARN"
  value       = var.create_zone ? aws_route53_zone.main[0].arn : data.aws_route53_zone.existing[0].arn
}


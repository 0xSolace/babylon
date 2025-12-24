# CDN Module - S3 + CloudFront for Babylon Static Frontend
# Serves the decentralized frontend with global CDN distribution

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name (e.g., babylon.market)"
  type        = string
  default     = "babylon.market"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1 for CloudFront)"
  type        = string
}

variable "zone_id" {
  description = "Route53 zone ID for DNS records"
  type        = string
}

variable "api_origin" {
  description = "API origin domain for backend requests"
  type        = string
  default     = "api.babylon.market"
}

variable "storage_gateway_origin" {
  description = "IPFS/Storage gateway origin"
  type        = string
  default     = "storage.jeju.network"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "enable_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = true
}

# ============================================================================
# S3 Bucket for Static Frontend
# ============================================================================

resource "aws_s3_bucket" "frontend" {
  bucket = "babylon-${var.environment}-frontend"

  force_destroy = var.environment != "mainnet"

  tags = merge(
    var.tags,
    {
      Name        = "babylon-${var.environment}-frontend"
      Environment = var.environment
      Project     = "babylon"
    }
  )
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ============================================================================
# S3 Bucket for CloudFront Access Logs
# ============================================================================

resource "aws_s3_bucket" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = "babylon-${var.environment}-frontend-logs"

  force_destroy = var.environment != "mainnet"

  tags = merge(
    var.tags,
    {
      Name        = "babylon-${var.environment}-frontend-logs"
      Environment = var.environment
      Purpose     = "cloudfront-access-logs"
    }
  )
}

resource "aws_s3_bucket_public_access_block" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    expiration {
      days = 90
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS configuration for frontend assets
resource "aws_s3_bucket_cors_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = [
      "https://${var.domain_name}",
      "https://www.${var.domain_name}",
      "https://app.${var.domain_name}",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ============================================================================
# CloudFront Origin Access Identity
# ============================================================================

resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "OAI for Babylon frontend in ${var.environment}"
}

# S3 bucket policy to allow CloudFront OAI
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

# ============================================================================
# CloudFront Distribution
# ============================================================================

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Babylon Frontend - ${var.environment}"
  default_root_object = "index.html"
  http_version        = "http2and3"
  price_class         = var.environment == "mainnet" ? "PriceClass_All" : "PriceClass_100"

  aliases = [
    var.domain_name,
    "www.${var.domain_name}",
    "app.${var.domain_name}",
  ]

  # Access logging (optional)
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      bucket          = aws_s3_bucket.logs[0].bucket_regional_domain_name
      prefix          = "frontend/"
      include_cookies = false
    }
  }

  # Primary origin: S3 bucket for static assets
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  # API origin: Backend server
  origin {
    domain_name = var.api_origin
    origin_id   = "API-backend"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }

    custom_header {
      name  = "X-CDN-Origin"
      value = "babylon-cloudfront"
    }
  }

  # Storage/IPFS origin
  origin {
    domain_name = var.storage_gateway_origin
    origin_id   = "Storage-gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default: Serve static frontend from S3
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-frontend"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Cache behavior for hashed static assets (immutable)
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 31536000 # 1 year
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.immutable.id
  }

  # Cache behavior for static directory
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 31536000 # 1 year
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.immutable.id
  }

  # Cache behavior for static assets
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 86400    # 1 day
    default_ttl            = 604800   # 1 week
    max_ttl                = 31536000 # 1 year
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # API routes - proxy to backend (no caching)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-backend"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin", "Accept", "X-Requested-With"]

      cookies {
        forward = "all"
      }
    }

    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # SSE endpoints - no cache, allow streaming
  ordered_cache_behavior {
    path_pattern     = "/api/sse/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-backend"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Accept", "Cache-Control"]

      cookies {
        forward = "all"
      }
    }

    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = false # Don't compress streaming
    viewer_protocol_policy = "redirect-to-https"
  }

  # A2A/MCP endpoints
  ordered_cache_behavior {
    path_pattern     = "/a2a/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-backend"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin"]

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # IPFS content - proxy to storage gateway
  ordered_cache_behavior {
    path_pattern     = "/ipfs/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "Storage-gateway"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    # IPFS CIDs are immutable - cache forever
    min_ttl                = 31536000
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.immutable.id
  }

  # Custom error responses for SPA routing
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(
    var.tags,
    {
      Name        = "babylon-${var.environment}-cdn"
      Environment = var.environment
      Project     = "babylon"
    }
  )
}

# ============================================================================
# Response Headers Policy for Immutable Content
# ============================================================================

resource "aws_cloudfront_response_headers_policy" "immutable" {
  name    = "babylon-${var.environment}-immutable"
  comment = "Headers for immutable content (hashed assets, IPFS)"

  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "public, max-age=31536000, immutable"
      override = true
    }
  }

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["*"]
    }

    origin_override = true
  }

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

# ============================================================================
# DNS Records
# ============================================================================

resource "aws_route53_record" "frontend_apex" {
  zone_id = var.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "frontend_www" {
  zone_id = var.zone_id
  name    = "www"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "frontend_app" {
  zone_id = var.zone_id
  name    = "app"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# AAAA records for IPv6
resource "aws_route53_record" "frontend_apex_ipv6" {
  zone_id = var.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# ============================================================================
# Outputs
# ============================================================================

output "bucket_name" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.frontend.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "app_url" {
  description = "Public URL for the frontend"
  value       = "https://${var.domain_name}"
}

output "cloudfront_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "logs_bucket" {
  description = "S3 bucket name for CloudFront access logs"
  value       = var.enable_logging ? aws_s3_bucket.logs[0].id : null
}


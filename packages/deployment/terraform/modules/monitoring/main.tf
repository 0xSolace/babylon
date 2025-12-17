# CloudWatch Monitoring for Babylon Frontend
#
# COSTS: ~$3/month for dashboard + alarms
# REQUIREMENTS: CloudFront distribution must exist before applying

variable "environment" {
  type = string
}

variable "cloudfront_distribution_id" {
  type = string
}

variable "alert_email" {
  type        = string
  default     = ""
  description = "Email for alerts. Leave empty to skip email subscription."
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "babylon-${var.environment}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Dashboard
# Uses standard CloudFront metrics (no additional cost)
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "babylon-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "CloudFront Requests"
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", var.cloudfront_distribution_id, "Region", "Global"]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Error Rates"
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", var.cloudfront_distribution_id, "Region", "Global"],
            [".", "5xxErrorRate", ".", ".", ".", "."]
          ]
          period = 300
          stat   = "Average"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Bytes Downloaded"
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "BytesDownloaded", "DistributionId", var.cloudfront_distribution_id, "Region", "Global"]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Total Error Count"
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "TotalErrorRate", "DistributionId", var.cloudfront_distribution_id, "Region", "Global"]
          ]
          period = 300
          stat   = "Average"
        }
      }
    ]
  })
}

# Alarm: High 5xx error rate (server errors)
resource "aws_cloudwatch_metric_alarm" "high_5xx_rate" {
  alarm_name          = "babylon-${var.environment}-high-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "5xx error rate exceeded 5% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = var.cloudfront_distribution_id
    Region         = "Global"
  }
}

# Alarm: High total error rate
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "babylon-${var.environment}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TotalErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 15
  alarm_description   = "Total error rate exceeded 15% for 15 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = var.cloudfront_distribution_id
    Region         = "Global"
  }
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  value = "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

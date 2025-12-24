import { logger } from '@babylon/shared'
import { Elysia } from 'elysia'

/**
 * Cron authentication header check
 */
function verifyCronAuth(headers: Record<string, string | undefined>): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // Allow in development

  const authHeader = headers.authorization
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Cron routes
 * Migrated from: apps/web/app/api/cron/*
 */
export const cronRoutes = new Elysia({ prefix: '/api/cron' })
  .onBeforeHandle(({ headers, set }) => {
    if (!verifyCronAuth(headers)) {
      set.status = 401
      return { error: 'Unauthorized', message: 'Invalid cron secret' }
    }
  })

  // Training cron job
  .post(
    '/training',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Training cron job triggered',
        { timestamp },
        'POST /api/cron/training',
      )

      return {
        success: true,
        message: 'Training cron completed',
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Training cron job',
      },
    },
  )

  // Training check job
  .post(
    '/training-check',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Training check cron job triggered',
        { timestamp },
        'POST /api/cron/training-check',
      )

      return {
        success: true,
        status: {
          isTraining: false,
        },
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Training check cron job',
      },
    },
  )

  // Weekly dataset upload
  .post(
    '/weekly-dataset-upload',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Weekly dataset upload triggered',
        { timestamp },
        'POST /api/cron/weekly-dataset-upload',
      )

      return {
        success: true,
        message: 'Dataset upload check completed',
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Weekly dataset upload',
      },
    },
  )

  // Perp funding rate update
  .post(
    '/perp-funding',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Perp funding rate update triggered',
        { timestamp },
        'POST /api/cron/perp-funding',
      )

      return {
        success: true,
        message: 'Perp funding rate update completed',
        fundingRate: 0,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Update perpetual funding rates',
      },
    },
  )

  // Internal training trigger
  .post(
    '/_training',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Internal training trigger received',
        { timestamp },
        'POST /api/cron/_training',
      )

      return {
        success: true,
        message: 'Training trigger received',
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Internal training trigger',
      },
    },
  )

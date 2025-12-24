/**
 * Claude Service - Routes through Jeju Compute
 *
 * ALL LLM inference routes through Jeju's decentralized compute marketplace.
 * NO FALLBACKS to direct Anthropic/OpenAI/Groq APIs.
 *
 * Jeju Compute nodes offer various models including Claude, GPT, Llama, etc.
 */

import { logger } from '@babylon/shared'

// Jeju Compute endpoint - must be set
const JEJU_COMPUTE_ENDPOINT =
  process.env.JEJU_COMPUTE_ENDPOINT ||
  process.env.JEJU_DWS_ENDPOINT ||
  'http://localhost:4100'

interface ClaudeParams {
  prompt: string
  system?: string
  model?: 'claude-sonnet-4-5' | 'claude-haiku-4-5' | 'claude-opus-4-1'
  temperature?: number
  maxTokens?: number
}

/**
 * Call Claude through Jeju Compute
 *
 * Routes to Jeju's decentralized inference marketplace.
 * No direct Anthropic API calls.
 */
export async function callClaudeDirect(params: ClaudeParams): Promise<string> {
  const model = params.model || 'claude-sonnet-4-5'
  const startTime = Date.now()

  // Build messages array
  const messages: Array<{ role: string; content: string }> = []
  if (params.system) {
    messages.push({ role: 'system', content: params.system })
  }
  messages.push({ role: 'user', content: params.prompt })

  // Call Jeju Compute inference endpoint
  const response = await fetch(`${JEJU_COMPUTE_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jeju-model': model,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: params.maxTokens || 8192,
      temperature: params.temperature ?? 0.3,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `[ClaudeService] Jeju Compute inference failed (${response.status}): ${errorText}. ` +
        `Ensure Jeju is running: jeju dev`,
    )
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
    usage?: { prompt_tokens: number; completion_tokens: number }
  }

  const latencyMs = Date.now() - startTime
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('[ClaudeService] Empty response from Jeju Compute')
  }

  logger.debug(
    'Jeju Compute inference completed',
    {
      model,
      latencyMs,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
    'ClaudeService',
  )

  return content
}

/**
 * Check if Jeju Compute is available
 */
export async function isJejuComputeHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${JEJU_COMPUTE_ENDPOINT}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * List available models from Jeju Compute
 */
export async function listAvailableModels(): Promise<
  Array<{
    model: string
    provider: string
    pricePerToken: string
  }>
> {
  const response = await fetch(`${JEJU_COMPUTE_ENDPOINT}/v1/models`)

  if (!response.ok) {
    throw new Error(
      `[ClaudeService] Failed to list models: ${response.statusText}`,
    )
  }

  const data = (await response.json()) as {
    data: Array<{
      id: string
      owned_by: string
      pricing?: { input: string; output: string }
    }>
  }

  return data.data.map((m) => ({
    model: m.id,
    provider: m.owned_by,
    pricePerToken: m.pricing
      ? `${m.pricing.input}/${m.pricing.output}`
      : 'unknown',
  }))
}

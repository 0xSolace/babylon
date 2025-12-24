/**
 * Agent Type Definitions
 *
 * Shared types for agent capabilities and profiles
 */

import { z } from 'zod'

export const GameNetworkInfoSchema = z.object({
  chainId: z.number(),
  registryAddress: z.string(),
  reputationAddress: z.string().optional().nullable(),
  marketAddress: z.string().optional().nullable(),
})
export type GameNetworkInfo = z.infer<typeof GameNetworkInfoSchema>

export const AgentCapabilitiesSchema = z.object({
  strategies: z.array(z.string()).optional().default([]),
  markets: z.array(z.string()).optional().default([]),
  actions: z.array(z.string()).optional().default([]),
  version: z.string().optional().default('1.0.0'),
  x402Support: z.boolean().optional(),
  platform: z.string().optional().nullable(),
  userType: z.string().optional().nullable(),
  gameNetwork: GameNetworkInfoSchema.optional(),

  // OASF Taxonomy Support
  skills: z.array(z.string()).optional().default([]),
  domains: z.array(z.string()).optional().default([]),

  // A2A Communication Endpoints
  a2aEndpoint: z.string().optional().nullable(),
  mcpEndpoint: z.string().optional().nullable(),
})
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>

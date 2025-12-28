/**
 * Babylon Messaging Constants
 *
 * Babylon uses Jeju's public infrastructure for messaging:
 * - Farcaster: Posts to /babylon channel on Jeju's Farcaster network
 * - XMTP: Filters messages to Babylon app clients via BABYLON_APP_ID
 *
 * For messaging functionality, use @jejunetwork/messaging directly.
 */

import { keccak256, toHex } from 'viem'

/** Babylon's Farcaster channel on the Jeju network */
export const BABYLON_FARCASTER_CHANNEL = 'babylon'

/** Babylon's Farcaster channel URL for posting casts */
export const BABYLON_CHANNEL_URL = `https://warpcast.com/~/channel/${BABYLON_FARCASTER_CHANNEL}`

/** Babylon's app ID for XMTP message filtering (keccak256('babylon')) */
export const BABYLON_APP_ID = keccak256(toHex('babylon'))

/** Babylon's app ID for moderation/ban manager */
export const BABYLON_BAN_APP_ID = BABYLON_APP_ID

/**
 * BBLN Token Rewards
 *
 * @description Token reward amounts for various actions in the rewards system.
 * All amounts are in BBLN tokens with 18 decimals (wei format).
 *
 * IMPORTANT: These are actual BBLN token transfers, not points.
 * The game economy is fully decentralized with real token rewards.
 */

/**
 * Helper to convert human-readable BBLN amounts to wei (18 decimals)
 */
function bblnToWei(amount: number): bigint {
  return BigInt(Math.floor(amount * 1e18))
}

/**
 * BBLN token reward amounts for various user actions
 *
 * @description Defines BBLN token amounts awarded for different user actions.
 * All values are in wei (18 decimals). Used by the rewards service.
 */
export const BBLN_REWARDS = {
  // Signup & Profile
  INITIAL_SIGNUP: bblnToWei(100), // 100 BBLN for signing up
  PROFILE_COMPLETION: bblnToWei(20), // 20 BBLN for completing profile (Username + Profile Image + Bio)

  // Social Links
  FARCASTER_LINK: bblnToWei(30), // 30 BBLN for linking Farcaster
  FARCASTER_FOLLOW: bblnToWei(10), // 10 BBLN for following on Farcaster
  TWITTER_LINK: bblnToWei(30), // 30 BBLN for linking Twitter/X
  TWITTER_FOLLOW: bblnToWei(10), // 10 BBLN for following on Twitter/X
  DISCORD_LINK: bblnToWei(30), // 30 BBLN for linking Discord
  DISCORD_JOIN: bblnToWei(10), // 10 BBLN for joining Discord server
  WALLET_CONNECT: bblnToWei(30), // 30 BBLN for connecting wallet

  // Sharing
  SHARE_ACTION: bblnToWei(50), // 50 BBLN for sharing
  SHARE_TO_TWITTER: bblnToWei(50), // 50 BBLN for sharing to Twitter

  // Referrals
  REFERRAL_SIGNUP: bblnToWei(10), // 10 BBLN for referrer when someone signs up
  REFERRAL_BONUS: bblnToWei(10), // 10 BBLN bonus for new user who used referral code
  REFERRAL_QUALIFIED: bblnToWei(10), // 10 BBLN for referrer when referred user completes profile

  // Group Creation
  PRIVATE_GROUP_CREATE: bblnToWei(20), // 20 BBLN for creating a private group
  PRIVATE_CHANNEL_CREATE: bblnToWei(20), // 20 BBLN for creating a private channel
} as const

/**
 * Valid reasons for BBLN token transactions
 *
 * @description Enumeration of all valid reasons for awarding or transferring BBLN tokens.
 * Used in balance transactions and rewards service to track token movements.
 */
export type BBLNRewardReason =
  | 'initial_signup'
  | 'profile_completion'
  | 'farcaster_link'
  | 'farcaster_follow'
  | 'twitter_link'
  | 'twitter_follow'
  | 'discord_link'
  | 'discord_join'
  | 'wallet_connect'
  | 'share_action'
  | 'share_to_twitter'
  | 'referral_signup'
  | 'referral_bonus'
  | 'referral_qualified'
  | 'private_group_create'
  | 'private_channel_create'
  | 'admin_award'
  | 'admin_deduction'
  | 'purchase'
  | 'transfer_sent'
  | 'transfer_received'
  | 'report_reward'
  | 'trading_profit'
  | 'trading_loss'
  | 'liquidity_reward'
  | 'staking_reward'
  | 'airdrop'
  | 'npc_funding'
  | 'treasury_allocation'

/**
 * Display-friendly point values (human-readable numbers, not wei).
 * Used in frontend for showing reward amounts to users.
 */
export const POINTS = {
  // Signup & Profile
  INITIAL_SIGNUP: 100,
  PROFILE_COMPLETION: 20,

  // Social Links
  FARCASTER_LINK: 30,
  FARCASTER_FOLLOW: 10,
  TWITTER_LINK: 30,
  TWITTER_FOLLOW: 10,
  DISCORD_LINK: 30,
  DISCORD_JOIN: 10,
  WALLET_CONNECT: 30,

  // Sharing
  SHARE_ACTION: 50,
  SHARE_TO_TWITTER: 50,

  // Referrals
  REFERRAL_SIGNUP: 10,
  REFERRAL_BONUS: 10,
  REFERRAL_QUALIFIED: 10,

  // Group Creation
  PRIVATE_GROUP_CREATE: 20,
  PRIVATE_CHANNEL_CREATE: 20,
} as const

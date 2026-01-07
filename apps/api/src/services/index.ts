/**
 * Babylon Server Services
 *
 * Exports all service modules for use in routes.
 */

// Farcaster service - decentralized social feed
export {
  checkHubHealth,
  type FarcasterFeedPost,
  fetchFarcasterFeed,
  fetchFarcasterFeedPosts,
  getFarcasterClient,
  getFarcasterProfile,
  getFarcasterProfileByAddress,
  getFarcasterProfileByUsername,
  getFollowingFids,
  getSignerKey,
  linkFarcasterAccount,
  postToFarcaster,
  storeSignerKey,
  syncFarcasterCasts,
} from './farcaster'

// MLS group messaging service - encrypted group chat
export {
  acceptMLSGroupInvite,
  addMLSGroupMember,
  createMLSGroup,
  createMLSGroupFull,
  createMLSGroupInvite,
  getGroupEncryptionStatus,
  getMLSGroup,
  getMLSGroupMembers,
  getMLSGroupMessages,
  isMLSEnabled,
  isMLSGroup,
  leaveMLSGroup,
  listMLSGroups,
  sendMLSGroupMessageFull,
  sendMLSMessage,
  shutdownMLSClient,
  storeUserSignature as storeMLSUserSignature,
  subscribeToMLSMessages,
  syncMLSGroups,
} from './mls-groups'

// XMTP messaging service - encrypted DMs (real XMTP SDK with KMS)
export {
  addXMTPGroupMember,
  canMessage,
  createXMTPGroup,
  getInboxId,
  getMessagingStatus,
  getXMTPMessages,
  isXMTPEnabled,
  listXMTPConversations,
  removeXMTPGroupMember,
  sendEncryptedDM,
  sendXMTPGroupMessage,
  shutdownAllXMTPClients,
  shutdownXMTPClient,
  streamXMTPMessages,
} from './xmtp-messaging'

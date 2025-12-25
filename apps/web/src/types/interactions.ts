/**
 * Interaction types for social features
 * These are web-app specific types for managing UI state
 */

/** Post interaction state */
export interface PostInteraction {
  postId: string
  likeCount: number
  commentCount: number
  shareCount: number
  isLiked: boolean
  isShared: boolean
}

/** Comment interaction state */
export interface CommentInteraction {
  commentId: string
  likeCount: number
  replyCount: number
  isLiked: boolean
}

/** Comment author info */
export interface CommentAuthor {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
}

/** Comment data returned from API */
export interface CommentData {
  id: string
  postId: string
  authorId: string
  content: string
  createdAt: string | Date
  updatedAt?: string | Date
  parentCommentId?: string | null
  likeCount: number
  replyCount: number
  isLiked?: boolean
  author?: CommentAuthor
  // Flattened user fields used in UI components
  userId?: string
  userName?: string | null
  userUsername?: string | null
  userAvatar?: string | null
  parentCommentAuthorName?: string | null
}

/** Comment with nested replies */
export interface CommentWithReplies extends CommentData {
  replies?: CommentWithReplies[]
}

/** Favorited profile */
export interface FavoriteProfile {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  bio?: string | null
  followersCount?: number
  followingCount?: number
}

/** Interaction error */
export interface InteractionError {
  message: string
  code?: string
  details?: Record<string, unknown>
}

/** Pending interaction for optimistic updates */
export interface PendingInteraction {
  id: string
  type: 'like' | 'comment' | 'share' | 'favorite'
  targetId: string
  timestamp: number
  status: 'pending' | 'success' | 'failed'
}

// =============================================================================
// Component Props Types
// =============================================================================

/** Props for CommentInput component */
export interface CommentInputProps {
  postId: string
  parentCommentId?: string | null
  onSubmit?: (comment: CommentData) => void | Promise<void>
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  replyingToName?: string
}

/** Props for CommentCard component */
export interface CommentCardProps {
  comment: CommentWithReplies
  postId: string
  onReply?: (commentId: string) => void
  onEdit?: (commentId: string, content: string) => void | Promise<void>
  onDelete?: (commentId: string) => void | Promise<void>
  onReplySubmit?: (comment: CommentData) => void | Promise<void>
  className?: string
}

/** Initial interactions for InteractionBar */
export interface InitialInteractions {
  postId?: string
  likeCount?: number
  commentCount?: number
  shareCount?: number
  isLiked?: boolean
  isShared?: boolean
}

/** Post data for determining repost behavior and rendering */
export interface InteractionPostData {
  id?: string
  content?: string
  authorId?: string
  authorName?: string | null
  authorUsername?: string | null
  authorProfileImageUrl?: string | null
  timestamp?: string
  originalPostId?: string | null
  isQuote?: boolean
  quoteComment?: string | null
  likeCount?: number
  commentCount?: number
  shareCount?: number
  isLiked?: boolean
  isShared?: boolean
}

/** Props for InteractionBar component */
export interface InteractionBarProps {
  postId: string
  initialInteractions?: InitialInteractions
  onCommentClick?: () => void
  className?: string
  postData?: InteractionPostData
}

/** Props for LikeButton component */
export interface LikeButtonProps {
  targetId: string
  targetType: 'post' | 'comment'
  initialLiked?: boolean
  initialCount?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
}

/** Post data for repost button */
export interface RepostPostData {
  id?: string
  content?: string
  authorId?: string
  authorName?: string | null
  authorUsername?: string | null
  authorProfileImageUrl?: string | null
  timestamp?: string
}

/** Props for RepostButton component */
export interface RepostButtonProps {
  postId: string
  shareCount?: number
  initialShared?: boolean
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  postData?: RepostPostData
  className?: string
}

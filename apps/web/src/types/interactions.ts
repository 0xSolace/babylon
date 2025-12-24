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
  createdAt: string
  updatedAt?: string
  parentCommentId?: string | null
  likeCount: number
  replyCount: number
  isLiked?: boolean
  author?: CommentAuthor
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

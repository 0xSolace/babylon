/**
 * Article rows in `Post` (`type: 'article'`).
 *
 * **Why here:** Centralizes article insert/update SQL; engine keeps rate limits,
 * tag generation, and image orchestration.
 */

import type { ArticlePersistInput } from '@babylon/shared';
import { eq } from 'drizzle-orm';
import { asSystem } from './db';
import { posts } from './tables/posts';

export async function insertArticlePost(params: {
  articleId: string;
  article: ArticlePersistInput;
  createdAt: Date;
}): Promise<void> {
  const { articleId, article, createdAt } = params;
  const timestamp = article.timestamp ?? createdAt;

  await asSystem(
    async (c) =>
      c.insert(posts).values({
        id: articleId,
        type: 'article',
        content: article.summary,
        fullContent: article.content,
        articleTitle: article.title,
        byline: article.byline ?? undefined,
        biasScore: article.biasScore ?? undefined,
        sentiment: article.sentiment ?? undefined,
        slant: article.slant ?? undefined,
        category: article.category || 'news',
        imageUrl: article.imageUrl ?? undefined,
        authorId: article.authorOrgId,
        gameId: article.gameId,
        dayNumber: article.dayNumber,
        timestamp,
        createdAt,
        relatedQuestion: article.relatedQuestion,
      }),
    'article-persistence-insert'
  );
}

export async function updateArticlePostImageUrl(
  postId: string,
  imageUrl: string
): Promise<void> {
  await asSystem(
    async (c) => c.update(posts).set({ imageUrl }).where(eq(posts.id, postId)),
    'article-persistence-image-url'
  );
}

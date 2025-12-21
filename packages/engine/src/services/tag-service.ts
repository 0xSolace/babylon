/**
 * Tag Service
 *
 * Service for tag generation and storage:
 * - Generates organic tags from post content using LLM
 * - Stores and retrieves tags in the database
 * - Manages tag statistics and trending calculations
 */

import { db } from '@babylon/db';
import { isPromptLoggingEnabled, logPrompt } from '@babylon/engine';
import { generateSnowflakeId, logger } from '@babylon/shared';

// =============================================================================
// Types
// =============================================================================

/**
 * Generated tag structure
 */
export interface GeneratedTag {
  name: string; // lowercase, normalized (e.g., "nfc-north")
  displayName: string; // original display format (e.g., "NFC North")
  category?: string; // auto-detected category (e.g., "Sports", "Politics", "Tech")
}

// =============================================================================
// LLM Client Setup - Routes through Jeju Compute
// =============================================================================

const JEJU_COMPUTE_ENDPOINT =
  process.env.JEJU_COMPUTE_ENDPOINT ||
  process.env.JEJU_DWS_ENDPOINT ||
  'http://localhost:4100';

interface JejuInferenceClient {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
        temperature?: number;
      }) => Promise<{
        choices: Array<{ message: { content: string } }>;
      }>;
    };
  };
}

let jejuClient: JejuInferenceClient | null = null;

async function getJejuClient(): Promise<JejuInferenceClient | null> {
  if (jejuClient) {
    return jejuClient;
  }

  jejuClient = {
    chat: {
      completions: {
        create: async (params) => {
          const response = await fetch(
            `${JEJU_COMPUTE_ENDPOINT}/v1/chat/completions`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: params.model || 'llama-3.1-70b-versatile',
                messages: params.messages,
                max_tokens: params.max_tokens || 1024,
                temperature: params.temperature ?? 0.3,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Jeju Compute error: ${response.status}`);
          }

          return response.json();
        },
      },
    },
  };

  return jejuClient;
}

// =============================================================================
// Tag Generation
// =============================================================================

/**
 * Generate 1-3 organic tags from post content using LLM
 */
export async function generateTagsFromPost(
  content: string
): Promise<GeneratedTag[]> {
  const client = await getJejuClient();

  if (!client) {
    logger.warn(
      'Tag generation skipped - Jeju Compute not available',
      undefined,
      'TagService'
    );
    return [];
  }

  const prompt = `Extract 1-3 trending tags from this social media post. Tags should be topics people would search for on X/Twitter.

POST: "${content}"

RULES:
1. Extract SPECIFIC names, companies, products, or events (not generic topics)
2. Use the EXACT names from the post (preserve parody names like "AIlon Musk", "OpenAGI", "TeslAI")
3. Keep tags 1-3 words max
4. Return 1-3 tags (quality over quantity)
5. Tags should CLUSTER together - if post mentions related things, use tags that will group

GOOD TAGS (specific, searchable, will cluster):
- Person names: "AIlon Musk", "Sam AIltman", "Mark Zuckerborg"
- Company names: "OpenAGI", "TeslAI", "MetAI", "NvidAI"
- Products: "SMH-6", "Cybertruck", "Vision Pro"
- Events: "DevDay", "SEC Hearing", "Earnings Call"
- Specific topics: "AGI Timeline", "Crypto Regulation", "AI Safety"

BAD TAGS (too generic, won't cluster):
- "AI" (too broad - use specific company or product)
- "Tech" (too generic)
- "News" (not a topic)
- "Breaking" (not searchable)
- "Market" (use specific market like "Bitcoin" or "NVDA")

CLUSTERING EXAMPLES:
- Post about Sam AIltman announcing SMH-6 → tags: "Sam AIltman", "SMH-6", "OpenAGI" (all will cluster)
- Post about TeslAI stock after Musk tweet → tags: "TeslAI", "AIlon Musk" (will cluster)
- Post comparing NvidAI to AMD → tags: "NvidAI", "AMD" (separate companies, separate clusters)

CATEGORIES: Tech, Crypto, Finance, Politics, Entertainment, Media, AI, Gaming

Return ONLY valid XML:
<response>
  <tags>
    <tag>
      <displayName>Sam AIltman</displayName>
      <category>Tech</category>
    </tag>
    <tag>
      <displayName>OpenAGI</displayName>
      <category>AI</category>
    </tag>
  </tags>
</response>

If no good tags, return: <response><tags></tags></response>`;

  const model = 'llama-3.1-8b-instant'; // Jeju Compute default model

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are an XML-only assistant for tag extraction. You must respond ONLY with valid XML. No JSON, no explanations, no markdown.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const contentText = response.choices[0]?.message?.content?.trim();

  if (isPromptLoggingEnabled()) {
    await logPrompt({
      promptType: 'tag_generation',
      input: `System: You are an XML-only assistant for tag extraction. You must respond ONLY with valid XML. No JSON, no explanations, no markdown.\n\nUser: ${prompt}`,
      output: contentText || '',
      metadata: {
        provider: 'jeju-compute',
        model,
        temperature: 0.3,
        maxTokens: 500,
      },
    });
  }

  if (!contentText) {
    logger.warn(
      'No content in tag generation response',
      { content },
      'TagService'
    );
    return [];
  }

  const xmlContent = contentText
    .replace(/```xml\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsedTags: Array<{ displayName: string; category?: string }> = [];

  const tagMatches = xmlContent.matchAll(/<tag>([\s\S]*?)<\/tag>/g);

  for (const tagMatch of tagMatches) {
    const tagContent = tagMatch[1];
    if (!tagContent) continue;

    const displayNameMatch = tagContent.match(
      /<displayName>(.*?)<\/displayName>/
    );
    const categoryMatch = tagContent.match(/<category>(.*?)<\/category>/);

    if (displayNameMatch && displayNameMatch[1]) {
      const displayName = displayNameMatch[1].trim();
      const genericTags = [
        'ai',
        'tech',
        'news',
        'breaking',
        'market',
        'update',
        'latest',
      ];
      if (genericTags.includes(displayName.toLowerCase())) {
        logger.debug('Skipping generic tag', { displayName }, 'TagService');
        continue;
      }

      parsedTags.push({
        displayName,
        category: categoryMatch?.[1]?.trim(),
      });
    }
  }

  if (parsedTags.length === 0) {
    logger.debug(
      'No specific tags extracted from post',
      {
        xmlPreview: xmlContent.substring(0, 200),
        contentPreview: content.substring(0, 100),
      },
      'TagService'
    );
  }

  const generatedTags: GeneratedTag[] = parsedTags
    .filter((tag) => tag.displayName && typeof tag.displayName === 'string')
    .map((tag) => {
      const displayName = tag.displayName.trim();
      const name = displayName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      return {
        name,
        displayName,
        category: tag.category,
      };
    })
    .filter((tag) => tag.name.length > 0 && tag.displayName.length <= 50);

  logger.debug(
    'Generated tags from post',
    {
      content: content.slice(0, 100),
      tagsCount: generatedTags.length,
      tags: generatedTags,
    },
    'TagService'
  );

  return generatedTags;
}

/**
 * Generate tags in batch for multiple posts
 */
export async function generateTagsForPosts(
  posts: Array<{ id: string; content: string }>
): Promise<Map<string, GeneratedTag[]>> {
  const results = new Map<string, GeneratedTag[]>();

  const BATCH_SIZE = 5;
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (post) => {
      const tagList = await generateTagsFromPost(post.content);
      return { postId: post.id, tags: tagList };
    });

    const batchResults = await Promise.all(promises);
    for (const { postId, tags: tagList } of batchResults) {
      results.set(postId, tagList);
    }

    if (i + BATCH_SIZE < posts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// =============================================================================
// Tag Storage
// =============================================================================

/**
 * Store tags for a post
 * - Creates tags if they don't exist
 * - Links tags to post via PostTag join table
 */
export async function storeTagsForPost(
  postId: string,
  generatedTags: GeneratedTag[]
): Promise<void> {
  if (generatedTags.length === 0) {
    return;
  }

  const tagNames = generatedTags.map((t) => t.name);
  const existingTagsList = await db.tag.findMany({
    where: { name: { in: tagNames } },
  });

  const existingTagMap = new Map(existingTagsList.map((t) => [t.name, t]));

  const tagsToCreate = generatedTags.filter((t) => !existingTagMap.has(t.name));

  if (tagsToCreate.length > 0) {
    const now = new Date();
    const tagsToInsert = await Promise.all(
      tagsToCreate.map(async (tag) => ({
        id: await generateSnowflakeId(),
        name: tag.name,
        displayName: tag.displayName,
        category: tag.category ?? null,
        updatedAt: now,
      }))
    );

    await db.tag.createMany({ data: tagsToInsert, skipDuplicates: true });

    const createdTags = await db.tag.findMany({
      where: { name: { in: tagsToCreate.map((t) => t.name) } },
    });

    createdTags.forEach((t) => existingTagMap.set(t.name, t));
    logger.debug(
      'Created/fetched new tags',
      { count: createdTags.length },
      'TagService'
    );
  }

  const postTagsToInsert = await Promise.all(
    generatedTags.map(async (tag, _idx) => {
      const dbTag = existingTagMap.get(tag.name);
      if (!dbTag) {
        throw new Error(`Tag ${tag.name} not found in existing tags`);
      }

      return {
        id: await generateSnowflakeId(),
        postId,
        tagId: dbTag.id,
      };
    })
  );

  await db.postTag.createMany({ data: postTagsToInsert, skipDuplicates: true });

  logger.debug(
    'Stored tags for post',
    { postId, tagCount: generatedTags.length },
    'TagService'
  );
}

/**
 * Get tags for a post
 */
export async function getTagsForPost(postId: string) {
  const postTags = await db.postTag.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
  });

  const tagIds = [...new Set(postTags.map((pt) => pt.tagId))];
  const tags =
    tagIds.length > 0
      ? await db.tag.findMany({ where: { id: { in: tagIds } } })
      : [];
  const tagsById = new Map(tags.map((t) => [t.id, t]));

  return postTags.map((pt) => ({ ...pt, tag: tagsById.get(pt.tagId) ?? null }));
}

/**
 * Get posts by tag name
 */
export async function getPostsByTag(
  tagName: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options;

  const tag = await db.tag.findFirst({
    where: { name: tagName.toLowerCase() },
  });

  if (!tag) {
    return { tag: null, posts: [], total: 0 };
  }

  const [postTagsList, total] = await Promise.all([
    db.postTag.findMany({
      where: { tagId: tag.id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    db.postTag.count({ where: { tagId: tag.id } }),
  ]);

  const postIds = postTagsList.map((pt) => pt.postId);
  const posts =
    postIds.length > 0
      ? await db.post.findMany({
          where: { id: { in: postIds } },
        })
      : [];

  const postsById = new Map(posts.map((p) => [p.id, p]));

  return {
    tag,
    posts: postIds
      .map((id) => postsById.get(id))
      .filter((post): post is NonNullable<typeof post> => post !== undefined),
    total,
  };
}

/**
 * Get tag statistics (for trending calculation)
 */
export async function getTagStatistics(
  windowStart: Date,
  windowEnd: Date
): Promise<
  Array<{
    tagId: string;
    tagName: string;
    tagDisplayName: string;
    tagCategory: string | null;
    postCount: number;
    recentPostCount: number;
    oldestPostDate: Date;
    newestPostDate: Date;
  }>
> {
  const last24Hours = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

  // Query postTags within time window, then filter out deleted posts
  const allPostTags = await db.postTag.findMany({
    where: {
      AND: [
        { createdAt: { gte: windowStart } },
        { createdAt: { lte: windowEnd } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const postIds = [...new Set(allPostTags.map((pt) => pt.postId))];
  const tagIds = [...new Set(allPostTags.map((pt) => pt.tagId))];

  type PostRecord = {
    id: string;
    deletedAt: Date | null;
  };
  type TagRecord = {
    id: string;
    name: string;
    displayName: string;
    category: string | null;
  };
  const [posts, tags] = await Promise.all([
    postIds.length > 0
      ? (db.post.findMany({ where: { id: { in: postIds } } }) as Promise<
          PostRecord[]
        >)
      : ([] as PostRecord[]),
    tagIds.length > 0
      ? (db.tag.findMany({ where: { id: { in: tagIds } } }) as Promise<
          TagRecord[]
        >)
      : ([] as TagRecord[]),
  ]);

  const postsById = new Map(posts.map((p) => [p.id, p]));
  const tagsById = new Map(tags.map((t) => [t.id, t]));

  // Filter out postTags where the post is deleted
  const postTagsList = allPostTags.filter((pt) => {
    const post = postsById.get(pt.postId);
    return post !== undefined && post.deletedAt === null;
  });

  const tagStats = new Map<
    string,
    {
      tag: {
        id: string;
        name: string;
        displayName: string;
        category: string | null;
      };
      postCount: number;
      recentPostCount: number;
      oldestPostDate: Date;
      newestPostDate: Date;
    }
  >();

  for (const pt of postTagsList) {
    const tag = tagsById.get(pt.tagId);
    if (!tag) {
      throw new Error(`Tag ${pt.tagId} not found for postTag ${pt.id}`);
    }

    const existing = tagStats.get(pt.tagId);
    const isRecent = pt.createdAt >= last24Hours;

    if (existing) {
      existing.postCount++;
      if (isRecent) existing.recentPostCount++;
      if (pt.createdAt < existing.oldestPostDate)
        existing.oldestPostDate = pt.createdAt;
      if (pt.createdAt > existing.newestPostDate)
        existing.newestPostDate = pt.createdAt;
    } else {
      tagStats.set(pt.tagId, {
        tag: {
          id: tag.id,
          name: tag.name,
          displayName: tag.displayName,
          category: tag.category ?? null,
        },
        postCount: 1,
        recentPostCount: isRecent ? 1 : 0,
        oldestPostDate: pt.createdAt,
        newestPostDate: pt.createdAt,
      });
    }
  }

  return Array.from(tagStats.values())
    .filter((stats) => stats.postCount >= 3)
    .map((stats) => ({
      tagId: stats.tag.id,
      tagName: stats.tag.name,
      tagDisplayName: stats.tag.displayName,
      tagCategory: stats.tag.category,
      postCount: stats.postCount,
      recentPostCount: stats.recentPostCount,
      oldestPostDate: stats.oldestPostDate,
      newestPostDate: stats.newestPostDate,
    }))
    .sort((a, b) => b.postCount - a.postCount);
}

/**
 * Store trending tags calculation results
 */
export async function storeTrendingTags(
  tagsList: Array<{
    tagId: string;
    score: number;
    postCount: number;
    rank: number;
    relatedContext?: string;
  }>,
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  const calculatedAt = new Date();
  const rows = await Promise.all(
    tagsList.map(async (tag) => ({
      id: await generateSnowflakeId(),
      tagId: tag.tagId,
      score: tag.score,
      postCount: tag.postCount,
      rank: tag.rank,
      calculatedAt,
      windowStart,
      windowEnd,
      relatedContext: tag.relatedContext ?? null,
    }))
  );

  await db.trendingTag.createMany({ data: rows, skipDuplicates: true });

  logger.info(
    'Stored trending tags',
    { count: tagsList.length, windowStart, windowEnd },
    'TagService'
  );
}

/**
 * Get current trending tags (most recent calculation)
 */
export async function getCurrentTrendingTags(limit = 10) {
  const latestCalculation = await db.trendingTag.findFirst({
    orderBy: { calculatedAt: 'desc' },
  });

  if (!latestCalculation) {
    return [];
  }

  const cutoffTime = new Date(latestCalculation.calculatedAt.getTime() - 1000);

  const trending = await db.trendingTag.findMany({
    where: { calculatedAt: { gte: cutoffTime } },
    orderBy: { rank: 'asc' },
    take: limit,
  });

  const tagIds = [...new Set(trending.map((t) => t.tagId))];
  const tags =
    tagIds.length > 0
      ? await db.tag.findMany({ where: { id: { in: tagIds } } })
      : [];
  const tagsById = new Map(tags.map((t) => [t.id, t]));

  return trending.map((t) => ({ ...t, tag: tagsById.get(t.tagId) ?? null }));
}

/**
 * Get related/co-occurring tags for a given tag
 */
export async function getRelatedTags(
  tagId: string,
  limit = 3
): Promise<string[]> {
  const postsWithTagResult = await db.postTag.findMany({
    where: { tagId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const postIds = [...new Set(postsWithTagResult.map((pt) => pt.postId))];

  if (postIds.length === 0) {
    return [];
  }

  const coOccurringPostTags = await db.postTag.findMany({
    where: { AND: [{ postId: { in: postIds } }, { tagId: { not: tagId } }] },
  });

  const tagCounts = new Map<string, number>();
  coOccurringPostTags.forEach((pt) => {
    tagCounts.set(pt.tagId, (tagCounts.get(pt.tagId) || 0) + 1);
  });

  const sortedTagIds = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (sortedTagIds.length === 0) {
    return [];
  }

  const tagsList = await db.tag.findMany({
    where: { id: { in: sortedTagIds } },
  });

  const tagMap = new Map(tagsList.map((t) => [t.id, t.displayName ?? t.name]));
  return sortedTagIds
    .map((id) => tagMap.get(id))
    .filter(
      (name): name is string => typeof name === 'string' && name.length > 0
    );
}

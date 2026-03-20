import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const FEED_CLIENT_PATH = join(ROOT, 'apps/web/src/app/feed/FeedClient.tsx');
const COMPONENTS_INDEX_PATH = join(
  ROOT,
  'apps/web/src/app/feed/components/index.ts'
);

describe('feed component wiring', () => {
  it('defaults /feed to the For You tab', () => {
    const source = readFileSync(FEED_CLIENT_PATH, 'utf8');

    expect(source).toContain(
      "const [tab, setTab] = useState<FeedTab>('forYou')"
    );
  });

  it('renders Stories through ForYouFeedList instead of the retired NarrativeStoryList', () => {
    const source = readFileSync(FEED_CLIENT_PATH, 'utf8');

    expect(source).toContain("if (tab === 'stories') {");
    expect(source).toContain('<ForYouFeedList');
    expect(source).not.toContain('NarrativeStoryList');
  });

  it('does not re-export NarrativeStoryList from the feed components barrel', () => {
    const source = readFileSync(COMPONENTS_INDEX_PATH, 'utf8');

    expect(source).not.toContain('NarrativeStoryList');
  });
});

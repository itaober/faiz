import { ExternalLinkIcon } from 'lucide-react';
import { Tweet } from 'react-tweet';

import 'react-tweet/theme.css';
// Loaded after the upstream theme so the two travel together; the overrides also
// outrank it on specificity, so import order is not what makes them apply.
import './mdx-tweet.css';

/**
 * A tweet never changes once posted; only its counters do. A day keeps the post
 * route statically rendered without refetching X on every revalidation.
 */
const TWEET_REVALIDATE_SECONDS = 60 * 60 * 24;

/**
 * Stands in whenever the embed cannot be built, which most often means the
 * syndication API timed out or throttled us rather than that anything happened
 * to the post — so the copy scopes the failure to the preview and hands over the
 * permalink. The upstream fallback drops the URL, leaving a reader nowhere to go.
 */
const TweetLink = ({ id }: { id: string }) => (
  <a
    className="focus-ring border-border text-muted-foreground hover:bg-muted/65 hover:text-foreground block rounded-lg border px-4 py-3 text-sm transition-colors"
    href={`https://x.com/i/status/${id}`}
    rel="noreferrer noopener"
    target="_blank"
  >
    Preview unavailable · Read on X
    <ExternalLinkIcon
      aria-hidden="true"
      className="ml-0.5 inline size-3 align-[0.05em] opacity-55"
    />
    <span className="sr-only select-none">(opens in a new tab)</span>
  </a>
);

/**
 * `react-tweet` resolves to its server build under the `react-server` condition,
 * so the tweet is fetched and rendered on the server — no third-party script and
 * nothing to re-run after a client-side navigation.
 */
const MdxTweet = ({ id }: { id: string }) => (
  // Tailwind typography restyles bare `a`/`p`/`blockquote`, which would reach
  // into the tweet's own markup.
  <div className="not-prose">
    <Tweet
      id={id}
      fetchOptions={{ next: { revalidate: TWEET_REVALIDATE_SECONDS } }}
      components={{ TweetNotFound: () => <TweetLink id={id} /> }}
    />
  </div>
);

export default MdxTweet;

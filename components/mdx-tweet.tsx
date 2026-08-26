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
 * The upstream fallback drops the URL, which leaves a reader with no way to go
 * look for themselves once a tweet is deleted or the syndication API refuses.
 */
const TweetUnavailable = ({ id }: { id: string }) => (
  <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-3 text-sm">
    Tweet unavailable ·{' '}
    <a
      className="text-accent underline underline-offset-2"
      href={`https://x.com/i/status/${id}`}
      rel="noreferrer noopener"
      target="_blank"
    >
      View on X
    </a>
  </p>
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
      components={{ TweetNotFound: () => <TweetUnavailable id={id} /> }}
    />
  </div>
);

export default MdxTweet;

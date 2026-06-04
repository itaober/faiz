export type SearchType = 'post' | 'memo' | 'record' | 'page';

/** A flattened, plain-text searchable document (built server-side, searched client-side). */
export interface SearchDoc {
  id: string;
  type: SearchType;
  /** Display heading. Empty for memos (rendered as a text snippet instead). */
  title: string;
  /** Plain-text body used for indexing + snippet. */
  text: string;
  url: string;
  tags?: string[];
  /** createdTime, for display + tie-break sorting. */
  date?: string;
  /** Record score (0–10), shown on a record result's meta line. */
  rating?: number;
}

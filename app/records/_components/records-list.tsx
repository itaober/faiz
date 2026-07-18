import { getRecordsInfo } from '@/lib/data/data';

import { RecordsListClient } from './records-list-client';

// Always ship the full dataset: tab filtering happens client-side (from the
// URL), so switching tabs never round-trips the server or re-suspends.
export default async function RecordsList() {
  const records = await getRecordsInfo();

  return <RecordsListClient records={records} />;
}

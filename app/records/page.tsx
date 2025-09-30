import { getRecordsInfo } from '@/lib/data/data';

import { RecordsClient } from './_components/records-client';

export function generateMetadata() {
  return { title: 'Records' };
}

export default async function RecordsPage() {
  const records = await getRecordsInfo();

  return <RecordsClient records={records} />;
}

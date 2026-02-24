import type { Records } from '@/lib/data/data';
import { getRecordsInfo } from '@/lib/data/data';

import type { Tab } from '../_constants';
import { RecordsListClient } from './records-list-client';

interface RecordsListProps {
  activeTab: Tab;
}

const filterRecords = (records: Records, activeTab: Tab): Records => {
  if (activeTab === 'all') {
    return records;
  }

  return {
    book: activeTab === 'book' ? records.book : [],
    movie: activeTab === 'movie' ? records.movie : [],
    tv: activeTab === 'tv' ? records.tv : [],
    music: activeTab === 'music' ? records.music : [],
    game: activeTab === 'game' ? records.game : [],
  };
};

export default async function RecordsList({ activeTab }: RecordsListProps) {
  const records = await getRecordsInfo();

  if (!records) {
    return <RecordsListClient records={null} activeTab={activeTab} />;
  }

  const filtered = filterRecords(records, activeTab);

  return <RecordsListClient records={filtered} activeTab={activeTab} />;
}

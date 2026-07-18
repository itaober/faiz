'use client';
import dayjs from 'dayjs';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import MotionWrapper from '@/components/motion-wrapper';
import type { RecordItem as RecordDataItem, Records } from '@/lib/data/data';

import { normalizeTab, type Tab, tabList } from '../_constants';
import RecordItem from './record-item';
import RecordsSidePanel from './records-side-panel';
import { useRecordsInlineComposer } from './use-records-inline-composer';

interface RecordsListClientProps {
  records: Records | null;
}

export function RecordsListClient({ records }: RecordsListClientProps) {
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get('tab'));
  const { isComposerOpen, setComposerOpen, editingRecordKey, setEditingRecordKey } =
    useRecordsInlineComposer();

  const editingRecord = useMemo<RecordDataItem | undefined>(() => {
    if (!records || !editingRecordKey) {
      return undefined;
    }
    return Object.values(records)
      .flat()
      .find(record => `${record.type}-${record.createdTime}-${record.title}` === editingRecordKey);
  }, [editingRecordKey, records]);
  const sortedRecordsByYear = useMemo(() => {
    if (!records) {
      return [];
    }
    const currentRecordList = [
      ...(activeTab === 'all' ? Object.values(records).flat() : records[activeTab] || []),
    ].sort((a, b) => dayjs(b.createdTime).diff(dayjs(a.createdTime)));

    const groupedRecordsByYear = currentRecordList.reduce(
      (acc, record) => {
        const year = dayjs(record.createdTime).format('YYYY');
        if (!acc[year]) {
          acc[year] = [];
        }
        acc[year].push(record);
        return acc;
      },
      {} as Record<string, typeof currentRecordList>,
    );

    return Object.entries(groupedRecordsByYear).sort((a, b) => {
      return Number(b[0]) - Number(a[0]);
    });
  }, [activeTab, records]);

  const getTypeLabel = (type: Tab) => {
    if (activeTab === 'all') {
      return tabList.find(tab => tab.value === type)?.label;
    }
    return '';
  };
  const composerInitialType = activeTab === 'all' ? undefined : activeTab;
  const panel = isComposerOpen ? (
    <RecordsSidePanel initialType={composerInitialType} onClose={() => setComposerOpen(false)} />
  ) : editingRecord ? (
    <RecordsSidePanel record={editingRecord} onClose={() => setEditingRecordKey(null)} />
  ) : null;

  if (!sortedRecordsByYear.length) {
    return (
      <>
        <div className="text-muted-foreground mt-8 text-sm">
          <p>No records yet.</p>
        </div>
        {panel}
      </>
    );
  }

  // Tab switches swap content instantly (client-side filter, no animation) —
  // the only motion is the sliding tab underline. Page entry fades in once via
  // MotionWrapper.
  return (
    <>
      <MotionWrapper>
        <article className="mt-8 space-y-8">
          {sortedRecordsByYear.map(([year, recordList], sectionIndex) => (
            <section key={year}>
              <h2 className="mb-4 text-2xl font-bold">{year}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {recordList.map((record, recordIndex) => (
                  <RecordItem
                    key={`${record.type}-${record.createdTime}-${record.title}`}
                    {...record}
                    tab={activeTab}
                    typeLabel={getTypeLabel(record.type as Tab)}
                    preloadCover={sectionIndex === 0 && recordIndex === 0}
                  />
                ))}
              </div>
            </section>
          ))}
        </article>
      </MotionWrapper>
      {panel}
    </>
  );
}

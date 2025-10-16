'use client';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import PostTitle from '@/app/_components/post-title';
import type { Records } from '@/lib/data/data';
import { cn } from '@/lib/utils';

import { type Tab, tabList } from './constants';
import RecordItem from './record-item';

interface IRecordsClientProps {
  records: Records | null;
}

export function RecordsClient({ records }: IRecordsClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const sortedRecordsByYear = useMemo(() => {
    if (!records) {
      return [];
    }
    const currentRecordList =
      (activeTab === 'all' ? Object.values(records).flat() : records[activeTab])?.sort((a, b) =>
        dayjs(a.createdTime).diff(dayjs(b.createdTime)),
      ) || [];

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

  return (
    <div className="max-w-4xl overflow-y-hidden">
      <PostTitle title="Records" />
      <nav>
        <ul className="flex items-center gap-6 overflow-x-auto">
          {tabList.map(tab => (
            <li
              key={tab.value}
              className={cn('opacity-70 transition-opacity hover:opacity-100 active:opacity-100', {
                'border-b-2 font-medium opacity-100': activeTab === tab.value,
              })}
            >
              <button onClick={() => setActiveTab(tab.value)}>{tab.label}</button>
            </li>
          ))}
        </ul>
      </nav>
      <article className="mt-8 space-y-8">
        {sortedRecordsByYear.map(([year, records]) => (
          <section key={year}>
            <h2 className="mb-4 text-2xl font-bold">{year}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {records.map(record => (
                <RecordItem
                  key={record.title}
                  {...record}
                  tab={activeTab}
                  typeLabel={getTypeLabel(record.type as Tab)}
                />
              ))}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}

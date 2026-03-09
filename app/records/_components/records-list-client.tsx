'use client';
import dayjs from 'dayjs';
import { motion } from 'motion/react';
import { useMemo } from 'react';

import MotionWrapper from '@/components/motion-wrapper';
import { ANIMATION } from '@/lib/constants/animation';
import type { Records } from '@/lib/data/data';

import { type Tab, tabList } from '../_constants';
import RecordItem from './record-item';

interface RecordsListClientProps {
  records: Records | null;
  activeTab: Tab;
}

export function RecordsListClient({ records, activeTab }: RecordsListClientProps) {
  const sortedRecordsByYear = useMemo(() => {
    if (!records) {
      return [];
    }
    const currentRecordList =
      (activeTab === 'all' ? Object.values(records).flat() : records[activeTab])?.sort((a, b) =>
        dayjs(b.createdTime).diff(dayjs(a.createdTime)),
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

  if (!sortedRecordsByYear.length) {
    return (
      <div className="text-muted-foreground mt-8 text-sm">
        <p>No records yet.</p>
      </div>
    );
  }

  return (
    <MotionWrapper>
      <motion.article
        className="mt-8 space-y-8"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: ANIMATION.stagger.slow,
            },
          },
        }}
      >
        {sortedRecordsByYear.map(([year, recordList]) => (
          <motion.section
            key={year}
            variants={{
              hidden: { opacity: 0, y: ANIMATION.distance.normal },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: ANIMATION.duration.slow }}
          >
            <h2 className="mb-4 text-2xl font-bold">{year}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {recordList.map(record => (
                <RecordItem
                  key={record.title}
                  {...record}
                  tab={activeTab}
                  typeLabel={getTypeLabel(record.type as Tab)}
                />
              ))}
            </div>
          </motion.section>
        ))}
      </motion.article>
    </MotionWrapper>
  );
}

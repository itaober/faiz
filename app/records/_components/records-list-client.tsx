'use client';
import dayjs from 'dayjs';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import MotionWrapper from '@/components/motion-wrapper';
import { ANIMATION } from '@/lib/constants/animation';
import type { Records } from '@/lib/data/data';

import { type Tab, tabList } from '../_constants';
import RecordItem from './record-item';
import { useRecordsInlineComposer } from './use-records-inline-composer';

const RecordEditorSurface = dynamic(() => import('./record-editor-surface'), { ssr: false });

interface RecordsListClientProps {
  records: Records | null;
  activeTab: Tab;
}

export function RecordsListClient({ records, activeTab }: RecordsListClientProps) {
  const { isComposerOpen, setComposerOpen } = useRecordsInlineComposer();
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

  if (!sortedRecordsByYear.length && !isComposerOpen) {
    return (
      <div className="text-muted-foreground mt-8 text-sm">
        <p>No records yet.</p>
      </div>
    );
  }

  const visibleRecordGroups: typeof sortedRecordsByYear = sortedRecordsByYear.length
    ? sortedRecordsByYear
    : [[String(new Date().getFullYear()), []]];

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
        {visibleRecordGroups.map(([year, recordList], sectionIndex) => (
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
              {isComposerOpen && sectionIndex === 0 && (
                <motion.div
                  className="group flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-200"
                  initial={{ opacity: 0, y: ANIMATION.distance.small }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: ANIMATION.duration.normal }}
                >
                  <RecordEditorSurface
                    initialType={composerInitialType}
                    showTypeInMeta={activeTab === 'all'}
                    squareCover={activeTab === 'music'}
                    onCancel={() => setComposerOpen(false)}
                  />
                </motion.div>
              )}
              {recordList.map((record, recordIndex) => (
                <RecordItem
                  key={`${record.type}-${record.createdTime}-${record.title}`}
                  {...record}
                  tab={activeTab}
                  typeLabel={getTypeLabel(record.type as Tab)}
                  preloadCover={sectionIndex === 0 && recordIndex === 0 && !isComposerOpen}
                />
              ))}
            </div>
          </motion.section>
        ))}
      </motion.article>
    </MotionWrapper>
  );
}

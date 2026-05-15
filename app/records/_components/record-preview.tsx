import Link from 'next/link';
import type { ReactNode } from 'react';

import type { RecordItem } from '@/lib/data/data';

interface IRecordPreviewProps {
  record: RecordItem;
}

const markdownLinkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;

const normalizeInlineText = (value: string) =>
  value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');

const renderInlineText = (value: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(markdownLinkPattern)) {
    const [source, label, href] = match;
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(normalizeInlineText(value.slice(lastIndex, index)));
    }

    nodes.push(
      <Link
        key={`${href}-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-[oklch(0.78_0.004_106/0.45)] underline-offset-4 transition-colors hover:text-[oklch(0.99_0.001_106)]"
      >
        {normalizeInlineText(label)}
      </Link>,
    );

    lastIndex = index + source.length;
  }

  if (lastIndex < value.length) {
    nodes.push(normalizeInlineText(value.slice(lastIndex)));
  }

  return nodes;
};

const RecordComment = ({ comment }: { comment: string }) => {
  const blocks = comment
    .trim()
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split('\n').map(line => line.trim());
        const firstLine = lines[0] || '';
        const heading = firstLine.match(/^(#{1,3})\s+(.+)$/);
        const isQuote = lines.every(line => line.startsWith('>'));
        const isBulletList = lines.every(line => /^[-*]\s+/.test(line));
        const isOrderedList = lines.every(line => /^\d+\.\s+/.test(line));

        if (heading) {
          return (
            <h3
              key={index}
              className="text-[13px] leading-5 font-semibold text-[oklch(0.98_0.002_106)] md:text-sm"
            >
              {renderInlineText(heading[2])}
            </h3>
          );
        }

        if (isQuote) {
          return (
            <blockquote
              key={index}
              className="border-l border-[oklch(0.7_0.005_106/0.35)] pl-3 text-[oklch(0.84_0.004_106)]"
            >
              {renderInlineText(lines.map(line => line.replace(/^>\s?/, '')).join('\n'))}
            </blockquote>
          );
        }

        if (isBulletList) {
          return (
            <ul key={index} className="list-disc space-y-1 ps-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInlineText(line.replace(/^[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        if (isOrderedList) {
          return (
            <ol key={index} className="list-decimal space-y-1 ps-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInlineText(line.replace(/^\d+\.\s+/, ''))}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index} className="whitespace-pre-line">
            {renderInlineText(block)}
          </p>
        );
      })}
    </div>
  );
};

export default function RecordPreview({ record }: IRecordPreviewProps) {
  if (!record.comment?.trim()) {
    return null;
  }

  return (
    <div className="w-fit max-w-full text-[13px] leading-5 font-normal text-[oklch(0.95_0.003_106)] [text-shadow:0_1px_2px_oklch(0.02_0.004_106/0.6)] md:max-h-[calc(78vh-8rem)] md:overflow-y-auto md:text-sm">
      <RecordComment comment={record.comment} />
    </div>
  );
}

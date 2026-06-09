export const MAX_MEMO_CARD_IMAGES = 9;

export const getMemoImageLayout = (imageCount: number) => {
  const visibleCount = Math.min(Math.max(0, imageCount), MAX_MEMO_CARD_IMAGES);

  if (visibleCount <= 1) {
    return { columns: 1, visibleCount };
  }

  if (visibleCount === 2 || visibleCount === 4) {
    return { columns: 2, visibleCount };
  }

  return { columns: 3, visibleCount };
};

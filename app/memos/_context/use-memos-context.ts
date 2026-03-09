'use client';

import { useContext } from 'react';

import { MemosContext } from './memos-context-value';

export const useMemosContext = () => useContext(MemosContext);

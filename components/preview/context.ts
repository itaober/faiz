'use client';

import type { CSSProperties, RefObject } from 'react';
import { createContext, useContext } from 'react';

export type PreviewPhase = 'closed' | 'opening' | 'open' | 'closing';

export interface IPreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IActiveSourceImage {
  src: string;
  currentSrc: string;
  objectFit?: CSSProperties['objectFit'];
  objectPosition?: CSSProperties['objectPosition'];
}

export interface IPreviewContext {
  phase: PreviewPhase;
  phaseRef: RefObject<PreviewPhase>;
  setPhase: (phase: PreviewPhase) => void;
  isPreview: boolean;
  portalMounted: boolean;
  setPortalMounted: (mounted: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  sourceMediaRef: RefObject<HTMLElement | null>;
  originRectRef: RefObject<IPreviewRect | null>;
  mediaAspectRatio: number;
  setMediaAspectRatio: (aspectRatio: number) => void;
  sourceImages: ReadonlyMap<string, string>;
  setSourceImage: (src: string, currentSrc: string) => void;
  activeSourceImage: IActiveSourceImage | null;
  setActiveSourceImage: (image: IActiveSourceImage | null) => void;
}

export const PreviewContext = createContext<IPreviewContext | null>(null);

export const usePreview = () => {
  const context = useContext(PreviewContext);

  if (!context) {
    throw new Error('usePreview must be used within a Preview');
  }

  return context;
};

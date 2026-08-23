'use client';

import { useCallback, useRef, useState } from 'react';

import {
  type IActiveSourceImage,
  type IPreviewRect,
  PreviewContext,
  type PreviewPhase,
} from './context.ts';

interface IPreviewProps {
  children: React.ReactNode;
}

export const Preview = ({ children }: IPreviewProps) => {
  const [phase, setPhaseState] = useState<PreviewPhase>('closed');
  const phaseRef = useRef<PreviewPhase>('closed');
  const [portalMounted, setPortalMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sourceMediaRef = useRef<HTMLElement | null>(null);
  const originRectRef = useRef<IPreviewRect | null>(null);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(1);
  const [sourceImages, setSourceImages] = useState<ReadonlyMap<string, string>>(new Map());
  const [activeSourceImage, setActiveSourceImage] = useState<IActiveSourceImage | null>(null);

  const setPhase = useCallback((nextPhase: PreviewPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);
  const setSourceImage = useCallback((src: string, currentSrc: string) => {
    setSourceImages(images => {
      if (images.get(src) === currentSrc) {
        return images;
      }
      return new Map(images).set(src, currentSrc);
    });
  }, []);
  const isPreview = phase === 'opening' || phase === 'open' || phase === 'closing';

  return (
    <PreviewContext.Provider
      value={{
        phase,
        phaseRef,
        setPhase,
        isPreview,
        portalMounted,
        setPortalMounted,
        triggerRef,
        sourceMediaRef,
        originRectRef,
        mediaAspectRatio,
        setMediaAspectRatio,
        sourceImages,
        setSourceImage,
        activeSourceImage,
        setActiveSourceImage,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
};

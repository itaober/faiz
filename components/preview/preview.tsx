'use client';

import { useCallback, useRef, useState } from 'react';

import {
  type IActiveSourceImage,
  type IPreviewRect,
  type IPreviewSource,
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
  const sourcesRef = useRef(new Map<string, IPreviewSource>());
  const registerSource = useCallback((src: string, source: IPreviewSource) => {
    sourcesRef.current.set(src, source);
    return () => {
      if (sourcesRef.current.get(src) === source) {
        sourcesRef.current.delete(src);
      }
    };
  }, []);
  // Paging while open moves "home" to the cell of the image now shown, so closing flies it back
  // into its own cell instead of shrinking it into the one that was first opened.
  const retargetSource = useCallback((src: string) => {
    const source = sourcesRef.current.get(src);
    if (!source || phaseRef.current !== 'open') {
      return;
    }
    const previous = sourceMediaRef.current;
    if (previous === source.media) {
      // One trigger cycling through images (a gallery): its <img> may still be showing the last
      // one, so no snapshot — the preview image itself flies home.
      setActiveSourceImage(null);
      return;
    }
    if (previous) {
      previous.style.visibility = '';
    }
    source.media.style.visibility = 'hidden';
    sourceMediaRef.current = source.media;
    triggerRef.current = source.button;
    setActiveSourceImage(source.describe());
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
        registerSource,
        retargetSource,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
};

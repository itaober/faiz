import type { ISnowConfig } from './types';

export const SNOW_DENSITY = {
  light: 50,
  normal: 100,
  heavy: 200,
};

export const DEFAULT_SNOW_CONFIG: ISnowConfig = {
  count: SNOW_DENSITY.normal,
  wind: 0,
  speed: 1,
  minRadius: 1,
  maxRadius: 3, // Adjust max radius: from 4px to 3px (finer)
  color: 'rgba(255, 255, 255, 0.8)',
};

export interface ISnowConfig {
  count: number;
  wind: number;
  speed: number;
  minRadius: number;
  maxRadius: number;
  color: string;
}

export interface ISnowController {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  updateConfig: (config: Partial<ISnowConfig>) => void;
  resize: (width: number, height: number) => void;
}

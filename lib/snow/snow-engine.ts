import { Snowflake } from './snowflake';
import type { ISnowConfig, ISnowController } from './types';

export class SnowEngine implements ISnowController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: ISnowConfig;
  private snowflakes: Snowflake[] = [];
  private animationId: number | null = null;
  private isRunning = false;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement, config: ISnowConfig) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
    this.config = config;
    this.resize(canvas.clientWidth, canvas.clientHeight);
    this.initSnowflakes();
  }

  private initSnowflakes() {
    this.snowflakes = [];
    for (let i = 0; i < this.config.count; i++) {
      this.snowflakes.push(
        new Snowflake(this.width, this.height, this.config.minRadius, this.config.maxRadius),
      );
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  pause() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resume() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  updateConfig(newConfig: Partial<ISnowConfig>) {
    const prevCount = this.config.count;
    this.config = { ...this.config, ...newConfig };

    if (this.config.count !== prevCount) {
      this.initSnowflakes();
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private loop = () => {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = this.config.color;

    for (const flake of this.snowflakes) {
      flake.update(this.width, this.height, this.config.wind);
      flake.draw(this.ctx);
    }

    this.animationId = requestAnimationFrame(this.loop);
  };
}

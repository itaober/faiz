export class Snowflake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  oscillation: number;
  speed: number;

  constructor(width: number, height: number, minR: number, maxR: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * (maxR - minR) + minR;
    this.speed = (this.radius / maxR) * 0.3 + 0.23; // Speed adjustment: reduced by ~25%
    this.vx = (Math.random() - 0.5) * 0.3; // Drift adjustment
    this.vy = this.speed * (Math.random() * 0.6 + 0.6); // Fall speed: depends on base speed
    this.alpha = Math.random() * 0.5 + 0.3;
    this.oscillation = Math.random() * Math.PI * 2;
  }

  update(width: number, height: number, wind: number) {
    this.oscillation += 0.015; // Oscillation frequency
    this.x += this.vx + wind + Math.sin(this.oscillation) * 0.2; // Sway amplitude: reduced from 0.4 to 0.2
    this.y += this.vy;

    if (this.y > height) {
      this.y = -10;
      this.x = Math.random() * width;
    }

    if (this.x > width + 10) {
      this.x = -10;
    } else if (this.x < -10) {
      this.x = width + 10;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

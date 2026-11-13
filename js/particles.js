(function (global) {
  'use strict';

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.popups = [];
    }

    clear() {
      this.particles.length = 0;
      this.popups.length = 0;
    }

    spawnParticle(opts) {
      if (this.particles.length > 260) this.particles.shift();
      this.particles.push({
        x: opts.x,
        y: opts.y,
        vx: opts.vx || 0,
        vy: opts.vy || 0,
        gravity: opts.gravity ?? 0,
        size: opts.size || 3,
        color: opts.color || '#ffffff',
        life: opts.life || 0.4,
        maxLife: opts.life || 0.4,
        shape: opts.shape || 'square',
        spin: opts.spin || 0,
      });
    }

    spawnPopup(x, y, text, color = '#ffffff') {
      this.popups.push({
        x,
        y,
        vy: -36,
        text: String(text),
        color,
        life: 0.85,
        maxLife: 0.85,
      });
    }

    brickDebris(x, y, color = '#c85828') {
      const shards = [
        [-65, -210],
        [65, -210],
        [-45, -140],
        [45, -140],
      ];
      for (const [vx, vy] of shards) {
        this.spawnParticle({
          x: x + 6,
          y: y + 6,
          vx,
          vy,
          gravity: 780,
          size: 5,
          color,
          life: 0.75,
        });
      }
    }

    coinSparkle(x, y, big = false) {
      const count = big ? 12 : 6;
      const spd = big ? 95 : 55;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count;
        this.spawnParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 20,
          gravity: 160,
          size: big ? 3 : 2,
          color: i % 2 === 0 ? '#ffd838' : '#ffffff',
          life: big ? 0.55 : 0.35,
        });
      }
    }

    stompBurst(x, y, color = '#ffe898') {
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6;
        this.spawnParticle({
          x,
          y,
          vx: Math.cos(ang) * 75,
          vy: Math.sin(ang) * 55 - 25,
          gravity: 200,
          size: 3,
          color,
          life: 0.3,
        });
      }
    }

    dust(x, y, dir = 0) {
      this.spawnParticle({
        x,
        y,
        vx: -dir * (18 + Math.random() * 20) + (Math.random() - 0.5) * 18,
        vy: -12 - Math.random() * 18,
        gravity: 30,
        size: 3,
        color: '#f0ece0',
        life: 0.28,
      });
    }

    shockwave(x, y) {
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          this.spawnParticle({
            x: x + dir * 4,
            y: y - 2,
            vx: dir * (70 + i * 32),
            vy: -15 - i * 10,
            gravity: 120,
            size: 3,
            color: i % 2 === 0 ? '#ffffff' : '#ffd840',
            life: 0.32,
          });
        }
      }
    }

    leafBurst(x, y) {
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8;
        this.spawnParticle({
          x,
          y,
          vx: Math.cos(ang) * 85,
          vy: Math.sin(ang) * 65,
          gravity: 90,
          size: 3,
          color: i % 2 === 0 ? '#d88228' : '#70d848',
          life: 0.38,
        });
      }
    }

    firework(x, y) {
      const cols = ['#ff4848', '#ffd838', '#48d8ff', '#78ff78', '#ff70e8'];
      const c = cols[Math.floor(Math.random() * cols.length)];
      for (let i = 0; i < 16; i++) {
        const ang = (Math.PI * 2 * i) / 16;
        const spd = 60 + Math.random() * 55;
        this.spawnParticle({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          gravity: 95,
          size: 3,
          color: i % 3 === 0 ? '#ffffff' : c,
          life: 0.65,
        });
      }
    }

    lavaSplash(x, y) {
      for (let i = 0; i < 10; i++) {
        this.spawnParticle({
          x,
          y,
          vx: (Math.random() - 0.5) * 110,
          vy: -110 - Math.random() * 110,
          gravity: 540,
          size: 3,
          color: i % 2 === 0 ? '#ff7818' : '#ffe040',
          life: 0.65,
        });
      }
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.life -= dt;
        if (pop.life <= 0) {
          this.popups.splice(i, 1);
          continue;
        }
        pop.y += pop.vy * dt;
        pop.vy *= 0.94;
      }
    }

    render(ctx, camX, camY) {
      for (const p of this.particles) {
        const sx = Math.round(p.x - camX);
        const sy = Math.round(p.y - camY);
        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx, sy, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      for (const pop of this.popups) {
        const sx = Math.round(pop.x - camX);
        const sy = Math.round(pop.y - camY);
        ctx.fillStyle = '#000000';
        ctx.fillText(pop.text, sx + 1, sy + 1);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, sx, sy);
      }
      ctx.textAlign = 'left';
    }
  }

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.ParticleSystem = ParticleSystem;
})(window);

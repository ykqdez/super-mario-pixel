(function (global) {
  'use strict';

  const { TILE, TILE_SIZE, SOLID_TILES, POWER, PHYSICS, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } = global.MarioGame.CONSTANTS;

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  class WorldState {
    constructor(stage, audio, particles, callbacks) {
      this.stage = stage;
      this.audio = audio;
      this.particles = particles;
      this.callbacks = callbacks || {};

      this.areaStates = {};
      this.currentAreaName = 'main';
      this.onOffState = true; // true = Red solid, false = Blue solid
      this.pSwitchTimer = 0;

      this.checkpointReached = false;
      this.collectedStarCoins = new Set();

      this.cameraX = 0;
      this.cameraY = 0;
      this.shakeTimer = 0;
      this.shakeIntensity = 0;
      this.hitStop = 0;
      this.timeLeft = stage.timeLimit || 320;
      this.hurryPlayed = false;
      this.animTime = 0;

      this.goalTriggered = false;
      this.goalTimer = 0;
      this.flagY = 0;
      this.fireworksLeft = 0;
      this.fireworkTimer = 0;
      this.bowserDefeated = false;
      this.bridgeCollapse = null;

      this.iris = { active: false, radius: 320, target: 320, cx: 240, cy: 136, onDone: null };

      this.initArea('main');
      this.loadArea('main');

      const sp = this.area.spawn;
      this.player = new Mario(sp.tx * TILE_SIZE + 2, sp.ty * TILE_SIZE);
    }

    initArea(areaName) {
      if (this.areaStates[areaName]) return this.areaStates[areaName];
      const def = this.stage.areas[areaName];
      const grid = def.grid.map((row) => new Uint8Array(row));
      const blockContents = {};
      for (const [k, v] of Object.entries(def.blockContents || {})) {
        blockContents[k] = Object.assign({}, v);
      }

      const enemies = (def.enemies || []).map((e) => new Enemy(e));
      const thwomps = (def.thwomps || []).map((t) => new Thwomp(t.tx, t.ty));
      const firebars = (def.firebars || []).map((f) => ({
        cx: f.tx * TILE_SIZE + 8,
        cy: f.ty * TILE_SIZE + 8,
        len: f.len,
        speed: f.speed,
        angle: f.angle || 0,
      }));
      const blasters = (def.blasters || []).map((b) => ({
        tx: b.tx,
        ty: b.ty,
        x: b.tx * TILE_SIZE,
        y: b.ty * TILE_SIZE,
        timer: 1.4,
      }));
      const springs = (def.springs || []).map((s) => ({
        tx: s.tx,
        ty: s.ty,
        x: s.tx * TILE_SIZE,
        y: s.ty * TILE_SIZE,
        w: 16,
        h: 16,
        animTimer: 0,
      }));
      const pswitchObjs = (def.pswitch || []).map((p) => ({
        tx: p.tx,
        ty: p.ty,
        x: p.tx * TILE_SIZE,
        y: p.ty * TILE_SIZE,
        w: 16,
        h: 16,
        pressed: false,
      }));
      const platforms = (def.platforms || []).map((p) => ({
        startX: p.x,
        startY: p.y,
        x: p.x,
        y: p.y,
        prevX: p.x,
        prevY: p.y,
        w: p.w || 48,
        h: 8,
        dx: p.dx || 0,
        dy: p.dy || 0,
        speed: p.speed || 44,
        phase: 0,
      }));
      const starCoins = (def.starCoins || []).map((sc) => ({
        id: sc.id,
        x: sc.tx * TILE_SIZE,
        y: sc.ty * TILE_SIZE,
        w: 16,
        h: 16,
        collected: this.collectedStarCoins.has(sc.id),
      }));

      const bowser = def.bowser ? new Bowser(def.bowser.tx * TILE_SIZE, def.bowser.ty * TILE_SIZE) : null;

      const state = {
        def,
        grid,
        blockContents,
        blockBumps: {},
        donuts: {},
        items: [],
        enemies,
        thwomps,
        firebars,
        blasters,
        springs,
        pswitchObjs,
        platforms,
        starCoins,
        bowser,
        fireballs: [],
        enemyFireballs: [],
        hammers: [],
      };
      this.areaStates[areaName] = state;
      return state;
    }

    loadArea(areaName) {
      this.currentAreaName = areaName;
      this.areaState = this.initArea(areaName);
      this.area = this.areaState.def;
      this.grid = this.areaState.grid;
      if (this.area.goal && this.area.goal.type === 'flagpole') {
        this.flagY = (this.area.goal.ty - 9) * TILE_SIZE + 8;
      }
      this.particles.clear();
    }

    respawnAtCheckpoint() {
      // Rebuild main area cleanly while keeping starCoins already saved? Actually keep checkpoint + starCoins!
      delete this.areaStates.main;
      delete this.areaStates.bonus;
      this.onOffState = true;
      this.pSwitchTimer = 0;
      this.loadArea('main');
      const cp = this.checkpointReached && this.area.checkpoint ? this.area.checkpoint : this.area.spawn;
      this.player.resetForRespawn(cp.tx * TILE_SIZE + 2, (cp.ty - 1) * TILE_SIZE);
      this.cameraX = Math.max(0, Math.min(this.area.width * TILE_SIZE - VIRTUAL_WIDTH, this.player.x - VIRTUAL_WIDTH * 0.35));
    }

    shake(intensity, dur) {
      if (this.callbacks.canShake && !this.callbacks.canShake()) return;
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
      this.shakeTimer = Math.max(this.shakeTimer, dur);
    }

    getTile(tx, ty) {
      if (tx < 0 || tx >= this.area.width) return TILE.HARD;
      if (ty < 0) return TILE.EMPTY;
      if (ty >= this.area.height) return TILE.EMPTY;
      return this.grid[ty][tx];
    }

    setTile(tx, ty, val) {
      if (tx < 0 || tx >= this.area.width || ty < 0 || ty >= this.area.height) return;
      this.grid[ty][tx] = val;
    }

    isEffectiveCoin(t) {
      if (this.pSwitchTimer > 0) return t === TILE.BRICK;
      return t === TILE.COIN;
    }

    isSolidTileAt(tx, ty, prevBottom, entityVy, ignoreOneWay = false) {
      let t = this.getTile(tx, ty);
      if (this.pSwitchTimer > 0) {
        if (t === TILE.COIN) t = TILE.BRICK;
        else if (t === TILE.BRICK) t = TILE.EMPTY;
      }
      if (t === TILE.RED_BLOCK) return this.onOffState;
      if (t === TILE.BLUE_BLOCK) return !this.onOffState;
      if (t === TILE.ONEWAY) {
        if (ignoreOneWay) return false;
        return entityVy >= 0 && prevBottom <= ty * TILE_SIZE + 3;
      }
      if (t === TILE.DONUT) {
        const key = `${tx},${ty}`;
        const d = this.areaState.donuts[key];
        if (d && d.fallen) return false;
        return entityVy >= 0 && prevBottom <= ty * TILE_SIZE + 4;
      }
      return SOLID_TILES.has(t);
    }

    bumpBlock(tx, ty, strong, fromAbove = false) {
      const t = this.getTile(tx, ty);
      const key = `${tx},${ty}`;
      if (t === TILE.EMPTY || t === TILE.USED || t === TILE.HARD || t === TILE.GROUND || t === TILE.GROUND_DEEP) {
        if (t !== TILE.EMPTY && !fromAbove) this.audio.brickBump();
        return;
      }

      if (t === TILE.ON_OFF_SWITCH) {
        this.onOffState = !this.onOffState;
        this.areaState.blockBumps[key] = { timer: 0.16, dir: fromAbove ? 1 : -1 };
        this.audio.switchToggle();
        this.shake(2, 0.12);
        return;
      }

      if (t === TILE.POW_BLOCK) {
        this.setTile(tx, ty, TILE.EMPTY);
        this.particles.brickDebris(tx * TILE_SIZE, ty * TILE_SIZE, '#2870e8');
        this.audio.groundPound();
        this.shake(5, 0.35);
        this.hitStop = 0.05;
        // Hit all on-screen grounded enemies & Bowser
        for (const e of this.areaState.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - this.player.x) < 280) {
            e.flipKill(this, 0);
          }
        }
        if (this.areaState.bowser && !this.areaState.bowser.dead) {
          this.areaState.bowser.damage(this, 3);
        }
        return;
      }

      // Blocks with contents
      const content = this.areaState.blockContents[key];
      if (t === TILE.QUESTION || t === TILE.HIDDEN || (t === TILE.BRICK && content)) {
        this.areaState.blockBumps[key] = { timer: 0.18, dir: fromAbove ? 1 : -1 };
        const spawnKind = content ? content.kind : 'coin';

        if (spawnKind === 'multi_coin') {
          content.count = (content.count || 6) - 1;
          this.collectCoin(tx * TILE_SIZE + 8, ty * TILE_SIZE - 8);
          if (content.count <= 0) {
            this.setTile(tx, ty, TILE.USED);
            delete this.areaState.blockContents[key];
          }
        } else {
          this.setTile(tx, ty, TILE.USED);
          delete this.areaState.blockContents[key];
          if (spawnKind === 'coin') {
            this.collectCoin(tx * TILE_SIZE + 8, ty * TILE_SIZE - 8);
          } else {
            // Smart powerup: if small and block is 'powerup', spawn mushroom; dedicated fire/acorn spawns directly so player enjoys them!
            this.areaState.items.push(new PowerUpItem(spawnKind, tx * TILE_SIZE, ty * TILE_SIZE));
            this.audio.powerupAppear();
          }
        }
        this.bumpEnemiesAbove(tx, ty);
        return;
      }

      // Plain brick
      if (t === TILE.BRICK) {
        this.bumpEnemiesAbove(tx, ty);
        if (strong) {
          this.setTile(tx, ty, TILE.EMPTY);
          const col = this.area.biome === 'cavern' ? '#3a5488' : this.area.biome === 'sky' ? '#e0a038' : '#c85828';
          this.particles.brickDebris(tx * TILE_SIZE, ty * TILE_SIZE, col);
          this.audio.brickBreak();
          this.callbacks.addScore && this.callbacks.addScore(50);
        } else {
          this.areaState.blockBumps[key] = { timer: 0.16, dir: -1 };
          this.audio.brickBump();
        }
      }
    }

    bumpEnemiesAbove(tx, ty) {
      const box = { x: tx * TILE_SIZE, y: (ty - 1) * TILE_SIZE, w: 16, h: 16 };
      for (const e of this.areaState.enemies) {
        if (!e.dead && aabb(box, e)) {
          e.flipKill(this, e.x > this.player.x ? 1 : -1);
        }
      }
    }

    collectCoin(px, py) {
      this.audio.coin();
      this.particles.coinSparkle(px, py, false);
      this.particles.spawnPopup(px, py - 6, '+100', '#ffd838');
      this.callbacks.addCoin && this.callbacks.addCoin(1);
      this.callbacks.addScore && this.callbacks.addScore(100);
    }

    startIrisWipe(cx, cy, onMidpoint) {
      this.iris = {
        active: true,
        phase: 'closing',
        radius: 300,
        cx,
        cy,
        onMidpoint,
      };
    }

    update(dt, input) {
      this.animTime += dt;

      if (this.iris.active) {
        if (this.iris.phase === 'closing') {
          this.iris.radius -= 750 * dt;
          if (this.iris.radius <= 0) {
            this.iris.radius = 0;
            if (this.iris.onMidpoint) this.iris.onMidpoint();
            this.iris.phase = 'opening';
          }
        } else {
          this.iris.radius += 750 * dt;
          if (this.iris.radius >= 320) {
            this.iris.active = false;
          }
        }
        return;
      }

      if (this.hitStop > 0) {
        this.hitStop -= dt;
        return;
      }

      if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        if (this.shakeTimer <= 0) this.shakeIntensity = 0;
      }

      // Countdown timer while playing normally
      if (!this.goalTriggered && this.player.state === 'normal') {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (this.timeLeft < 100 && !this.hurryPlayed) {
          this.hurryPlayed = true;
        }
        if (this.timeLeft <= 0) {
          this.player.die(this, true);
        }
      }

      if (this.pSwitchTimer > 0) {
        this.pSwitchTimer = Math.max(0, this.pSwitchTimer - dt);
      }

      // Block bump animations
      for (const [k, b] of Object.entries(this.areaState.blockBumps)) {
        b.timer -= dt;
        if (b.timer <= 0) delete this.areaState.blockBumps[k];
      }

      // Donut blocks
      for (const [k, d] of Object.entries(this.areaState.donuts)) {
        if (!d.fallen) {
          d.timer -= dt;
          if (d.timer <= 0) {
            d.fallen = true;
            d.fallY = 0;
            d.respawn = 4.0;
          }
        } else {
          d.fallY += 180 * dt;
          d.respawn -= dt;
          if (d.respawn <= 0) delete this.areaState.donuts[k];
        }
      }

      // Moving platforms
      for (const plat of this.areaState.platforms) {
        plat.prevX = plat.x;
        plat.prevY = plat.y;
        const dist = Math.hypot(plat.dx, plat.dy) || 1;
        plat.phase += (plat.speed / dist) * dt;
        const t = 0.5 - 0.5 * Math.cos(plat.phase * Math.PI);
        plat.x = plat.startX + plat.dx * t;
        plat.y = plat.startY + plat.dy * t;
      }

      // Springs
      for (const sp of this.areaState.springs) {
        if (sp.animTimer > 0) sp.animTimer -= dt;
      }

      // Firebars
      for (const fb of this.areaState.firebars) {
        fb.angle += fb.speed * dt;
      }

      // Blasters
      for (const bl of this.areaState.blasters) {
        bl.timer -= dt;
        const distToPlayer = Math.abs(bl.x - this.player.x);
        if (bl.timer <= 0 && distToPlayer > 28 && distToPlayer < 340) {
          bl.timer = 2.7;
          const dir = this.player.x < bl.x ? -1 : 1;
          this.areaState.enemies.push(new Enemy({
            type: 'bullet',
            x: bl.x + (dir > 0 ? 14 : -14),
            y: bl.y + 1,
            dir,
          }));
          this.particles.dust(bl.x + 8 + dir * 8, bl.y + 8, -dir);
        }
      }

      // Player
      this.player.update(dt, this, input);

      // Items
      for (let i = this.areaState.items.length - 1; i >= 0; i--) {
        const it = this.areaState.items[i];
        it.update(dt, this);
        if (it.collected) {
          this.areaState.items.splice(i, 1);
        }
      }

      // Star Coins
      for (const sc of this.areaState.starCoins) {
        if (!sc.collected && aabb(this.player, sc)) {
          sc.collected = true;
          this.collectedStarCoins.add(sc.id);
          this.audio.starCoin();
          this.particles.coinSparkle(sc.x + 8, sc.y + 8, true);
          this.particles.spawnPopup(sc.x + 8, sc.y - 6, 'STAR COIN!', '#ffd838');
          this.callbacks.addScore && this.callbacks.addScore(1000);
        }
      }

      // Player fireballs
      for (let i = this.areaState.fireballs.length - 1; i >= 0; i--) {
        const fb = this.areaState.fireballs[i];
        fb.update(dt, this);
        if (fb.dead) this.areaState.fireballs.splice(i, 1);
      }

      // Enemies
      for (let i = this.areaState.enemies.length - 1; i >= 0; i--) {
        const en = this.areaState.enemies[i];
        en.update(dt, this);
        if (en.remove) this.areaState.enemies.splice(i, 1);
      }

      // Thwomps
      for (const th of this.areaState.thwomps) {
        th.update(dt, this);
      }

      // Bowser & Boss projectiles
      if (this.areaState.bowser && !this.areaState.bowser.removed) {
        this.areaState.bowser.update(dt, this);
      }
      for (let i = this.areaState.enemyFireballs.length - 1; i >= 0; i--) {
        const ef = this.areaState.enemyFireballs[i];
        ef.x += ef.vx * dt;
        ef.y += ef.vy * dt;
        ef.life -= dt;
        if (ef.life <= 0) {
          this.areaState.enemyFireballs.splice(i, 1);
          continue;
        }
        if (aabb(this.player, ef)) {
          if (this.player.tailSpinTimer > 0) {
            ef.vx = -ef.vx;
            ef.life = 1.0;
          } else if (this.player.starTimer <= 0) {
            this.player.hurt(this);
          }
        }
      }
      for (let i = this.areaState.hammers.length - 1; i >= 0; i--) {
        const hm = this.areaState.hammers[i];
        hm.vy += 480 * dt;
        hm.x += hm.vx * dt;
        hm.y += hm.vy * dt;
        hm.life -= dt;
        if (hm.life <= 0 || hm.y > VIRTUAL_HEIGHT + 32) {
          this.areaState.hammers.splice(i, 1);
          continue;
        }
        if (aabb(this.player, hm)) {
          if (this.player.tailSpinTimer > 0) {
            hm.vx = -hm.vx;
            hm.vy = -180;
          } else if (this.player.starTimer <= 0) {
            this.player.hurt(this);
          }
        }
      }

      // Bridge collapse sequence (1-4 Axe)
      if (this.bridgeCollapse) {
        this.bridgeCollapse.timer -= dt;
        if (this.bridgeCollapse.timer <= 0) {
          this.bridgeCollapse.timer = 0.045;
          const btx = this.bridgeCollapse.tx;
          if (btx <= this.bridgeCollapse.endTx) {
            this.setTile(btx, this.bridgeCollapse.ty, TILE.EMPTY);
            this.particles.brickDebris(btx * TILE_SIZE, this.bridgeCollapse.ty * TILE_SIZE, '#a05a28');
            this.audio.brickBreak();
            this.bridgeCollapse.tx++;
          } else {
            this.bridgeCollapse = null;
            if (this.areaState.bowser && !this.areaState.bowser.dead) {
              this.areaState.bowser.fallIntoLava(this);
            }
          }
        }
      }

      // Goal flagpole / victory fireworks
      this.updateGoal(dt);

      // Camera smooth tracking
      const maxCam = Math.max(0, this.area.width * TILE_SIZE - VIRTUAL_WIDTH);
      const targetCam = Math.max(0, Math.min(maxCam, this.player.x - VIRTUAL_WIDTH * 0.36));
      this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 10);

      this.particles.update(dt);
    }

    updateGoal(dt) {
      if (!this.goalTriggered) {
        const goal = this.area.goal;
        if (!goal) return;
        if (goal.type === 'flagpole') {
          const poleX = goal.tx * TILE_SIZE + 6;
          if ((Math.abs(this.player.x + this.player.w / 2 - poleX) < 10 || this.player.x > poleX) && this.player.y + this.player.h <= goal.ty * TILE_SIZE + 24 && this.player.state === 'normal') {
            this.goalTriggered = true;
            this.goalTimer = 0;
            this.player.state = 'flagpole';
            this.player.vx = 0;
            this.player.vy = 0;
            this.player.x = poleX - 8;
            this.player.facing = 1;
            const grabRatio = Math.max(0, Math.min(1, (goal.ty * TILE_SIZE - this.player.y) / (8 * TILE_SIZE)));
            const bonus = Math.round((100 + grabRatio * 4900) / 100) * 100;
            this.callbacks.addScore && this.callbacks.addScore(bonus);
            this.particles.spawnPopup(this.player.x + 8, this.player.y - 8, `+${bonus}`, '#ffd838');
            this.audio.flagpole();
            this.fireworksLeft = Math.min(5, Math.floor(this.timeLeft % 6) + 2);
          }
        } else if (goal.type === 'bowser_arena') {
          const axeBox = { x: goal.axeTx * TILE_SIZE, y: goal.axeTy * TILE_SIZE, w: 16, h: 16 };
          if (aabb(this.player, axeBox) && this.player.state === 'normal') {
            this.goalTriggered = true;
            this.setTile(goal.axeTx, goal.axeTy, TILE.EMPTY);
            this.audio.switchToggle();
            this.shake(5, 0.4);
            this.bridgeCollapse = {
              tx: goal.bridgeTx,
              endTx: goal.bridgeTx + goal.bridgeLen - 1,
              ty: goal.bridgeTy,
              timer: 0.04,
            };
            this.player.state = 'wait_bridge';
            this.player.vx = 0;
            this.player.vy = 0;
          }
        }
        return;
      }

      const goal = this.area.goal;
      if (goal.type === 'flagpole') {
        if (this.player.state === 'flagpole') {
          const baseBottom = goal.ty * TILE_SIZE + 16;
          this.flagY = Math.min(baseBottom - 16, this.flagY + 130 * dt);
          this.player.y = Math.min(baseBottom - this.player.h, this.player.y + 130 * dt);
          if (this.player.y >= baseBottom - this.player.h && this.flagY >= baseBottom - 16) {
            this.player.state = 'walk_castle';
            this.goalTimer = 0;
            this.audio.playFanfare('clear');
          }
        } else if (this.player.state === 'walk_castle') {
          const doorX = (goal.castleTx + 2) * TILE_SIZE;
          this.player.vx = 80;
          this.player.vy = Math.min(340, this.player.vy + 900 * dt);
          this.player.facing = 1;
          this.player.applyPhysics(dt, this);
          if (this.player.x >= doorX) {
            this.player.hidden = true;
            this.player.state = 'castle_done';
            this.goalTimer = 0;
            this.fireworkTimer = 0.2;
          }
        } else if (this.player.state === 'castle_done') {
          if (this.fireworksLeft > 0) {
            this.fireworkTimer -= dt;
            if (this.fireworkTimer <= 0) {
              this.fireworkTimer = 0.4;
              this.fireworksLeft--;
              const fx = (goal.castleTx - 1 + Math.random() * 6) * TILE_SIZE;
              const fy = (3 + Math.random() * 4) * TILE_SIZE;
              this.particles.firework(fx, fy);
              this.audio.firework();
              this.callbacks.addScore && this.callbacks.addScore(500);
            }
          } else {
            this.goalTimer += dt;
            if (this.goalTimer > 1.1) {
              this.callbacks.onStageClear && this.callbacks.onStageClear();
            }
          }
        }
      } else if (goal.type === 'bowser_arena') {
        if (this.player.state === 'wait_bridge') {
          if (!this.bridgeCollapse && (!this.areaState.bowser || this.areaState.bowser.dead)) {
            this.player.state = 'walk_peach';
            this.audio.playFanfare('victory');
          }
        } else if (this.player.state === 'walk_peach') {
          const targetX = goal.peachTx * TILE_SIZE - 18;
          this.player.vx = 76;
          this.player.vy = Math.min(340, this.player.vy + 900 * dt);
          this.player.facing = 1;
          this.player.applyPhysics(dt, this);
          if (this.player.x >= targetX) {
            this.player.vx = 0;
            this.player.state = 'peach_done';
            this.goalTimer = 0;
            this.particles.spawnPopup(goal.peachTx * TILE_SIZE + 8, goal.peachTy * TILE_SIZE - 14, 'THANK YOU MARIO!', '#ff90c0');
          }
        } else if (this.player.state === 'peach_done') {
          this.goalTimer += dt;
          if (Math.random() < dt * 3) {
            this.particles.firework(this.cameraX + 80 + Math.random() * 320, 40 + Math.random() * 70);
          }
          if (this.goalTimer > 1.4) {
            this.callbacks.onStageClear && this.callbacks.onStageClear(true);
          }
        }
      }
    }
  }

  // ---- MARIO PLAYER ----
  class Mario {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.w = 12;
      this.h = 15;
      this.facing = 1;
      this.power = POWER.SMALL;
      this.reserveItem = null;

      this.onGround = false;
      this.onIce = false;
      this.crouching = false;
      this.skidding = false;
      this.hidden = false;
      this.state = 'normal'; // normal | dying | pipe | flagpole | walk_castle | castle_done | wait_bridge | walk_peach | peach_done

      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.wallDir = 0;
      this.wallCoyoteTimer = 0;
      this.invulnTimer = 0;
      this.starTimer = 0;
      this.stompCombo = 0;

      this.groundPound = false;
      this.gpFreezeTimer = 0;
      this.acornBoostUsed = false;
      this.isGliding = false;
      this.tailSpinTimer = 0;
      this.fireCooldown = 0;

      this.walkFrame = 0;
      this.deathTimer = 0;
      this.pipeAnim = null;
      this.ridingPlatform = null;
    }

    resetForRespawn(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.setPower(POWER.SMALL, true);
      this.state = 'normal';
      this.hidden = false;
      this.invulnTimer = 1.5;
      this.starTimer = 0;
      this.groundPound = false;
      this.tailSpinTimer = 0;
    }

    setPower(newPower, silent = false) {
      const oldBottom = this.y + this.h;
      this.power = newPower;
      this.h = newPower === POWER.SMALL ? 15 : 22;
      this.y = oldBottom - this.h;
      if (!silent) this.invulnTimer = Math.max(this.invulnTimer, 0.25);
    }

    givePowerUp(kind, world) {
      if (kind === '1up') {
        world.audio.oneUp();
        world.particles.spawnPopup(this.x + 6, this.y - 8, '1-UP!', '#50ff68');
        world.callbacks.addLife && world.callbacks.addLife(1);
        return;
      }
      if (kind === 'star') {
        this.starTimer = PHYSICS.STAR_TIME;
        world.audio.powerup();
        world.particles.spawnPopup(this.x + 6, this.y - 8, 'STAR!', '#ffd838');
        return;
      }

      const targetPower = kind === 'mushroom' ? POWER.SUPER : kind === 'fire' ? POWER.FIRE : POWER.ACORN;
      world.audio.powerup();
      world.callbacks.addScore && world.callbacks.addScore(1000);

      if (this.power === targetPower) {
        if (kind !== 'mushroom' || !this.reserveItem) this.reserveItem = kind;
        world.particles.spawnPopup(this.x + 6, this.y - 8, 'STORED!', '#80e0ff');
        return;
      }

      // Store useful previous powerup in reserve box
      if (this.power === POWER.FIRE && targetPower !== POWER.SUPER) this.reserveItem = 'fire';
      else if (this.power === POWER.ACORN && targetPower !== POWER.SUPER) this.reserveItem = 'acorn';
      else if (this.power === POWER.SUPER && targetPower !== POWER.SUPER) this.reserveItem = 'mushroom';

      // Don't downgrade Fire/Acorn when picking up a red Mushroom
      if ((this.power === POWER.FIRE || this.power === POWER.ACORN) && targetPower === POWER.SUPER) {
        this.reserveItem = 'mushroom';
        world.particles.spawnPopup(this.x + 6, this.y - 8, 'RESERVE!', '#80e0ff');
        return;
      }

      this.setPower(targetPower);
      const labels = { super: 'SUPER!', fire: 'FIRE MARIO!', acorn: 'ACORN SUIT!' };
      world.particles.spawnPopup(this.x + 6, this.y - 10, labels[targetPower], '#ffd838');
    }

    dropReserve(world) {
      if (!this.reserveItem || this.state !== 'normal') return false;
      const kind = this.reserveItem;
      this.reserveItem = null;
      world.audio.powerupAppear();
      world.areaState.items.push(new PowerUpItem(kind, this.x - 2, Math.max(16, this.y - 44), true));
      return true;
    }

    hurt(world) {
      if (this.invulnTimer > 0 || this.starTimer > 0 || this.state !== 'normal') return;
      if (this.power === POWER.FIRE || this.power === POWER.ACORN) {
        this.setPower(POWER.SUPER);
        this.invulnTimer = PHYSICS.INVULN_TIME;
        world.audio.hurt();
        world.shake(4, 0.2);
        world.hitStop = 0.06;
      } else if (this.power === POWER.SUPER) {
        this.setPower(POWER.SMALL);
        this.invulnTimer = PHYSICS.INVULN_TIME;
        world.audio.hurt();
        world.shake(4, 0.2);
        world.hitStop = 0.06;
      } else {
        this.die(world);
      }
    }

    die(world, immediateVoid = false) {
      if (this.state === 'dying') return;
      this.state = 'dying';
      this.vx = 0;
      this.vy = immediateVoid ? -260 : -295;
      this.deathTimer = 0;
      this.groundPound = false;
      world.audio.hurt();
      world.audio.currentTrack = null;
      world.shake(5, 0.25);
    }

    update(dt, world, input) {
      if (this.invulnTimer > 0) this.invulnTimer -= dt;
      if (this.starTimer > 0) this.starTimer -= dt;
      if (this.fireCooldown > 0) this.fireCooldown -= dt;
      if (this.tailSpinTimer > 0) this.tailSpinTimer -= dt;

      if (this.state === 'dying') {
        this.deathTimer += dt;
        if (this.deathTimer > 0.25) {
          this.vy += 980 * dt;
          this.y += this.vy * dt;
        }
        if (this.deathTimer > 1.85) {
          world.callbacks.onPlayerDied && world.callbacks.onPlayerDied();
        }
        return;
      }

      if (this.state === 'pipe') {
        this.pipeAnim.timer -= dt;
        this.y += this.pipeAnim.vy * dt;
        if (this.pipeAnim.timer <= 0) {
          if (this.pipeAnim.onComplete) this.pipeAnim.onComplete();
        }
        return;
      }

      if (this.state !== 'normal') return;

      // Reserve item drop
      if (input.reserveJustPressed) {
        this.dropReserve(world);
      }

      // Check Checkpoint Flag
      if (!world.checkpointReached && world.area.checkpoint) {
        const cp = world.area.checkpoint;
        const cpBox = { x: cp.tx * TILE_SIZE - 4, y: (cp.ty - 2) * TILE_SIZE, w: 24, h: 48 };
        if (aabb(this, cpBox)) {
          world.checkpointReached = true;
          world.audio.oneUp();
          world.particles.spawnPopup(cp.tx * TILE_SIZE + 8, (cp.ty - 2) * TILE_SIZE, 'CHECKPOINT!', '#78ff78');
          if (this.power === POWER.SMALL) this.setPower(POWER.SUPER);
        }
      }

      // Check Pipe Entry (standing on pipe top & pressing down)
      if (this.onGround && input.down && world.area.pipes) {
        for (const p of world.area.pipes) {
          if (p.dir === 'down' && p.targetArea) {
            const pipeCenter = (p.tx + 1) * TILE_SIZE;
            if (Math.abs(this.x + this.w / 2 - pipeCenter) < 12 && Math.abs(this.y + this.h - p.ty * TILE_SIZE) < 5) {
              this.enterPipe(world, p);
              return;
            }
          }
        }
      }

      // Ground Pound trigger
      if (!this.onGround && !this.groundPound && input.downJustPressed && this.vy > -180) {
        this.groundPound = true;
        this.gpFreezeTimer = 0.12;
        this.vx = 0;
        this.vy = 0;
        this.isGliding = false;
      }

      if (this.groundPound) {
        if (this.gpFreezeTimer > 0) {
          this.gpFreezeTimer -= dt;
        } else {
          this.vy = PHYSICS.GROUND_POUND_VY;
          this.applyPhysics(dt, world);
          if (this.onGround) {
            this.onGroundPoundLand(world);
          }
        }
        this.checkHazardsAndCollectibles(world);
        return;
      }

      // Crouch (only when on ground and big)
      const wantCrouch = this.onGround && input.down && this.power !== POWER.SMALL;
      if (wantCrouch !== this.crouching) {
        const bottom = this.y + this.h;
        this.crouching = wantCrouch;
        if (this.power !== POWER.SMALL) {
          this.h = this.crouching ? 14 : 22;
          this.y = bottom - this.h;
        }
      }

      // Horizontal Movement
      const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const running = input.run;
      const starMult = this.starTimer > 0 ? PHYSICS.STAR_MULT : 1;
      const maxSpd = (running ? PHYSICS.RUN_SPEED : PHYSICS.WALK_SPEED) * starMult;
      this.skidding = false;

      if (moveDir !== 0 && !this.crouching) {
        this.facing = moveDir;
        if (this.onGround && this.vx !== 0 && Math.sign(this.vx) !== moveDir) {
          if (Math.abs(this.vx) > 85) {
            this.skidding = true;
            if (Math.random() < dt * 22) world.particles.dust(this.x + this.w / 2, this.y + this.h, -moveDir);
          }
          this.vx += moveDir * PHYSICS.SKID_DECEL * dt;
        } else {
          const accel = this.onGround ? (running ? PHYSICS.ACCEL_RUN : PHYSICS.ACCEL_GROUND) : PHYSICS.ACCEL_AIR;
          this.vx += moveDir * accel * dt;
          if (Math.abs(this.vx) > maxSpd) {
            this.vx = Math.sign(this.vx) * Math.max(maxSpd, Math.abs(this.vx) - 400 * dt);
          }
        }
      } else {
        const decel = this.onGround ? (this.onIce ? PHYSICS.FRICTION_ICE : PHYSICS.FRICTION_GROUND) : PHYSICS.FRICTION_AIR;
        if (Math.abs(this.vx) <= decel * dt) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * decel * dt;
      }

      // Run dust
      if (this.onGround && Math.abs(this.vx) > 130 && Math.random() < dt * 14) {
        world.particles.dust(this.x + this.w / 2, this.y + this.h, this.facing);
      }

      // Attack (Fireball or Acorn Tail Spin)
      if (input.runJustPressed && !this.crouching) {
        if (this.power === POWER.FIRE && this.fireCooldown <= 0 && world.areaState.fireballs.length < 2) {
          this.fireCooldown = 0.18;
          world.areaState.fireballs.push(new Fireball(this.x + (this.facing > 0 ? this.w : -6), this.y + 8, this.facing));
          world.audio.fireball();
        } else if (this.power === POWER.ACORN && this.tailSpinTimer <= 0) {
          this.tailSpinTimer = 0.25;
          world.audio.tailSpin();
          world.particles.leafBurst(this.x + this.w / 2, this.y + this.h / 2);
          this.performTailSpinHits(world);
        }
      }

      if (this.tailSpinTimer > 0) {
        this.performTailSpinHits(world);
      }

      // Timers for Coyote & Jump Buffer
      if (this.onGround) {
        this.coyoteTimer = PHYSICS.COYOTE_TIME;
        this.acornBoostUsed = false;
        this.stompCombo = 0;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (input.jumpJustPressed) {
        this.jumpBufferTimer = PHYSICS.JUMP_BUFFER;
      } else {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      }

      if (this.wallDir !== 0 && !this.onGround && this.vy > 0) {
        this.wallCoyoteTimer = PHYSICS.WALL_COYOTE_TIME;
      } else {
        this.wallCoyoteTimer = Math.max(0, this.wallCoyoteTimer - dt);
      }

      // Jump Execution (Ground/Coyote, Wall Jump, or Acorn Mid-Air Boost!)
      if (this.jumpBufferTimer > 0) {
        if (this.coyoteTimer > 0) {
          const speedRatio = Math.min(1, Math.abs(this.vx) / PHYSICS.RUN_SPEED);
          this.vy = PHYSICS.JUMP_VY + (PHYSICS.RUN_JUMP_VY - PHYSICS.JUMP_VY) * speedRatio;
          this.onGround = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          this.ridingPlatform = null;
          world.audio.jump(this.power !== POWER.SMALL);
        } else if (this.wallCoyoteTimer > 0 && this.wallDir !== 0) {
          this.vx = -this.wallDir * PHYSICS.WALL_JUMP_VX;
          this.vy = PHYSICS.WALL_JUMP_VY;
          this.facing = -this.wallDir;
          this.wallCoyoteTimer = 0;
          this.jumpBufferTimer = 0;
          world.particles.dust(this.x + (this.wallDir > 0 ? this.w : 0), this.y + this.h * 0.6, -this.wallDir);
          world.audio.jump(this.power !== POWER.SMALL);
        } else if (this.power === POWER.ACORN && !this.acornBoostUsed) {
          this.acornBoostUsed = true;
          this.vy = PHYSICS.ACORN_BOOST_VY;
          this.jumpBufferTimer = 0;
          world.particles.leafBurst(this.x + this.w / 2, this.y + this.h);
          world.audio.tailSpin();
        }
      }

      // Gravity + Variable Jump + Wall Slide + Acorn Glide
      let grav = PHYSICS.GRAVITY_FALL;
      if (this.vy < 0) {
        grav = input.jump ? PHYSICS.GRAVITY_HOLD : PHYSICS.GRAVITY_CUT;
      }
      this.vy += grav * dt;

      this.isGliding = false;
      if (this.power === POWER.ACORN && !this.onGround && this.vy > 0 && input.jump) {
        this.vy = Math.min(this.vy, PHYSICS.ACORN_GLIDE_FALL);
        this.isGliding = true;
      } else if (this.wallDir !== 0 && !this.onGround && this.vy > 0 && moveDir === this.wallDir) {
        this.vy = Math.min(this.vy, PHYSICS.WALL_SLIDE_MAX);
        if (Math.random() < dt * 16) {
          world.particles.dust(this.x + (this.wallDir > 0 ? this.w : 0), this.y + this.h * 0.5, -this.wallDir);
        }
      } else {
        this.vy = Math.min(this.vy, PHYSICS.MAX_FALL);
      }

      // Ride moving platform delta before stepping
      if (this.ridingPlatform) {
        this.x += this.ridingPlatform.x - this.ridingPlatform.prevX;
        this.y += this.ridingPlatform.y - this.ridingPlatform.prevY;
      }

      this.applyPhysics(dt, world, moveDir);

      // Walk animation clock
      if (this.onGround && Math.abs(this.vx) > 8) {
        this.walkFrame += (Math.abs(this.vx) / 36) * dt * 2.2;
      } else {
        this.walkFrame = 0;
      }

      // Check springs, p-switches, coins, hazards
      this.checkHazardsAndCollectibles(world, input);

      // Pit death
      if (this.y > world.area.height * TILE_SIZE + 16) {
        this.die(world, true);
      }
    }

    enterPipe(world, pipe) {
      this.state = 'pipe';
      this.vx = 0;
      this.vy = 0;
      this.pipeAnim = {
        timer: 0.36,
        vy: 42,
        onComplete: () => {
          const cx = Math.max(20, Math.min(VIRTUAL_WIDTH - 20, this.x - world.cameraX + 6));
          const cy = Math.max(20, Math.min(VIRTUAL_HEIGHT - 20, this.y - world.cameraY + 8));
          world.startIrisWipe(cx, cy, () => {
            world.loadArea(pipe.targetArea);
            this.x = pipe.targetTx * TILE_SIZE + 2;
            this.y = pipe.targetTy * TILE_SIZE;
            this.vx = 0;
            this.vy = 0;
            this.state = 'normal';
            world.cameraX = Math.max(0, Math.min(world.area.width * TILE_SIZE - VIRTUAL_WIDTH, this.x - VIRTUAL_WIDTH * 0.35));
          });
        },
      };
      world.audio.pipe();
    }

    onGroundPoundLand(world) {
      this.groundPound = false;
      world.audio.groundPound();
      world.shake(4, 0.22);
      world.particles.shockwave(this.x + this.w / 2, this.y + this.h);

      const leftTx = Math.floor((this.x + 1) / TILE_SIZE);
      const rightTx = Math.floor((this.x + this.w - 1) / TILE_SIZE);
      const footTy = Math.floor((this.y + this.h + 2) / TILE_SIZE);
      for (let tx = leftTx; tx <= rightTx; tx++) {
        const t = world.getTile(tx, footTy);
        if (t === TILE.BRICK || t === TILE.QUESTION || t === TILE.ON_OFF_SWITCH || t === TILE.POW_BLOCK) {
          world.bumpBlock(tx, footTy, true, true);
        }
      }
      // Also press nearby P-switch
      for (const ps of world.areaState.pswitchObjs) {
        if (!ps.pressed && aabb({ x: this.x - 4, y: this.y, w: this.w + 8, h: this.h + 4 }, ps)) {
          this.pressPSwitch(world, ps);
        }
      }
    }

    performTailSpinHits(world) {
      const box = { x: this.x - 10, y: this.y - 2, w: this.w + 20, h: this.h + 4 };
      for (const e of world.areaState.enemies) {
        if (!e.dead && aabb(box, e)) {
          e.flipKill(world, e.x >= this.x ? 1 : -1);
        }
      }
      // Hit adjacent brick/switch blocks
      const minTx = Math.floor(box.x / TILE_SIZE);
      const maxTx = Math.floor((box.x + box.w) / TILE_SIZE);
      const midTy = Math.floor((this.y + this.h * 0.5) / TILE_SIZE);
      for (let tx = minTx; tx <= maxTx; tx++) {
        const t = world.getTile(tx, midTy);
        if (t === TILE.BRICK || t === TILE.QUESTION || t === TILE.ON_OFF_SWITCH) {
          world.bumpBlock(tx, midTy, true);
        }
      }
    }

    pressPSwitch(world, ps) {
      ps.pressed = true;
      world.pSwitchTimer = PHYSICS.PSWITCH_TIME;
      world.audio.switchToggle();
      world.shake(3, 0.18);
      world.particles.spawnPopup(ps.x + 8, ps.y - 6, 'P-SWITCH!', '#60c0ff');
    }

    applyPhysics(dt, world, moveDir = 0) {
      // Horizontal move
      this.x += this.vx * dt;
      if (this.x < 0) { this.x = 0; this.vx = 0; }
      const maxW = world.area.width * TILE_SIZE - this.w;
      if (this.x > maxW) { this.x = maxW; this.vx = 0; }

      this.wallDir = 0;
      const topTy = Math.floor((this.y + 2) / TILE_SIZE);
      const botTy = Math.floor((this.y + this.h - 2) / TILE_SIZE);
      if (this.vx > 0) {
        const rx = Math.floor((this.x + this.w) / TILE_SIZE);
        for (let ty = topTy; ty <= botTy; ty++) {
          if (world.isSolidTileAt(rx, ty, this.y + this.h, 0, true)) {
            this.x = rx * TILE_SIZE - this.w - 0.01;
            this.vx = 0;
            this.wallDir = 1;
            break;
          }
        }
      } else if (this.vx < 0) {
        const lx = Math.floor(this.x / TILE_SIZE);
        for (let ty = topTy; ty <= botTy; ty++) {
          if (world.isSolidTileAt(lx, ty, this.y + this.h, 0, true)) {
            this.x = (lx + 1) * TILE_SIZE + 0.01;
            this.vx = 0;
            this.wallDir = -1;
            break;
          }
        }
      } else if (moveDir !== 0 && !this.onGround) {
        // Detect wall push even when vx is 0
        const checkX = moveDir > 0 ? Math.floor((this.x + this.w + 1) / TILE_SIZE) : Math.floor((this.x - 1) / TILE_SIZE);
        const midTy = Math.floor((this.y + this.h * 0.5) / TILE_SIZE);
        if (world.isSolidTileAt(checkX, midTy, this.y + this.h, 0, true)) {
          this.wallDir = moveDir;
        }
      }

      // Vertical move
      const prevBottom = this.y + this.h;
      this.y += this.vy * dt;
      this.onGround = false;
      this.onIce = false;
      this.ridingPlatform = null;

      const leftTx = Math.floor((this.x + 1.5) / TILE_SIZE);
      const rightTx = Math.floor((this.x + this.w - 1.5) / TILE_SIZE);

      if (this.vy >= 0) {
        const fy = Math.floor((this.y + this.h) / TILE_SIZE);
        for (let tx = leftTx; tx <= rightTx; tx++) {
          if (world.isSolidTileAt(tx, fy, prevBottom, this.vy, false)) {
            const tileTop = fy * TILE_SIZE;
            const tileType = world.getTile(tx, fy);
            if (tileType === TILE.BOUNCE_CAP) {
              this.y = tileTop - this.h;
              this.vy = PHYSICS.BOUNCE_CAP_VY;
              this.onGround = false;
              world.audio.spring();
              world.particles.stompBurst(tx * TILE_SIZE + 8, tileTop, '#ff6878');
              return;
            }
            if (tileType === TILE.DONUT) {
              const dk = `${tx},${fy}`;
              if (!world.areaState.donuts[dk]) {
                world.areaState.donuts[dk] = { timer: 0.55, fallen: false, fallY: 0 };
              }
            }
            if (tileType === TILE.ICE) this.onIce = true;
            this.y = tileTop - this.h;
            this.vy = 0;
            this.onGround = true;
            break;
          }
        }

        // Moving Platforms collision
        if (!this.onGround) {
          for (const plat of world.areaState.platforms) {
            if (
              this.x + this.w > plat.x &&
              this.x < plat.x + plat.w &&
              prevBottom <= plat.prevY + 5 &&
              this.y + this.h >= plat.y
            ) {
              this.y = plat.y - this.h;
              this.vy = 0;
              this.onGround = true;
              this.ridingPlatform = plat;
              break;
            }
          }
        }
      } else {
        const hy = Math.floor(this.y / TILE_SIZE);
        let bumped = false;
        // Center tile priority for clean block hitting
        const centerTx = Math.floor((this.x + this.w * 0.5) / TILE_SIZE);
        const order = [centerTx];
        for (let tx = leftTx; tx <= rightTx; tx++) if (tx !== centerTx) order.push(tx);

        for (const tx of order) {
          if (world.isSolidTileAt(tx, hy, prevBottom, this.vy, true) || world.getTile(tx, hy) === TILE.HIDDEN) {
            this.y = (hy + 1) * TILE_SIZE;
            this.vy = 15;
            if (!bumped) {
              world.bumpBlock(tx, hy, this.power !== POWER.SMALL, false);
              bumped = true;
            }
            break;
          }
        }
      }
    }

    checkHazardsAndCollectibles(world, input = {}) {
      // Tile coins, spikes, lava
      const minTx = Math.floor(this.x / TILE_SIZE);
      const maxTx = Math.floor((this.x + this.w) / TILE_SIZE);
      const minTy = Math.floor(this.y / TILE_SIZE);
      const maxTy = Math.floor((this.y + this.h) / TILE_SIZE);

      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const t = world.getTile(tx, ty);
          if (world.isEffectiveCoin(t)) {
            world.setTile(tx, ty, TILE.EMPTY);
            world.collectCoin(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8);
          } else if (t === TILE.LAVA_TOP || t === TILE.LAVA_BODY) {
            world.particles.lavaSplash(this.x + 6, ty * TILE_SIZE);
            this.die(world, true);
            return;
          } else if (t === TILE.SPIKE) {
            this.hurt(world);
          }
        }
      }

      // Springs
      for (const sp of world.areaState.springs) {
        if (aabb(this, sp) && this.vy >= 0 && this.y + this.h <= sp.y + 14) {
          this.y = sp.y - this.h;
          this.vy = input.jump ? PHYSICS.SPRING_HIGH_VY : PHYSICS.SPRING_LOW_VY;
          sp.animTimer = 0.25;
          world.audio.spring();
          world.particles.stompBurst(sp.x + 8, sp.y, '#ffffff');
        }
      }

      // P-Switches
      for (const ps of world.areaState.pswitchObjs) {
        if (!ps.pressed && aabb(this, ps) && this.vy >= 0 && this.y + this.h <= ps.y + 12) {
          this.pressPSwitch(world, ps);
          this.vy = -120;
        }
      }

      // Firebars
      const pCx = this.x + this.w / 2;
      const pCy = this.y + this.h / 2;
      for (const fb of world.areaState.firebars) {
        for (let i = 1; i <= fb.len; i++) {
          const fx = fb.cx + Math.cos(fb.angle) * i * 10;
          const fy = fb.cy + Math.sin(fb.angle) * i * 10;
          if (Math.hypot(pCx - fx, pCy - fy) < 9) {
            if (this.starTimer <= 0) this.hurt(world);
          }
        }
      }
    }
  }

  // ---- POWER-UP ITEMS ----
  class PowerUpItem {
    constructor(kind, x, y, droppedFromReserve = false) {
      this.kind = kind; // mushroom | 1up | fire | acorn | star
      this.x = x;
      this.y = y;
      this.w = 14;
      this.h = 14;
      this.vx = kind === 'fire' ? 0 : 62;
      this.vy = droppedFromReserve ? 20 : 0;
      this.emergeTimer = droppedFromReserve ? 0 : 0.35;
      this.collected = false;
    }

    update(dt, world) {
      if (this.emergeTimer > 0) {
        this.emergeTimer -= dt;
        this.y -= (16 / 0.35) * dt;
        return;
      }

      if (this.kind === 'fire') {
        if (aabb(this, world.player)) {
          this.collected = true;
          world.player.givePowerUp(this.kind, world);
        }
        return;
      }

      if (this.kind === 'acorn') {
        // Gently hops/floats forward
        this.vy = Math.min(80, this.vy + 320 * dt);
      } else {
        this.vy = Math.min(320, this.vy + 880 * dt);
      }

      // Horizontal
      this.x += this.vx * dt;
      const sideX = this.vx > 0 ? Math.floor((this.x + this.w) / TILE_SIZE) : Math.floor(this.x / TILE_SIZE);
      const midY = Math.floor((this.y + this.h * 0.5) / TILE_SIZE);
      if (world.isSolidTileAt(sideX, midY, this.y + this.h, 0, true)) {
        this.vx = -this.vx;
        this.x += this.vx * dt * 2;
      }

      // Vertical
      const prevBot = this.y + this.h;
      this.y += this.vy * dt;
      if (this.vy >= 0) {
        const fy = Math.floor((this.y + this.h) / TILE_SIZE);
        const lx = Math.floor((this.x + 2) / TILE_SIZE);
        const rx = Math.floor((this.x + this.w - 2) / TILE_SIZE);
        for (let tx = lx; tx <= rx; tx++) {
          if (world.isSolidTileAt(tx, fy, prevBot, this.vy, false)) {
            this.y = fy * TILE_SIZE - this.h;
            this.vy = this.kind === 'star' ? -255 : this.kind === 'acorn' ? -135 : 0;
            break;
          }
        }
      }

      if (this.y > world.area.height * TILE_SIZE + 32) this.collected = true;
      if (aabb(this, world.player)) {
        this.collected = true;
        world.player.givePowerUp(this.kind, world);
      }
    }
  }

  // ---- FIREBALL ----
  class Fireball {
    constructor(x, y, dir) {
      this.x = x;
      this.y = y;
      this.w = 8;
      this.h = 8;
      this.vx = dir * 235;
      this.vy = 20;
      this.life = 2.2;
      this.dead = false;
    }

    update(dt, world) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.vy = Math.min(320, this.vy + 980 * dt);
      this.x += this.vx * dt;
      const sx = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / TILE_SIZE);
      const sy = Math.floor((this.y + 4) / TILE_SIZE);
      if (world.isSolidTileAt(sx, sy, this.y + this.h, 0, true)) {
        this.dead = true;
        world.particles.stompBurst(this.x + 4, this.y + 4, '#ff7818');
        return;
      }

      const prevBot = this.y + this.h;
      this.y += this.vy * dt;
      const fy = Math.floor((this.y + this.h) / TILE_SIZE);
      const fx = Math.floor((this.x + 4) / TILE_SIZE);
      if (this.vy > 0 && world.isSolidTileAt(fx, fy, prevBot, this.vy, false)) {
        this.y = fy * TILE_SIZE - this.h;
        this.vy = -185;
      }

      if (Math.random() < dt * 25) {
        world.particles.spawnParticle({ x: this.x + 3, y: this.y + 3, size: 2, color: '#ffa020', life: 0.16 });
      }

      // Hit enemies
      for (const e of world.areaState.enemies) {
        if (!e.dead && e.state !== 'squashed' && aabb(this, e)) {
          this.dead = true;
          if (e.type === 'beetle') {
            world.audio.brickBump();
            world.particles.stompBurst(this.x + 4, this.y + 4, '#80b0ff');
          } else {
            e.flipKill(world, Math.sign(this.vx));
          }
          return;
        }
      }

      // Hit Bowser
      if (world.areaState.bowser && !world.areaState.bowser.dead && aabb(this, world.areaState.bowser)) {
        this.dead = true;
        world.areaState.bowser.damage(world, 1);
      }
    }
  }

  // ---- ENEMIES ----
  class Enemy {
    constructor(def) {
      this.type = def.type;
      this.x = def.x ?? def.tx * TILE_SIZE;
      this.y = def.y ?? def.ty * TILE_SIZE;
      this.w = 14;
      this.h = 14;
      this.dir = def.dir ?? -1;
      this.vx = this.dir * this.baseSpeed();
      this.vy = 0;
      this.state = 'walk'; // walk | squashed | shell | shell_spin | pile | flipped
      this.stateTimer = 0;
      this.dead = false;
      this.remove = false;
      this.kickGrace = 0;
      this.shellCombo = 0;
      this.animTimer = Math.random() * 2;
      this.baseY = this.y;
      this.piranhaPhase = 0;
      if (this.type === 'piranha') {
        this.x = def.tx * TILE_SIZE + 8;
        this.baseY = def.ty * TILE_SIZE;
        this.y = this.baseY;
      }
    }

    baseSpeed() {
      switch (this.type) {
        case 'goomba': return 42;
        case 'koopa_g':
        case 'koopa_r':
        case 'paratroopa': return 46;
        case 'beetle': return 44;
        case 'spiny': return 45;
        case 'drybones': return 44;
        case 'bullet': return 118;
        default: return 0;
      }
    }

    awardCombo(world, comboVal, isShell = false) {
      const table = [200, 400, 800, 1000, 2000, 4000, 8000];
      const idx = Math.min(table.length, comboVal);
      if (idx >= table.length) {
        world.audio.oneUp();
        world.particles.spawnPopup(this.x + 8, this.y - 6, '1-UP!', '#50ff68');
        world.callbacks.addLife && world.callbacks.addLife(1);
      } else {
        const pts = table[idx];
        world.particles.spawnPopup(this.x + 8, this.y - 6, `+${pts}`, isShell ? '#80e8ff' : '#ffd838');
        world.callbacks.addScore && world.callbacks.addScore(pts);
      }
    }

    flipKill(world, pushDir = 1) {
      if (this.dead) return;
      this.dead = true;
      this.state = 'flipped';
      this.vx = (pushDir || 1) * 55;
      this.vy = -185;
      world.audio.kick();
      world.particles.stompBurst(this.x + 7, this.y + 7, '#ffffff');
      this.awardCombo(world, 0);
    }

    update(dt, world) {
      this.animTimer += dt;
      if (this.kickGrace > 0) this.kickGrace -= dt;

      if (this.state === 'flipped') {
        this.vy += 880 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y > world.area.height * TILE_SIZE + 32) this.remove = true;
        return;
      }

      if (this.state === 'squashed') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.remove = true;
        return;
      }

      if (this.type === 'piranha') {
        this.updatePiranha(dt, world);
        return;
      }

      if (this.type === 'bullet') {
        this.x += this.vx * dt;
        if (this.x < -32 || this.x > world.area.width * TILE_SIZE + 32) this.remove = true;
        this.checkPlayerInteraction(world);
        return;
      }

      if (this.state === 'pile') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'walk';
          this.vx = this.dir * this.baseSpeed();
        }
        return;
      }

      // Only activate enemies near camera
      if (Math.abs(this.x - world.cameraX - VIRTUAL_WIDTH * 0.5) > VIRTUAL_WIDTH * 0.85 && this.state !== 'shell_spin') {
        return;
      }

      // Gravity
      this.vy = Math.min(340, this.vy + 920 * dt);

      // Horizontal
      this.x += this.vx * dt;
      const sx = this.vx > 0 ? Math.floor((this.x + this.w) / TILE_SIZE) : Math.floor(this.x / TILE_SIZE);
      const midTy = Math.floor((this.y + this.h * 0.5) / TILE_SIZE);
      if (world.isSolidTileAt(sx, midTy, this.y + this.h, 0, true)) {
        if (this.state === 'shell_spin') {
          const t = world.getTile(sx, midTy);
          if (t === TILE.BRICK || t === TILE.QUESTION || t === TILE.ON_OFF_SWITCH) {
            world.bumpBlock(sx, midTy, true);
          } else {
            world.audio.brickBump();
          }
        }
        this.dir = -this.dir;
        this.vx = -this.vx;
        this.x += this.vx * dt * 2;
      }

      // Vertical
      const prevBot = this.y + this.h;
      this.y += this.vy * dt;
      let grounded = false;
      const fy = Math.floor((this.y + this.h) / TILE_SIZE);
      const lx = Math.floor((this.x + 2) / TILE_SIZE);
      const rx = Math.floor((this.x + this.w - 2) / TILE_SIZE);
      if (this.vy >= 0) {
        for (let tx = lx; tx <= rx; tx++) {
          if (world.isSolidTileAt(tx, fy, prevBot, this.vy, false)) {
            this.y = fy * TILE_SIZE - this.h;
            this.vy = this.type === 'paratroopa' ? -215 : 0;
            grounded = true;
            break;
          }
        }
      }

      // Red Koopa smart edge turnaround
      if (grounded && this.type === 'koopa_r' && this.state === 'walk') {
        const aheadTx = Math.floor((this.x + (this.dir > 0 ? this.w + 2 : -2)) / TILE_SIZE);
        if (!world.isSolidTileAt(aheadTx, fy, prevBot, 10, false)) {
          this.dir = -this.dir;
          this.vx = this.dir * this.baseSpeed();
        }
      }

      // Spinning shell hits other enemies
      if (this.state === 'shell_spin') {
        for (const other of world.areaState.enemies) {
          if (other !== this && !other.dead && other.state !== 'squashed' && aabb(this, other)) {
            other.flipKill(world, Math.sign(this.vx));
            this.awardCombo(world, this.shellCombo++, true);
            world.hitStop = 0.025;
          }
        }
      }

      if (this.y > world.area.height * TILE_SIZE + 24) this.remove = true;

      this.checkPlayerInteraction(world);
    }

    updatePiranha(dt, world) {
      // 4-second cycle: hidden -> rising -> open -> sinking
      const nearPlayer = Math.abs(world.player.x + world.player.w / 2 - (this.x + 8)) < 22;
      const cycle = this.piranhaPhase % 4.0;
      if (cycle < 1.2 && nearPlayer) {
        // Stay hidden if Mario stands on pipe
      } else {
        this.piranhaPhase += dt;
      }
      const c = this.piranhaPhase % 4.0;
      let offset = 16;
      if (c >= 1.2 && c < 1.8) offset = 16 * (1 - (c - 1.2) / 0.6);
      else if (c >= 1.8 && c < 3.0) offset = 0;
      else if (c >= 3.0 && c < 3.6) offset = 16 * ((c - 3.0) / 0.6);
      this.y = this.baseY - 16 + offset;

      if (offset < 12) this.checkPlayerInteraction(world);
    }

    checkPlayerInteraction(world) {
      const p = world.player;
      if (p.state !== 'normal' || p.hidden || this.dead) return;
      if (!aabb(p, this)) return;

      // Starman kills anything on touch
      if (p.starTimer > 0) {
        this.flipKill(world, p.x < this.x ? 1 : -1);
        return;
      }

      // Kick stationary shell
      if (this.state === 'shell') {
        const kickDir = p.x + p.w / 2 < this.x + this.w / 2 ? 1 : -1;
        this.state = 'shell_spin';
        this.vx = kickDir * 245;
        this.kickGrace = 0.14;
        this.shellCombo = 0;
        world.audio.kick();
        world.particles.stompBurst(this.x + 7, this.y + 7, '#ffffff');
        return;
      }

      // Spiny & Piranha hurt from top unless Ground Pound on non-spiky? Both are spiky/tooth!
      const isSpiky = this.type === 'spiny' || this.type === 'piranha';
      const playerFalling = p.vy > 0 && p.y + p.h - p.vy * 0.03 <= this.y + this.h * 0.65;

      if (!isSpiky && (playerFalling || p.groundPound)) {
        // Stomp!
        p.y = this.y - p.h;
        p.vy = p.groundPound ? -180 : PHYSICS.STOMP_LOW_VY;
        if (p.groundPound) p.groundPound = false;
        p.acornBoostUsed = false;

        world.audio.stomp(p.stompCombo);
        this.awardCombo(world, p.stompCombo++);
        world.particles.stompBurst(this.x + 7, this.y + 6);
        world.hitStop = 0.025;

        if (this.type === 'goomba' || this.type === 'bullet') {
          if (this.type === 'bullet') {
            this.flipKill(world, 0);
            p.vy = -270;
          } else {
            this.state = 'squashed';
            this.stateTimer = 0.38;
            this.vx = 0;
            this.dead = true;
          }
        } else if (this.type === 'paratroopa') {
          this.type = 'koopa_g';
          this.vy = 0;
        } else if (this.type === 'koopa_g' || this.type === 'koopa_r' || this.type === 'beetle') {
          this.state = 'shell';
          this.vx = 0;
          this.kickGrace = 0.12;
        } else if (this.type === 'drybones') {
          this.state = 'pile';
          this.vx = 0;
          this.stateTimer = 3.5;
        }
        return;
      }

      if (this.kickGrace > 0) return;
      p.hurt(world);
    }
  }

  // ---- THWOMP ----
  class Thwomp {
    constructor(tx, ty) {
      this.x = tx * TILE_SIZE;
      this.startY = ty * TILE_SIZE;
      this.y = this.startY;
      this.w = 24;
      this.h = 24;
      this.state = 'idle'; // idle | slam | wait | rise
      this.timer = 0;
      this.vy = 0;
    }

    update(dt, world) {
      const p = world.player;
      const distX = Math.abs(p.x + p.w / 2 - (this.x + 12));

      if (this.state === 'idle') {
        if (distX < 40 && p.y > this.y) {
          this.state = 'slam';
          this.vy = 40;
        }
      } else if (this.state === 'slam') {
        this.vy = Math.min(340, this.vy + 1150 * dt);
        this.y += this.vy * dt;
        const fy = Math.floor((this.y + this.h) / TILE_SIZE);
        const lx = Math.floor((this.x + 2) / TILE_SIZE);
        const rx = Math.floor((this.x + this.w - 2) / TILE_SIZE);
        for (let tx = lx; tx <= rx; tx++) {
          if (world.isSolidTileAt(tx, fy, this.y + this.h, this.vy, true)) {
            this.y = fy * TILE_SIZE - this.h;
            this.vy = 0;
            this.state = 'wait';
            this.timer = 0.75;
            world.audio.groundPound();
            world.shake(3.5, 0.2);
            world.particles.shockwave(this.x + 12, this.y + this.h);
            break;
          }
        }
      } else if (this.state === 'wait') {
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'rise';
      } else if (this.state === 'rise') {
        this.y -= 55 * dt;
        if (this.y <= this.startY) {
          this.y = this.startY;
          this.state = 'idle';
        }
      }

      if (p.state === 'normal' && aabb(p, this) && p.starTimer <= 0) {
        p.hurt(world);
      }
    }
  }

  // ---- BOWSER BOSS ----
  class Bowser {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = 28;
      this.h = 30;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;
      this.hp = 12;
      this.maxHp = 12;
      this.active = false;
      this.dead = false;
      this.removed = false;
      this.hurtFlash = 0;
      this.aiTimer = 1.1;
      this.roarTimer = 0;
      this.minX = x - 11 * TILE_SIZE;
      this.maxX = x + 5 * TILE_SIZE;
    }

    damage(world, dmg) {
      if (this.dead) return;
      this.hp = Math.max(0, this.hp - dmg);
      this.hurtFlash = 0.25;
      world.audio.kick();
      world.particles.stompBurst(this.x + 14, this.y + 12, '#ff7818');
      world.particles.spawnPopup(this.x + 14, this.y - 8, `-${dmg}`, '#ff5030');
      if (this.hp <= 0) {
        this.fallIntoLava(world);
      }
    }

    fallIntoLava(world) {
      if (this.dead) return;
      this.dead = true;
      this.vy = -120;
      world.bowserDefeated = true;
      world.audio.groundPound();
      world.shake(6, 0.45);
      world.callbacks.addScore && world.callbacks.addScore(5000);
      world.particles.spawnPopup(this.x + 14, this.y - 12, '+5000!', '#ffd838');
    }

    update(dt, world) {
      if (this.hurtFlash > 0) this.hurtFlash -= dt;

      if (this.dead) {
        this.vy += 650 * dt;
        this.y += this.vy * dt;
        if (this.y > 14 * TILE_SIZE && !this.splashed) {
          this.splashed = true;
          world.particles.lavaSplash(this.x + 14, 15 * TILE_SIZE);
          world.audio.firework();
        }
        if (this.y > VIRTUAL_HEIGHT + 40) this.removed = true;
        return;
      }

      const p = world.player;
      if (!this.active) {
        if (p.x > this.x - 240) this.active = true;
        else return;
      }

      this.facing = p.x < this.x ? -1 : 1;
      const phase2 = this.hp <= this.maxHp * 0.5;

      if (this.roarTimer > 0) {
        this.roarTimer -= dt;
        if (this.roarTimer <= 0) {
          world.audio.bowserFire();
          world.areaState.enemyFireballs.push({
            x: this.x + (this.facing < 0 ? -12 : this.w),
            y: this.y + 10 + (Math.random() > 0.5 ? 6 : -4),
            w: 14,
            h: 10,
            vx: this.facing * (phase2 ? 155 : 125),
            vy: 0,
            life: 2.6,
          });
        }
      }

      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = phase2 ? 1.05 : 1.55;
        const r = Math.random();
        if (r < 0.45) {
          this.roarTimer = 0.35;
        } else if (r < 0.8) {
          if (this.vy === 0) this.vy = -245;
          const count = phase2 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            world.areaState.hammers.push({
              x: this.x + 10,
              y: this.y + 4,
              w: 10,
              h: 10,
              vx: this.facing * (75 + i * 35),
              vy: -220 - i * 35,
              life: 2.5,
            });
          }
        } else {
          this.vx = this.facing * (phase2 ? 62 : 42);
        }
      }

      // Patrol bounds
      this.x += this.vx * dt;
      if (this.x < this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
      if (this.x > this.maxX) { this.x = this.maxX; this.vx = -Math.abs(this.vx); }

      // Gravity + Bridge floor
      this.vy = Math.min(340, this.vy + 780 * dt);
      const prevBot = this.y + this.h;
      this.y += this.vy * dt;
      const fy = Math.floor((this.y + this.h) / TILE_SIZE);
      const tx = Math.floor((this.x + 14) / TILE_SIZE);
      if (this.vy >= 0 && world.isSolidTileAt(tx, fy, prevBot, this.vy, false)) {
        this.y = fy * TILE_SIZE - this.h;
        this.vy = 0;
      }

      if (p.state === 'normal' && aabb(p, this) && p.starTimer <= 0) {
        p.hurt(world);
      }
    }
  }

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.WorldState = WorldState;
  global.MarioGame.Mario = Mario;
  global.MarioGame.Enemy = Enemy;
  global.MarioGame.PowerUpItem = PowerUpItem;
})(window);

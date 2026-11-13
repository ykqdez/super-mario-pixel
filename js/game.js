(function (global) {
  'use strict';

  const MG = global.MarioGame;
  const { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, FIXED_DT, GAME_STATE, STORAGE_KEY } = MG.CONSTANTS;

  function loadSave() {
    const def = {
      highScore: 0,
      maxUnlockedNode: 0,
      cleared: [false, false, false, false],
      starCoins: [
        [false, false, false],
        [false, false, false],
        [false, false, false],
        [false, false, false],
      ],
      unlockAll: false,
      settings: { scanlines: false, shake: true, lighting: true, volume: 65, muted: false },
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      return Object.assign(def, parsed, {
        settings: Object.assign(def.settings, parsed.settings || {}),
      });
    } catch {
      return def;
    }
  }

  function persistSave(save) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch { /* ignore storage errors */ }
  }

  class InputManager {
    constructor() {
      this.keys = new Set();
      this.virtual = new Set();
      this.prev = { left: false, right: false, up: false, down: false, jump: false, run: false, reserve: false, confirm: false, pause: false };
      this.curr = Object.assign({}, this.prev);
    }

    onKeyDown(code) {
      this.keys.add(code);
    }

    onKeyUp(code) {
      this.keys.delete(code);
    }

    clearAll() {
      this.keys.clear();
      this.virtual.clear();
    }

    poll() {
      this.prev = Object.assign({}, this.curr);
      const k = this.keys;
      const v = this.virtual;
      let gpLeft = false, gpRight = false, gpUp = false, gpDown = false, gpJump = false, gpRun = false, gpRes = false, gpPause = false;

      if (navigator.getGamepads) {
        const pads = navigator.getGamepads();
        const pad = pads && pads[0];
        if (pad) {
          const axX = pad.axes[0] || 0;
          const axY = pad.axes[1] || 0;
          gpLeft = axX < -0.4 || !!pad.buttons[14]?.pressed;
          gpRight = axX > 0.4 || !!pad.buttons[15]?.pressed;
          gpUp = axY < -0.4 || !!pad.buttons[12]?.pressed;
          gpDown = axY > 0.4 || !!pad.buttons[13]?.pressed;
          gpJump = !!pad.buttons[0]?.pressed;
          gpRun = !!pad.buttons[2]?.pressed || !!pad.buttons[1]?.pressed;
          gpRes = !!pad.buttons[3]?.pressed;
          gpPause = !!pad.buttons[9]?.pressed;
        }
      }

      this.curr.left = k.has('ArrowLeft') || k.has('KeyA') || v.has('left') || gpLeft;
      this.curr.right = k.has('ArrowRight') || k.has('KeyD') || v.has('right') || gpRight;
      this.curr.up = k.has('ArrowUp') || k.has('KeyW') || v.has('up') || gpUp;
      this.curr.down = k.has('ArrowDown') || k.has('KeyS') || v.has('down') || gpDown;
      this.curr.jump = k.has('Space') || k.has('KeyW') || k.has('ArrowUp') || k.has('KeyZ') || k.has('KeyK') || v.has('jump') || gpJump;
      this.curr.run = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyJ') || k.has('KeyX') || v.has('run') || gpRun;
      this.curr.reserve = k.has('KeyE') || k.has('KeyC') || k.has('KeyQ') || v.has('reserve') || gpRes;
      this.curr.confirm = k.has('Enter') || k.has('Space') || k.has('KeyZ') || k.has('KeyK') || v.has('jump') || gpJump;
      this.curr.pause = k.has('Escape') || k.has('KeyP') || v.has('pause') || gpPause;

      return {
        left: this.curr.left,
        right: this.curr.right,
        up: this.curr.up,
        down: this.curr.down,
        jump: this.curr.jump,
        run: this.curr.run,
        reserve: this.curr.reserve,
        confirm: this.curr.confirm,
        leftJustPressed: this.curr.left && !this.prev.left,
        rightJustPressed: this.curr.right && !this.prev.right,
        upJustPressed: this.curr.up && !this.prev.up,
        downJustPressed: this.curr.down && !this.prev.down,
        jumpJustPressed: this.curr.jump && !this.prev.jump,
        runJustPressed: this.curr.run && !this.prev.run,
        reserveJustPressed: this.curr.reserve && !this.prev.reserve,
        confirmJustPressed: this.curr.confirm && !this.prev.confirm,
        pauseJustPressed: this.curr.pause && !this.prev.pause,
      };
    }
  }

  class MarioApp {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.sprites = MG.buildSprites();
      this.audio = new MG.ChiptuneAudio();
      this.particles = new MG.ParticleSystem();
      this.renderer = new MG.GameRenderer(this.sprites);
      this.input = new InputManager();
      this.stages = MG.createStageList();
      this.nodes = MG.OVERWORLD_NODES;

      this.save = loadSave();
      this.state = GAME_STATE.TITLE;
      this.time = 0;
      this.menuIdx = 0;
      this.mapCursor = 0;
      this.pauseIdx = 0;

      this.score = 0;
      this.coins = 0;
      this.lives = 5;
      this.carryPower = MG.CONSTANTS.POWER.SMALL;
      this.carryReserve = null;
      this.activeStageIdx = 0;
      this.world = null;
      this.clearData = null;
      this.toadState = { cursor: 1, openedIdx: -1, reward: null, message: '欢迎光临! 请挑选一个幸运宝箱!' };

      this.accum = 0;
      this.lastTime = 0;

      this.isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      this.rotateDismissed = false;

      this.bindUI();
      this.applySettingsUI();
      this.initMobileSupport();
    }

    initMobileSupport() {
      const pad = document.getElementById('virtual-controls');
      const touchBtn = document.getElementById('btn-touch-toggle');
      if (this.isTouch) {
        pad.classList.remove('hidden');
        pad.setAttribute('aria-hidden', 'false');
        touchBtn.classList.add('active');
      }
      const updateRotateBanner = () => {
        const banner = document.getElementById('rotate-banner');
        const isPortraitMobile = this.isTouch && !this.rotateDismissed && window.innerHeight > window.innerWidth;
        banner.classList.toggle('hidden', !isPortraitMobile);
      };
      updateRotateBanner();
      window.addEventListener('resize', updateRotateBanner);
      window.addEventListener('orientationchange', updateRotateBanner);

      document.getElementById('btn-dismiss-rotate').addEventListener('click', () => {
        this.audio.init();
        this.rotateDismissed = true;
        updateRotateBanner();
      });
      document.getElementById('btn-enter-landscape').addEventListener('click', async () => {
        this.audio.init();
        this.rotateDismissed = true;
        updateRotateBanner();
        await this.toggleFullscreen(true);
      });
    }

    bindUI() {
      window.addEventListener('keydown', (e) => {
        this.audio.init();
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        if (e.code === 'KeyM') {
          this.toggleMute();
          return;
        }
        if (e.code === 'KeyF') {
          this.toggleFullscreen();
          return;
        }
        if (e.code === 'KeyH') {
          this.toggleHelp();
          return;
        }
        this.input.onKeyDown(e.code);
      });

      window.addEventListener('keyup', (e) => {
        this.input.onKeyUp(e.code);
      });

      window.addEventListener('blur', () => this.input.clearAll());

      // Tap / Click directly on Canvas across Title, Overworld, Toad House, Pause & Result overlays
      this.canvas.addEventListener('pointerdown', (e) => {
        this.audio.init();
        const rect = this.canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH;
        const y = ((e.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT;

        if (this.state === GAME_STATE.OVERWORLD) {
          this.nodes.forEach((n, idx) => {
            if (Math.hypot(x - n.x, y - n.y) < 18) {
              if (this.mapCursor === idx) this.enterOverworldNode();
              else this.mapCursor = idx;
            }
          });
        } else if (this.state === GAME_STATE.TITLE) {
          if (x >= 130 && x <= 350 && y >= 122 && y <= 198) {
            const idx = Math.floor((y - 128) / 21);
            if (idx >= 0 && idx < 3) {
              this.menuIdx = idx;
              this.activateTitleOption();
            }
          }
        } else if (this.state === GAME_STATE.TOAD_HOUSE) {
          if (this.toadState.openedIdx === -1) {
            for (let i = 0; i < 3; i++) {
              const cx = 148 + i * 76;
              if (x >= cx - 8 && x <= cx + 40 && y >= 136 && y <= 180) {
                this.toadState.cursor = i;
                this.openToadChest();
                return;
              }
            }
          } else {
            this.state = GAME_STATE.OVERWORLD;
          }
        } else if (this.state === GAME_STATE.PAUSED) {
          if (x >= 140 && x <= 340 && y >= 96 && y <= 185) {
            const idx = Math.floor((y - 98) / 26);
            if (idx >= 0 && idx < 3) {
              this.pauseIdx = idx;
              this.confirmPauseOption();
            }
          }
        } else if (
          this.state === GAME_STATE.STAGE_CLEAR ||
          this.state === GAME_STATE.GAME_OVER ||
          this.state === GAME_STATE.VICTORY
        ) {
          this.advanceAfterOutcome();
        }
      });

      // Top bar buttons
      document.getElementById('btn-unlock-all').addEventListener('click', () => {
        this.save.unlockAll = !this.save.unlockAll;
        persistSave(this.save);
        this.applySettingsUI();
      });
      document.getElementById('btn-mute').addEventListener('click', () => this.toggleMute());
      document.getElementById('btn-touch-toggle').addEventListener('click', () => {
        const pad = document.getElementById('virtual-controls');
        pad.classList.toggle('hidden');
        const visible = !pad.classList.contains('hidden');
        pad.setAttribute('aria-hidden', String(!visible));
        document.getElementById('btn-touch-toggle').classList.toggle('active', visible);
      });
      document.getElementById('btn-help').addEventListener('click', () => this.toggleHelp(true));
      document.getElementById('btn-close-help').addEventListener('click', () => this.toggleHelp(false));
      document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());

      // Options checkboxes & slider
      document.getElementById('opt-scanlines').addEventListener('change', (e) => {
        this.save.settings.scanlines = e.target.checked;
        persistSave(this.save);
        this.applySettingsUI();
      });
      document.getElementById('opt-shake').addEventListener('change', (e) => {
        this.save.settings.shake = e.target.checked;
        persistSave(this.save);
      });
      document.getElementById('opt-lighting').addEventListener('change', (e) => {
        this.save.settings.lighting = e.target.checked;
        persistSave(this.save);
      });
      document.getElementById('opt-volume').addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.save.settings.volume = val;
        this.audio.setVolume(val / 100);
        document.getElementById('opt-volume-val').textContent = `${val}%`;
        persistSave(this.save);
      });

      // Multi-touch ergonomic virtual gamepad (supports thumb-sliding on D-pad & multi-finger actions!)
      const pad = document.getElementById('virtual-controls');
      const allVbtns = [...document.querySelectorAll('.vbtn')];
      const syncTouches = (ev) => {
        if (ev.cancelable) ev.preventDefault();
        this.audio.init();
        const active = new Set();
        for (let i = 0; i < ev.touches.length; i++) {
          const t = ev.touches[i];
          const el = document.elementFromPoint(t.clientX, t.clientY)?.closest?.('.vbtn');
          if (el && el.dataset.key) active.add(el.dataset.key);
        }
        for (const btn of allVbtns) {
          const k = btn.dataset.key;
          const isOn = active.has(k);
          btn.classList.toggle('pressed', isOn);
          if (isOn) this.input.virtual.add(k);
          else this.input.virtual.delete(k);
        }
      };
      pad.addEventListener('touchstart', syncTouches, { passive: false });
      pad.addEventListener('touchmove', syncTouches, { passive: false });
      pad.addEventListener('touchend', syncTouches, { passive: false });
      pad.addEventListener('touchcancel', syncTouches, { passive: false });

      // Mouse pointer fallback for desktop testing of virtual buttons
      allVbtns.forEach((btn) => {
        const key = btn.dataset.key;
        btn.addEventListener('pointerdown', (ev) => {
          if (ev.pointerType === 'touch') return;
          ev.preventDefault();
          this.audio.init();
          this.input.virtual.add(key);
          btn.classList.add('pressed');
        });
        const releaseMouse = (ev) => {
          if (ev.pointerType === 'touch') return;
          this.input.virtual.delete(key);
          btn.classList.remove('pressed');
        };
        btn.addEventListener('pointerup', releaseMouse);
        btn.addEventListener('pointerleave', releaseMouse);
        btn.addEventListener('pointercancel', releaseMouse);
      });
    }

    applySettingsUI() {
      const s = this.save.settings;
      this.audio.setMuted(s.muted);
      this.audio.setVolume(s.volume / 100);
      document.getElementById('btn-mute').textContent = `声音: ${s.muted ? '关' : '开'}`;
      document.getElementById('btn-unlock-all').textContent = `全关解锁: ${this.save.unlockAll ? '开' : '关'}`;
      document.getElementById('btn-unlock-all').classList.toggle('active', this.save.unlockAll);
      document.getElementById('scanline-overlay').classList.toggle('hidden', !s.scanlines);
      document.getElementById('opt-scanlines').checked = s.scanlines;
      document.getElementById('opt-shake').checked = s.shake;
      document.getElementById('opt-lighting').checked = s.lighting;
      document.getElementById('opt-volume').value = s.volume;
      document.getElementById('opt-volume-val').textContent = `${s.volume}%`;
    }

    toggleMute() {
      this.audio.init();
      this.save.settings.muted = !this.save.settings.muted;
      persistSave(this.save);
      this.applySettingsUI();
    }

    toggleHelp(force) {
      const modal = document.getElementById('help-modal');
      const show = force !== undefined ? force : modal.classList.contains('hidden');
      modal.classList.toggle('hidden', !show);
      if (show && this.state === GAME_STATE.PLAYING) {
        this.state = GAME_STATE.PAUSED;
      }
    }

    async toggleFullscreen(forceEnter = false) {
      const appEl = document.getElementById('app');
      try {
        if (!document.fullscreenElement || forceEnter) {
          if (!document.fullscreenElement) {
            await appEl.requestFullscreen?.();
          }
          await screen.orientation?.lock?.('landscape').catch(() => {});
        } else {
          await document.exitFullscreen?.();
        }
      } catch { /* ignore fullscreen/orientation errors on unsupported browsers */ }
    }

    addScore(pts) {
      this.score += pts;
      if (this.score > this.save.highScore) {
        this.save.highScore = this.score;
        persistSave(this.save);
      }
    }

    addCoin(n) {
      this.coins += n;
      while (this.coins >= 100) {
        this.coins -= 100;
        this.addLife(1);
        this.audio.oneUp();
      }
    }

    addLife(n) {
      this.lives = Math.min(99, this.lives + n);
    }

    startStage(stageIdx) {
      this.activeStageIdx = stageIdx;
      const stage = this.stages[stageIdx];
      this.world = new MG.WorldState(stage, this.audio, this.particles, {
        addScore: (pts) => this.addScore(pts),
        addCoin: (n) => this.addCoin(n),
        addLife: (n) => this.addLife(n),
        canShake: () => this.save.settings.shake,
        onPlayerDied: () => this.handlePlayerDied(),
        onStageClear: (isFinal) => this.handleStageClear(isFinal),
      });
      // Carry over powerup & reserve item across stages!
      if (this.carryPower && this.carryPower !== MG.CONSTANTS.POWER.SMALL) {
        this.world.player.setPower(this.carryPower, true);
      }
      this.world.player.reserveItem = this.carryReserve;
      this.state = GAME_STATE.PLAYING;
    }

    handlePlayerDied() {
      this.lives--;
      this.carryPower = MG.CONSTANTS.POWER.SMALL;
      if (this.lives <= 0) {
        this.state = GAME_STATE.GAME_OVER;
        this.audio.playFanfare('gameover');
      } else {
        this.world.respawnAtCheckpoint();
      }
    }

    handleStageClear(isFinal) {
      const idx = this.activeStageIdx;
      const timeBonus = Math.ceil(this.world.timeLeft) * 20;
      this.addScore(timeBonus);
      this.carryPower = this.world.player.power;
      this.carryReserve = this.world.player.reserveItem;

      // Save Star Coins & Progression
      this.save.cleared[idx] = true;
      for (const scId of this.world.collectedStarCoins) {
        this.save.starCoins[idx][scId] = true;
      }
      const nodeForStage = this.nodes.findIndex((n) => n.stageIdx === idx);
      if (nodeForStage >= 0 && nodeForStage + 1 > this.save.maxUnlockedNode) {
        this.save.maxUnlockedNode = Math.min(this.nodes.length - 1, nodeForStage + 1);
      }
      persistSave(this.save);

      const starArr = this.save.starCoins[idx];
      const starCount = starArr.filter(Boolean).length;
      const rank = starCount === 3 ? 'S' : starCount === 2 ? 'A' : starCount === 1 ? 'B' : 'C';
      this.clearData = {
        stageCode: this.world.stage.code,
        stageName: this.world.stage.name,
        timeBonus,
        score: this.score,
        starCoins: starArr,
        rank,
      };
      this.state = isFinal ? GAME_STATE.VICTORY : GAME_STATE.STAGE_CLEAR;
    }

    activateTitleOption() {
      if (this.menuIdx === 0) {
        this.score = 0;
        this.coins = 0;
        this.lives = 5;
        this.carryPower = MG.CONSTANTS.POWER.SMALL;
        this.carryReserve = null;
        this.startStage(0);
      } else if (this.menuIdx === 1) {
        this.state = GAME_STATE.OVERWORLD;
      } else if (this.menuIdx === 2) {
        this.save.unlockAll = !this.save.unlockAll;
        persistSave(this.save);
        this.applySettingsUI();
      }
    }

    enterOverworldNode() {
      const node = this.nodes[this.mapCursor];
      const unlocked = this.save.unlockAll || this.mapCursor <= this.save.maxUnlockedNode;
      if (!unlocked) {
        this.audio.brickBump();
        return;
      }
      if (node.type === 'toad') {
        this.toadState = { cursor: 1, openedIdx: -1, reward: null, message: '欢迎光临! 请挑选一个幸运宝箱!' };
        this.state = GAME_STATE.TOAD_HOUSE;
        this.audio.switchToggle();
      } else if (node.stageIdx >= 0) {
        this.startStage(node.stageIdx);
      }
    }

    openToadChest() {
      if (this.toadState.openedIdx !== -1) return;
      const rewards = ['acorn', 'fire', '1up', 'mushroom'];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      this.toadState.openedIdx = this.toadState.cursor;
      this.toadState.reward = reward;
      if (reward === '1up') {
        this.addLife(1);
        this.audio.oneUp();
        this.toadState.message = '太棒了! 获得 1-UP 生命 +1! 点击或按跳返回';
      } else {
        this.carryReserve = reward;
        this.audio.powerup();
        const names = { acorn: '超级橡果', fire: '火焰花', mushroom: '超级蘑菇' };
        this.toadState.message = `获得【${names[reward]}】已放入备用道具框! 点击或按跳返回`;
      }
    }

    confirmPauseOption() {
      if (this.pauseIdx === 0) this.state = GAME_STATE.PLAYING;
      else if (this.pauseIdx === 1) this.startStage(this.activeStageIdx);
      else this.state = GAME_STATE.OVERWORLD;
    }

    advanceAfterOutcome() {
      if (this.state === GAME_STATE.STAGE_CLEAR) {
        if (this.activeStageIdx + 1 < this.stages.length) {
          const nextNode = this.nodes.findIndex((n) => n.stageIdx === this.activeStageIdx + 1);
          if (nextNode >= 0) this.mapCursor = nextNode;
        }
        this.state = GAME_STATE.OVERWORLD;
      } else if (this.state === GAME_STATE.GAME_OVER) {
        this.lives = 5;
        this.score = 0;
        this.coins = 0;
        this.state = GAME_STATE.OVERWORLD;
      } else if (this.state === GAME_STATE.VICTORY) {
        this.state = GAME_STATE.OVERWORLD;
      }
    }

    stepFixed(dt) {
      this.time += dt;
      const inp = this.input.poll();

      if (this.state === GAME_STATE.TITLE) {
        this.audio.playTrack('map');
        if (inp.upJustPressed) { this.menuIdx = (this.menuIdx + 2) % 3; this.audio.coin(); }
        if (inp.downJustPressed) { this.menuIdx = (this.menuIdx + 1) % 3; this.audio.coin(); }
        if (inp.confirmJustPressed) this.activateTitleOption();
      } else if (this.state === GAME_STATE.OVERWORLD) {
        this.audio.playTrack('map');
        if (inp.rightJustPressed || inp.upJustPressed) {
          this.mapCursor = Math.min(this.nodes.length - 1, this.mapCursor + 1);
          this.audio.kick();
        }
        if (inp.leftJustPressed || inp.downJustPressed) {
          this.mapCursor = Math.max(0, this.mapCursor - 1);
          this.audio.kick();
        }
        if (inp.confirmJustPressed) this.enterOverworldNode();
        if (inp.pauseJustPressed) this.state = GAME_STATE.TITLE;
      } else if (this.state === GAME_STATE.TOAD_HOUSE) {
        this.audio.playTrack('map');
        if (this.toadState.openedIdx === -1) {
          if (inp.leftJustPressed) { this.toadState.cursor = (this.toadState.cursor + 2) % 3; this.audio.kick(); }
          if (inp.rightJustPressed) { this.toadState.cursor = (this.toadState.cursor + 1) % 3; this.audio.kick(); }
          if (inp.confirmJustPressed) this.openToadChest();
        } else if (inp.confirmJustPressed || inp.pauseJustPressed) {
          this.state = GAME_STATE.OVERWORLD;
        }
        if (inp.pauseJustPressed && this.toadState.openedIdx === -1) {
          this.state = GAME_STATE.OVERWORLD;
        }
      } else if (this.state === GAME_STATE.PLAYING) {
        if (inp.pauseJustPressed) {
          this.pauseIdx = 0;
          this.state = GAME_STATE.PAUSED;
          this.audio.pause();
          return;
        }
        this.world.update(dt, inp);
        // Music track selection
        if (!this.world.goalTriggered && this.world.player.state === 'normal') {
          if (this.world.player.starTimer > 0) {
            this.audio.playTrack('star', 1.0);
          } else {
            const speed = this.world.timeLeft < 100 || this.world.pSwitchTimer > 0 ? 1.26 : 1.0;
            this.audio.playTrack(this.world.area.biome, speed);
          }
        }
      } else if (this.state === GAME_STATE.PAUSED) {
        if (inp.pauseJustPressed) { this.state = GAME_STATE.PLAYING; return; }
        if (inp.upJustPressed) { this.pauseIdx = (this.pauseIdx + 2) % 3; this.audio.kick(); }
        if (inp.downJustPressed) { this.pauseIdx = (this.pauseIdx + 1) % 3; this.audio.kick(); }
        if (inp.confirmJustPressed) this.confirmPauseOption();
      } else if (
        this.state === GAME_STATE.STAGE_CLEAR ||
        this.state === GAME_STATE.GAME_OVER ||
        this.state === GAME_STATE.VICTORY
      ) {
        if (inp.confirmJustPressed) this.advanceAfterOutcome();
      }

      this.audio.update(dt);
    }

    render() {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      if (this.state === GAME_STATE.TITLE) {
        this.renderer.renderTitle(ctx, this.menuIdx, this.save, this.time);
      } else if (this.state === GAME_STATE.OVERWORLD) {
        this.renderer.renderOverworld(ctx, this.nodes, this.mapCursor, this.save, this.time);
      } else if (this.state === GAME_STATE.TOAD_HOUSE) {
        this.renderer.renderToadHouse(ctx, this.toadState, this.time);
      } else if (this.world) {
        this.renderer.renderWorld(
          ctx,
          this.world,
          { score: this.score, coins: this.coins, lives: this.lives },
          { lighting: this.save.settings.lighting }
        );
        if (this.state === GAME_STATE.PAUSED) {
          this.renderer.renderOverlay(ctx, 'PAUSED', { pauseIdx: this.pauseIdx }, this.time);
        } else if (this.state === GAME_STATE.STAGE_CLEAR) {
          this.renderer.renderOverlay(ctx, 'STAGE_CLEAR', this.clearData, this.time);
        } else if (this.state === GAME_STATE.GAME_OVER) {
          this.renderer.renderOverlay(ctx, 'GAME_OVER', {}, this.time);
        } else if (this.state === GAME_STATE.VICTORY) {
          const totalStars = this.save.starCoins.reduce((acc, arr) => acc + arr.filter(Boolean).length, 0);
          this.renderer.renderOverlay(ctx, 'VICTORY', { score: this.score, totalStars }, this.time);
        }
      }
    }

    start() {
      const loop = (now) => {
        if (!this.lastTime) this.lastTime = now;
        const elapsed = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
        this.lastTime = now;
        this.accum += elapsed;
        while (this.accum >= FIXED_DT) {
          this.stepFixed(FIXED_DT);
          this.accum -= FIXED_DT;
        }
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    getSnapshot() {
      return {
        state: this.state,
        score: this.score,
        coins: this.coins,
        lives: this.lives,
        stageCode: this.world ? this.world.stage.code : null,
        area: this.world ? this.world.currentAreaName : null,
        player: this.world ? {
          x: this.world.player.x,
          y: this.world.player.y,
          vx: this.world.player.vx,
          vy: this.world.player.vy,
          power: this.world.player.power,
          reserveItem: this.world.player.reserveItem,
          onGround: this.world.player.onGround,
          state: this.world.player.state,
        } : null,
        starCoinsCollected: this.world ? [...this.world.collectedStarCoins] : [],
        bowserHp: this.world?.areaState?.bowser ? this.world.areaState.bowser.hp : null,
      };
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const app = new MarioApp();
    app.start();
    global.__MARIO_GAME__ = app;
  });
})(window);

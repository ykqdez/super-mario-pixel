(function (global) {
  'use strict';

  const { TILE, TILE_SIZE, POWER, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, BIOME } = global.MarioGame.CONSTANTS;

  class GameRenderer {
    constructor(sprites) {
      this.sprites = sprites;
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = VIRTUAL_WIDTH;
      this.lightCanvas.height = VIRTUAL_HEIGHT;
      this.lightCtx = this.lightCanvas.getContext('2d');
    }

    drawTextShadow(ctx, text, x, y, color = '#ffffff', align = 'left', font = 'bold 9px monospace') {
      ctx.font = font;
      ctx.textAlign = align;
      ctx.fillStyle = '#0c0e18';
      ctx.fillText(text, x, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }

    renderWorld(ctx, world, hudData, options = {}) {
      const area = world.area;
      const biome = area.biome;
      const t = world.animTime;

      ctx.save();
      let camX = Math.round(world.cameraX);
      let camY = Math.round(world.cameraY);
      if (world.shakeTimer > 0 && world.shakeIntensity > 0) {
        camX += Math.round((Math.random() - 0.5) * world.shakeIntensity * 2);
        camY += Math.round((Math.random() - 0.5) * world.shakeIntensity * 2);
      }

      // 1. Background Sky & Parallax
      this.drawBackground(ctx, biome, camX, t);

      // 2. Decorative Background Scenery (Oak trees, Bushes, Torches, Castle)
      this.drawScenery(ctx, world, camX, camY, t);

      // 3. Goal Flagpole & Checkpoint & Peach & Signs
      this.drawWorldMarkers(ctx, world, camX, camY, t);

      // 3.5 Piranha Plants (drawn BEFORE tiles so pipes cleanly mask emerging stems!)
      this.drawPiranhaPlants(ctx, world, camX, camY);

      // 4. Tiles
      this.drawTiles(ctx, world, camX, camY, t);

      // 5. Interactive Objects (Platforms, Springs, P-Switches, Star Coins, Items)
      this.drawObjects(ctx, world, camX, camY, t);

      // 6. Enemies, Thwomps, Firebars, Bowser, Projectiles
      this.drawEnemiesAndBoss(ctx, world, camX, camY, t);

      // 7. Player (Mario)
      if (!world.player.hidden) {
        this.drawMario(ctx, world.player, camX, camY, t);
      }

      // 8. Re-draw pipe tops over Mario while entering pipe for authentic depth!
      if (world.player.state === 'pipe' && area.pipes) {
        for (const p of area.pipes) {
          const sx = p.tx * TILE_SIZE - camX;
          const sy = p.ty * TILE_SIZE - camY;
          const pName = p.color === 'gold' ? 'gold' : 'green';
          ctx.drawImage(this.sprites.tiles[`pipe_${pName}_tl`], sx, sy);
          ctx.drawImage(this.sprites.tiles[`pipe_${pName}_tr`], sx + 16, sy);
        }
      }

      // 9. Particles & Floating Score Popups
      world.particles.render(ctx, camX, camY);

      // 10. Dynamic Lighting (Cavern & Castle)
      if (options.lighting !== false && (biome === BIOME.CAVERN || biome === BIOME.CASTLE)) {
        this.drawLighting(ctx, world, camX, camY, biome);
      }

      // 11. Signpost Proximity Bubble
      this.drawNearbySign(ctx, world, camX, camY);

      // 12. HUD
      this.drawHUD(ctx, world, hudData, t);

      // 13. Iris Transition Wipe
      if (world.iris.active) {
        this.drawIris(ctx, world.iris);
      }

      ctx.restore();
    }

    drawBackground(ctx, biome, camX, t) {
      const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      if (biome === BIOME.MEADOW) {
        grad.addColorStop(0, '#4c88f8');
        grad.addColorStop(0.7, '#84c4ff');
        grad.addColorStop(1, '#c0e4ff');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // Distant Mountains / Hills
        const hillShift = -(camX * 0.22) % 240;
        ctx.fillStyle = '#48a468';
        for (let x = hillShift - 240; x < VIRTUAL_WIDTH + 240; x += 240) {
          this.drawPixelHill(ctx, x, 240, 140, 62, '#4ea860', '#70cc7a');
          this.drawPixelHill(ctx, x + 130, 240, 100, 44, '#3c9050', '#5eb86c');
        }
        // Parallax Clouds
        const cloudShift = -(camX * 0.12 + t * 8) % 180;
        for (let x = cloudShift - 180; x < VIRTUAL_WIDTH + 180; x += 180) {
          ctx.drawImage(this.sprites.scenery.cloud, Math.round(x + 20), 34);
          ctx.drawImage(this.sprites.scenery.cloud, Math.round(x + 110), 62);
        }
      } else if (biome === BIOME.CAVERN) {
        grad.addColorStop(0, '#090e1c');
        grad.addColorStop(1, '#14203c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // Glowing distant crystal silhouettes
        const shift = -(camX * 0.2) % 160;
        for (let x = shift - 160; x < VIRTUAL_WIDTH + 160; x += 160) {
          ctx.fillStyle = '#1b3158';
          ctx.fillRect(x + 20, 40, 12, 190);
          ctx.fillRect(x + 95, 65, 16, 165);
          // cyan crystal clusters
          ctx.fillStyle = '#2874a8';
          ctx.fillRect(x + 56, 175, 6, 22);
          ctx.fillRect(x + 64, 183, 5, 14);
          ctx.fillStyle = '#50c8ff';
          ctx.fillRect(x + 57, 177, 2, 10);
        }
      } else if (biome === BIOME.SKY) {
        grad.addColorStop(0, '#2a72e8');
        grad.addColorStop(0.55, '#7cc6ff');
        grad.addColorStop(1, '#ffe4b4');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // Floating distant oak islands & clouds
        const shift = -(camX * 0.16 + t * 10) % 220;
        for (let x = shift - 220; x < VIRTUAL_WIDTH + 220; x += 220) {
          ctx.drawImage(this.sprites.scenery.cloud, Math.round(x + 15), 42);
          ctx.drawImage(this.sprites.scenery.cloud, Math.round(x + 125), 88);
          ctx.fillStyle = '#6ca8e8';
          ctx.fillRect(Math.round(x + 65), 178, 52, 8);
          ctx.fillStyle = '#8cc4ff';
          ctx.fillRect(Math.round(x + 73), 186, 36, 6);
        }
      } else if (biome === BIOME.CASTLE) {
        grad.addColorStop(0, '#140b0e');
        grad.addColorStop(0.7, '#281114');
        grad.addColorStop(1, '#581a0c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // Castle arches & flickering torches
        const shift = -(camX * 0.3) % 128;
        for (let x = shift - 128; x < VIRTUAL_WIDTH + 128; x += 128) {
          ctx.fillStyle = '#241418';
          ctx.fillRect(x + 18, 48, 36, 150);
          ctx.fillStyle = '#12080a';
          ctx.fillRect(x + 26, 64, 20, 44);
          // Torch
          ctx.fillStyle = '#6a3818';
          ctx.fillRect(x + 90, 96, 4, 16);
          const fl = Math.floor(t * 10 + x) % 2;
          ctx.fillStyle = fl ? '#ff7818' : '#ffd838';
          ctx.fillRect(x + 89, 88 - fl, 6, 8);
        }
      }
    }

    drawPixelHill(ctx, x, baseY, w, h, col, hiCol) {
      ctx.fillStyle = col;
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const frac = (i + 1) / steps;
        const rw = Math.round(w * (1 - i * 0.14));
        const rx = Math.round(x + (w - rw) / 2);
        const ry = Math.round(baseY - h * frac);
        ctx.fillRect(rx, ry, rw, Math.ceil(h / steps) + 1);
      }
      ctx.fillStyle = hiCol;
      ctx.fillRect(Math.round(x + w * 0.34), Math.round(baseY - h * 0.85), Math.round(w * 0.18), 4);
    }

    drawScenery(ctx, world, camX, camY, t) {
      const area = world.area;
      if (area.biome === BIOME.MEADOW || area.biome === BIOME.SKY) {
        const findGroundTop = (tx) => {
          for (let ty = 8; ty <= 15; ty++) {
            if (area.grid[ty] && area.grid[ty][tx] === TILE.GROUND && area.grid[ty - 1] && area.grid[ty - 1][tx] === TILE.EMPTY) {
              return ty;
            }
          }
          return -1;
        };
        // Place deterministic scenic Oak Trees & bushes where flat solid ground exists
        const step = 14;
        for (let tx = 4; tx < area.width - 14; tx += step) {
          const gy = findGroundTop(tx);
          if (gy > 0 && findGroundTop(tx + 1) === gy && findGroundTop(tx + 2) === gy) {
            const sx = tx * TILE_SIZE - camX;
            const sy = gy * TILE_SIZE - 64 - camY;
            if (sx > -64 && sx < VIRTUAL_WIDTH + 64) {
              ctx.drawImage(this.sprites.scenery.oak_tree, sx, sy);
            }
          }
          const btx = tx + 6;
          const bgy = btx < area.width - 12 ? findGroundTop(btx) : -1;
          if (bgy > 0 && findGroundTop(btx + 1) === bgy) {
            const bx = btx * TILE_SIZE - camX;
            const by = bgy * TILE_SIZE - 16 - camY;
            if (bx > -40 && bx < VIRTUAL_WIDTH + 40) {
              ctx.drawImage(this.sprites.scenery.bush, bx, by);
            }
          }
        }
      }

      // End Castle
      if (area.goal && area.goal.castleTx) {
        const cx = area.goal.castleTx * TILE_SIZE - camX;
        const cy = (area.goal.ty + 1) * TILE_SIZE - 80 - camY;
        ctx.drawImage(this.sprites.scenery.castle, cx, cy);
      }
    }

    drawWorldMarkers(ctx, world, camX, camY, t) {
      const area = world.area;
      // Signs
      if (area.signs) {
        for (const sg of area.signs) {
          const sx = sg.tx * TILE_SIZE - camX;
          const sy = sg.ty * TILE_SIZE - camY;
          if (sx < -24 || sx > VIRTUAL_WIDTH + 24) continue;
          ctx.fillStyle = '#5a2c0e';
          ctx.fillRect(sx + 7, sy + 6, 2, 10);
          ctx.fillStyle = '#c87c38';
          ctx.fillRect(sx + 1, sy, 14, 9);
          ctx.fillStyle = '#ffe0a0';
          ctx.fillRect(sx + 3, sy + 2, 10, 1);
          ctx.fillRect(sx + 3, sy + 5, 8, 1);
        }
      }

      // Checkpoint Flag
      if (area.checkpoint) {
        const cp = area.checkpoint;
        const sx = cp.tx * TILE_SIZE - camX;
        const sy = cp.ty * TILE_SIZE - camY;
        if (sx > -32 && sx < VIRTUAL_WIDTH + 32) {
          ctx.fillStyle = '#384050';
          ctx.fillRect(sx + 7, sy - 24, 2, 40);
          ctx.fillStyle = '#ffd838';
          ctx.fillRect(sx + 6, sy - 27, 4, 4);
          const flagY = world.checkpointReached ? sy - 22 : sy - 2;
          ctx.fillStyle = world.checkpointReached ? '#e83020' : '#404858';
          ctx.fillRect(sx + 9, flagY, 12, 9);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx + 12, flagY + 2, 5, 5);
        }
      }

      // Goal Flagpole
      if (area.goal && area.goal.type === 'flagpole') {
        const g = area.goal;
        const sx = g.tx * TILE_SIZE - camX;
        const baseY = (g.ty + 1) * TILE_SIZE - camY;
        const topY = (g.ty - 9) * TILE_SIZE - camY;
        ctx.fillStyle = '#303840';
        ctx.fillRect(sx + 5, baseY - 12, 6, 12);
        ctx.fillStyle = '#d8e8f8';
        ctx.fillRect(sx + 7, topY, 2, baseY - topY - 12);
        ctx.fillStyle = '#ffd838';
        ctx.fillRect(sx + 5, topY - 4, 6, 6);
        // Flag
        const fy = Math.round(world.flagY - camY);
        ctx.fillStyle = '#28c038';
        ctx.fillRect(sx - 10, fy, 17, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 5, fy + 3, 6, 6);
      }

      // Goal Axe & Princess Peach (1-4)
      if (area.goal && area.goal.type === 'bowser_arena') {
        const g = area.goal;
        if (world.getTile(g.axeTx, g.axeTy) !== TILE.EMPTY || !world.goalTriggered) {
          const ax = g.axeTx * TILE_SIZE - camX;
          const ay = g.axeTy * TILE_SIZE - camY;
          const af = Math.floor(t * 5) % 2;
          ctx.drawImage(this.sprites.tiles[`axe_${af}`], ax, ay);
        }
        const px = g.peachTx * TILE_SIZE - camX;
        const py = g.peachTy * TILE_SIZE - 8 - camY;
        ctx.drawImage(this.sprites.enemies.peach.L, px, py);
        if (world.player.state === 'peach_done') {
          ctx.fillStyle = '#ff5088';
          ctx.fillRect(px + 5, py - 12 - Math.round(Math.sin(t * 6) * 2), 6, 5);
        }
      }
    }

    drawTiles(ctx, world, camX, camY, t) {
      const area = world.area;
      const biome = area.biome;
      const startTx = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
      const endTx = Math.min(area.width - 1, Math.ceil((camX + VIRTUAL_WIDTH) / TILE_SIZE) + 1);
      const qFrame = Math.floor(t * 6) % 3;
      const coinFrame = [1, 2, 3, 2][Math.floor(t * 8) % 4];
      const lavaFrame = Math.floor(t * 4) % 2;

      // Pipe lookup for gold pipe coloring
      const goldPipeCoords = new Set();
      if (area.pipes) {
        for (const p of area.pipes) {
          if (p.color === 'gold') {
            goldPipeCoords.add(`${p.tx},${p.ty}`);
            goldPipeCoords.add(`${p.tx + 1},${p.ty}`);
            for (let yy = p.ty + 1; yy < area.height; yy++) {
              goldPipeCoords.add(`${p.tx},${yy}`);
              goldPipeCoords.add(`${p.tx + 1},${yy}`);
            }
          }
        }
      }

      for (let ty = 0; ty < area.height; ty++) {
        for (let tx = startTx; tx <= endTx; tx++) {
          let tile = world.grid[ty][tx];
          if (tile === TILE.EMPTY || tile === TILE.HIDDEN) continue;

          if (world.pSwitchTimer > 0) {
            if (tile === TILE.BRICK) tile = TILE.COIN;
            else if (tile === TILE.COIN) tile = TILE.BRICK;
          }

          let sx = tx * TILE_SIZE - camX;
          let sy = ty * TILE_SIZE - camY;

          const bump = world.areaState.blockBumps[`${tx},${ty}`];
          if (bump) {
            const p = bump.timer / 0.18;
            sy += Math.round(Math.sin(p * Math.PI) * 5 * bump.dir);
          }

          if (tile === TILE.DONUT) {
            const dn = world.areaState.donuts[`${tx},${ty}`];
            if (dn) {
              if (dn.fallen) sy += Math.round(dn.fallY);
              else sx += Math.round(Math.sin(t * 50) * 1.5);
            }
            ctx.drawImage(this.sprites.tiles.donut, sx, sy);
            continue;
          }

          let img = null;
          switch (tile) {
            case TILE.GROUND: img = this.sprites.tiles[`ground_${biome}`]; break;
            case TILE.GROUND_DEEP: img = this.sprites.tiles[`deep_${biome}`]; break;
            case TILE.BRICK: img = this.sprites.tiles[`brick_${biome}`]; break;
            case TILE.QUESTION: img = this.sprites.tiles[`question_${qFrame}`]; break;
            case TILE.USED: img = this.sprites.tiles.used; break;
            case TILE.HARD: img = this.sprites.tiles.hard; break;
            case TILE.ONEWAY: img = this.sprites.tiles.oneway; break;
            case TILE.BRIDGE: img = this.sprites.tiles.bridge; break;
            case TILE.BOUNCE_CAP: img = this.sprites.tiles.bounce_cap; break;
            case TILE.ICE: img = this.sprites.tiles.ice; break;
            case TILE.POW_BLOCK: img = this.sprites.tiles.pow; break;
            case TILE.SPIKE: img = this.sprites.tiles.spike; break;
            case TILE.LAVA_TOP: img = this.sprites.tiles[`lava_top_${lavaFrame}`]; break;
            case TILE.LAVA_BODY: img = this.sprites.tiles.lava_body; break;
            case TILE.ON_OFF_SWITCH:
              img = this.sprites.tiles[world.onOffState ? 'onoff_red' : 'onoff_blue'];
              break;
            case TILE.RED_BLOCK:
              img = this.sprites.tiles[world.onOffState ? 'red_solid' : 'red_ghost'];
              break;
            case TILE.BLUE_BLOCK:
              img = this.sprites.tiles[!world.onOffState ? 'blue_solid' : 'blue_ghost'];
              break;
            case TILE.COIN:
              img = this.sprites.items[`coin_${coinFrame}`];
              break;
            case TILE.PIPE_TL:
            case TILE.PIPE_TR:
            case TILE.PIPE_BL:
            case TILE.PIPE_BR: {
              const pCol = goldPipeCoords.has(`${tx},${ty}`) ? 'gold' : 'green';
              const suf = tile === TILE.PIPE_TL ? 'tl' : tile === TILE.PIPE_TR ? 'tr' : tile === TILE.PIPE_BL ? 'bl' : 'br';
              img = this.sprites.tiles[`pipe_${pCol}_${suf}`];
              break;
            }
          }
          if (img) ctx.drawImage(img, sx, sy);
        }
      }

      // Bill Blaster visuals
      for (const bl of world.areaState.blasters) {
        ctx.drawImage(this.sprites.tiles.blaster, bl.x - camX, bl.y - camY);
      }
    }

    drawObjects(ctx, world, camX, camY, t) {
      // Moving Platforms
      for (const plat of world.areaState.platforms) {
        const px = Math.round(plat.x - camX);
        const py = Math.round(plat.y - camY);
        ctx.fillStyle = '#40200c';
        ctx.fillRect(px, py, plat.w, plat.h);
        ctx.fillStyle = '#e8a840';
        ctx.fillRect(px + 1, py + 1, plat.w - 2, plat.h - 2);
        ctx.fillStyle = '#fff0a0';
        ctx.fillRect(px + 2, py + 1, plat.w - 4, 2);
      }

      // Springs
      for (const sp of world.areaState.springs) {
        const frame = sp.animTimer > 0 ? 1 : 0;
        ctx.drawImage(this.sprites.tiles[`spring_${frame}`], sp.x - camX, sp.y - camY);
      }

      // P-Switches
      for (const ps of world.areaState.pswitchObjs) {
        ctx.drawImage(this.sprites.tiles[`pswitch_${ps.pressed ? 1 : 0}`], ps.x - camX, ps.y - camY);
      }

      // Star Coins
      const scFrame = Math.floor(t * 5) % 2 === 0 ? 'star_coin_1' : 'star_coin_2';
      for (const sc of world.areaState.starCoins) {
        if (sc.collected) continue;
        const bob = Math.round(Math.sin(t * 4 + sc.x * 0.05) * 2);
        ctx.drawImage(this.sprites.items[scFrame], sc.x - camX, sc.y - camY + bob);
      }

      // Items
      for (const it of world.areaState.items) {
        let img = null;
        if (it.kind === 'mushroom') img = this.sprites.items.mushroom_super;
        else if (it.kind === '1up') img = this.sprites.items.mushroom_1up;
        else if (it.kind === 'acorn') img = this.sprites.items.super_acorn;
        else if (it.kind === 'fire') img = this.sprites.items[`fire_flower_${Math.floor(t * 8) % 2 + 1}`];
        else if (it.kind === 'star') img = this.sprites.items[`starman_${Math.floor(t * 10) % 2 + 1}`];
        if (img) ctx.drawImage(img, Math.round(it.x - camX), Math.round(it.y - camY));
      }
    }

    drawPiranhaPlants(ctx, world, camX, camY) {
      for (const e of world.areaState.enemies) {
        if (e.type !== 'piranha' || e.dead) continue;
        const sx = Math.round(e.x - camX);
        const sy = Math.round(e.y - camY);
        if (sx < -32 || sx > VIRTUAL_WIDTH + 32) continue;
        if (e.y >= e.baseY - 1) continue; // completely tucked inside pipe
        const dirKey = e.dir >= 0 ? 'R' : 'L';
        const wf = Math.floor(e.animTimer * 6) % 2 + 1;
        const sprite = this.sprites.enemies[`piranha_${wf}`][dirKey];
        ctx.drawImage(sprite, sx, sy);
      }
    }

    drawEnemiesAndBoss(ctx, world, camX, camY, t) {
      // Firebars
      for (const fb of world.areaState.firebars) {
        const cx = Math.round(fb.cx - camX);
        const cy = Math.round(fb.cy - camY);
        ctx.fillStyle = '#ff9820';
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
        for (let i = 1; i <= fb.len; i++) {
          const fx = Math.round(fb.cx + Math.cos(fb.angle) * i * 10 - camX);
          const fy = Math.round(fb.cy + Math.sin(fb.angle) * i * 10 - camY);
          ctx.fillStyle = '#ff4810';
          ctx.fillRect(fx - 4, fy - 4, 8, 8);
          ctx.fillStyle = '#ffe848';
          ctx.fillRect(fx - 2, fy - 2, 4, 4);
        }
      }

      // Thwomps
      for (const th of world.areaState.thwomps) {
        const img = th.state === 'idle' ? this.sprites.enemies.thwomp_calm : this.sprites.enemies.thwomp_mad;
        ctx.drawImage(img, Math.round(th.x - camX), Math.round(th.y - camY));
      }

      // Enemies
      for (const e of world.areaState.enemies) {
        if (e.type === 'piranha') continue;
        const sx = Math.round(e.x - camX);
        const sy = Math.round(e.y - camY);
        if (sx < -32 || sx > VIRTUAL_WIDTH + 32) continue;

        const dirKey = e.dir >= 0 ? 'R' : 'L';
        const wf = Math.floor(e.animTimer * 6) % 2 + 1;
        let sprite = null;

        if (e.type === 'goomba') {
          sprite = this.sprites.enemies[e.state === 'squashed' ? 'goomba_flat' : `goomba_${wf}`][dirKey];
        } else if (e.type === 'koopa_g' || e.type === 'koopa_r' || e.type === 'paratroopa') {
          const pref = e.type === 'koopa_r' ? 'koopa_r_' : 'koopa_g_';
          if (e.state === 'shell') sprite = this.sprites.enemies[pref + 'shell'][dirKey];
          else if (e.state === 'shell_spin') sprite = this.sprites.enemies[pref + (wf === 1 ? 'shell' : 'spin')][dirKey];
          else sprite = this.sprites.enemies[pref + wf][dirKey];
        } else if (e.type === 'beetle') {
          sprite = this.sprites.enemies[e.state === 'shell' || e.state === 'shell_spin' ? 'beetle_shell' : `beetle_${wf}`][dirKey];
        } else if (e.type === 'spiny') {
          sprite = this.sprites.enemies[`spiny_${wf}`][dirKey];
        } else if (e.type === 'bullet') {
          sprite = this.sprites.enemies.bullet_bill[dirKey];
        } else if (e.type === 'drybones') {
          sprite = this.sprites.enemies[e.state === 'pile' ? 'drybones_pile' : `drybones_${wf}`][dirKey];
        }

        if (sprite) {
          ctx.save();
          if (e.state === 'flipped') {
            ctx.translate(sx + 8, sy + 8);
            ctx.scale(1, -1);
            ctx.drawImage(sprite, -8, -8);
          } else {
            ctx.drawImage(sprite, sx, sy);
          }
          // Paratroopa cute flapping wings!
          if (e.type === 'paratroopa' && e.state === 'walk') {
            const wingY = sy + (wf === 1 ? 1 : 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx + (e.dir < 0 ? 11 : -2), wingY, 5, 4);
          }
          ctx.restore();
        }
      }

      // Bowser
      const bow = world.areaState.bowser;
      if (bow && !bow.removed) {
        if (bow.hurtFlash <= 0 || Math.floor(t * 25) % 2 === 0) {
          const dirKey = bow.facing >= 0 ? 'R' : 'L';
          const pose = bow.roarTimer > 0 ? 'bowser_roar' : 'bowser_idle1';
          ctx.drawImage(this.sprites.enemies[pose][dirKey], Math.round(bow.x - camX - 2), Math.round(bow.y - camY - 2));
        }
      }

      // Mario Fireballs
      for (const fb of world.areaState.fireballs) {
        const fx = Math.round(fb.x - camX);
        const fy = Math.round(fb.y - camY);
        ctx.fillStyle = '#ff5810';
        ctx.fillRect(fx, fy, 8, 8);
        ctx.fillStyle = '#ffe848';
        ctx.fillRect(fx + 2, fy + 2, 4, 4);
      }

      // Bowser Enemy Fireballs & Hammers
      for (const ef of world.areaState.enemyFireballs) {
        const fx = Math.round(ef.x - camX);
        const fy = Math.round(ef.y - camY);
        ctx.fillStyle = '#ff3800';
        ctx.fillRect(fx, fy + 1, 14, 8);
        ctx.fillStyle = '#ffd830';
        ctx.fillRect(fx + 3, fy + 3, 8, 4);
      }
      for (const hm of world.areaState.hammers) {
        const hx = Math.round(hm.x - camX);
        const hy = Math.round(hm.y - camY);
        ctx.save();
        ctx.translate(hx + 5, hy + 5);
        ctx.rotate(t * 14);
        ctx.fillStyle = '#8c4c18';
        ctx.fillRect(-1, -5, 3, 10);
        ctx.fillStyle = '#b0b8c8';
        ctx.fillRect(-4, -5, 8, 4);
        ctx.restore();
      }
    }

    drawMario(ctx, p, camX, camY, t) {
      if (p.invulnTimer > 0 && p.starTimer <= 0 && Math.floor(p.invulnTimer * 18) % 2 === 1) {
        return;
      }

      let formKey = 'normal';
      if (p.starTimer > 0) {
        formKey = 'star' + (Math.floor(t * 16) % 4);
      } else if (p.power === POWER.FIRE) {
        formKey = 'fire';
      } else if (p.power === POWER.ACORN) {
        formKey = 'acorn';
      }

      const sizeKey = p.power === POWER.SMALL ? 'small' : 'big';
      let pose = 'idle';
      if (p.state === 'dying') pose = 'dead';
      else if (p.tailSpinTimer > 0 || p.groundPound) pose = sizeKey === 'big' ? 'spin' : 'jump';
      else if (p.crouching) pose = 'crouch';
      else if (!p.onGround) pose = p.vy > 20 && sizeKey === 'big' ? 'fall' : 'jump';
      else if (p.skidding) pose = 'skid';
      else if (Math.abs(p.vx) > 6) pose = 'walk' + ((Math.floor(p.walkFrame) % 3) + 1);

      const dirKey = p.facing >= 0 ? 'R' : 'L';
      const set = this.sprites.mario[formKey][sizeKey];
      const sprite = (set[pose] || set.idle)[dirKey];

      const sx = Math.round(p.x - camX - 2);
      const sy = Math.round(p.y + p.h - (sizeKey === 'small' ? 15 : 22) - camY);

      // Draw Acorn Suit fluffy striped tail!
      if (p.power === POWER.ACORN && p.state !== 'dying') {
        const tailWag = p.isGliding ? Math.sin(t * 32) * 2 : Math.sin(t * 8) * 1;
        const tx = p.facing > 0 ? sx - 3 : sx + 13;
        const ty = sy + 12 + Math.round(tailWag);
        ctx.fillStyle = '#4a2208';
        ctx.fillRect(tx, ty, 6, 5);
        ctx.fillStyle = '#c46b22';
        ctx.fillRect(tx + 1, ty + 1, 4, 3);
        ctx.fillStyle = '#ffe89a';
        ctx.fillRect(tx + 2, ty + 1, 2, 3);
      }

      ctx.drawImage(sprite, sx, sy);
    }

    drawLighting(ctx, world, camX, camY, biome) {
      const lctx = this.lightCtx;
      lctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      lctx.fillStyle = biome === BIOME.CASTLE ? 'rgba(18, 6, 8, 0.36)' : 'rgba(6, 10, 26, 0.44)';
      lctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      lctx.globalCompositeOperation = 'destination-out';
      const punch = (wx, wy, r) => {
        const sx = wx - camX;
        const sy = wy - camY;
        if (sx < -r || sx > VIRTUAL_WIDTH + r) return;
        const g = lctx.createRadialGradient(sx, sy, r * 0.15, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath();
        lctx.arc(sx, sy, r, 0, Math.PI * 2);
        lctx.fill();
      };

      punch(world.player.x + 6, world.player.y + 10, 74);
      for (const fb of world.areaState.fireballs) punch(fb.x + 4, fb.y + 4, 38);
      for (const ef of world.areaState.enemyFireballs) punch(ef.x + 7, ef.y + 5, 42);
      for (const sc of world.areaState.starCoins) {
        if (!sc.collected) punch(sc.x + 8, sc.y + 8, 34);
      }
      if (biome === BIOME.CASTLE) {
        // Warm glow from bottom lava line
        const lg = lctx.createLinearGradient(0, 210, 0, VIRTUAL_HEIGHT);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(1, 'rgba(0,0,0,0.85)');
        lctx.fillStyle = lg;
        lctx.fillRect(0, 210, VIRTUAL_WIDTH, 62);
      }

      lctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.lightCanvas, 0, 0);
    }

    drawNearbySign(ctx, world, camX, camY) {
      if (!world.area.signs) return;
      for (const sg of world.area.signs) {
        const wx = sg.tx * TILE_SIZE + 8;
        const wy = sg.ty * TILE_SIZE;
        if (Math.abs(world.player.x + 6 - wx) < 34 && Math.abs(world.player.y + world.player.h - wy - 16) < 28) {
          const bx = Math.max(8, Math.min(VIRTUAL_WIDTH - 196, Math.round(wx - camX - 94)));
          const by = Math.max(32, Math.round(wy - camY - 26));
          ctx.fillStyle = 'rgba(14, 18, 34, 0.88)';
          ctx.fillRect(bx, by, 188, 18);
          ctx.strokeStyle = '#ffd838';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 0.5, by + 0.5, 187, 17);
          this.drawTextShadow(ctx, sg.text, bx + 94, by + 12, '#fff6cc', 'center', 'bold 9px "Microsoft YaHei", sans-serif');
        }
      }
    }

    drawHUD(ctx, world, hudData, t) {
      // Top translucent backdrop strip
      ctx.fillStyle = 'rgba(8, 10, 20, 0.45)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, 26);

      // Score
      this.drawTextShadow(ctx, 'MARIO', 10, 10, '#ffd838', 'left', 'bold 8px monospace');
      this.drawTextShadow(ctx, String(hudData.score).padStart(6, '0'), 10, 20, '#ffffff', 'left', 'bold 9px monospace');

      // Coins
      ctx.drawImage(this.sprites.items.coin_1, 76, 5, 12, 12);
      this.drawTextShadow(ctx, `×${String(hudData.coins).padStart(2, '0')}`, 90, 16, '#ffd838', 'left', 'bold 9px monospace');

      // World & Star Coins
      this.drawTextShadow(ctx, `WORLD ${world.stage.code}`, 142, 10, '#a0d4ff', 'left', 'bold 8px monospace');
      for (let i = 0; i < 3; i++) {
        const has = world.collectedStarCoins.has(i);
        ctx.fillStyle = has ? '#ffd838' : '#3a4258';
        ctx.fillRect(144 + i * 13, 13, 9, 9);
        ctx.fillStyle = has ? '#ffffff' : '#1c2030';
        ctx.fillRect(147 + i * 13, 16, 3, 3);
      }

      // Reserve Item Box (Center)
      const rbx = 229;
      ctx.fillStyle = '#141828';
      ctx.fillRect(rbx, 2, 22, 22);
      ctx.strokeStyle = '#ffd838';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rbx + 0.5, 2.5, 21, 21);
      if (world.player.reserveItem) {
        const rk = world.player.reserveItem;
        const rImg = rk === 'mushroom' ? this.sprites.items.mushroom_super
          : rk === 'fire' ? this.sprites.items.fire_flower_1
          : this.sprites.items.super_acorn;
        ctx.drawImage(rImg, rbx + 3, 5);
      }

      // Power badge
      const pNames = { small: 'SMALL', super: 'SUPER', fire: 'FIRE', acorn: 'ACORN' };
      const pCols = { small: '#c8d0e0', super: '#ff7050', fire: '#ffe898', acorn: '#ffb850' };
      this.drawTextShadow(ctx, pNames[world.player.power], 262, 10, pCols[world.player.power], 'left', 'bold 8px monospace');
      if (world.player.starTimer > 0) {
        this.drawTextShadow(ctx, `STAR ${world.player.starTimer.toFixed(1)}s`, 262, 20, '#60ff90', 'left', 'bold 8px monospace');
      } else if (world.pSwitchTimer > 0) {
        this.drawTextShadow(ctx, `P-SW ${world.pSwitchTimer.toFixed(1)}s`, 262, 20, '#60d0ff', 'left', 'bold 8px monospace');
      } else {
        this.drawTextShadow(ctx, '[E] ITEM', 262, 20, '#a8b6d8', 'left', 'bold 8px monospace');
      }

      // Lives
      this.drawTextShadow(ctx, `♥×${hudData.lives}`, 342, 16, '#ff8090', 'left', 'bold 9px monospace');

      // Time
      this.drawTextShadow(ctx, 'TIME', 416, 10, '#ffd838', 'left', 'bold 8px monospace');
      const sec = Math.ceil(world.timeLeft);
      this.drawTextShadow(ctx, String(sec).padStart(3, '0'), 418, 20, sec < 100 ? '#ff5848' : '#ffffff', 'left', 'bold 9px monospace');

      // Bowser Boss HP Bar
      const bow = world.areaState.bowser;
      if (bow && bow.active && !bow.dead) {
        const bx = 135;
        const by = 28;
        ctx.fillStyle = 'rgba(10, 6, 8, 0.8)';
        ctx.fillRect(bx, by, 210, 12);
        this.drawTextShadow(ctx, 'BOWSER', bx + 4, by + 9, '#ff6840', 'left', 'bold 8px monospace');
        ctx.fillStyle = '#381818';
        ctx.fillRect(bx + 54, by + 3, 148, 6);
        const pct = Math.max(0, bow.hp / bow.maxHp);
        ctx.fillStyle = pct > 0.5 ? '#ff5820' : '#ff2020';
        ctx.fillRect(bx + 54, by + 3, Math.round(148 * pct), 6);
      }
    }

    drawIris(ctx, iris) {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.arc(iris.cx, iris.cy, Math.max(1, iris.radius), 0, Math.PI * 2, true);
      ctx.fill();
      ctx.restore();
    }

    // ---- OVERWORLD MAP RENDERER ----
    renderOverworld(ctx, nodes, cursorIdx, saveData, t) {
      // Ocean
      const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
      grad.addColorStop(0, '#2a78e8');
      grad.addColorStop(1, '#1e58b8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      // Animated water waves
      ctx.fillStyle = '#50a0ff';
      for (let y = 24; y < VIRTUAL_HEIGHT; y += 36) {
        for (let x = (Math.floor(t * 14) + y) % 48; x < VIRTUAL_WIDTH; x += 48) {
          ctx.fillRect(x, y, 10, 2);
        }
      }

      // Main Green Island Continent + Volcanic Eastern Isle
      ctx.fillStyle = '#e8d088'; // sandy beach border
      ctx.fillRect(36, 62, 316, 152);
      ctx.fillRect(364, 88, 92, 106);

      ctx.fillStyle = '#38a83c'; // lush turf
      ctx.fillRect(42, 68, 304, 140);
      ctx.fillStyle = '#52c850';
      ctx.fillRect(54, 76, 180, 120);

      // Volcanic castle island
      ctx.fillStyle = '#48343c';
      ctx.fillRect(370, 94, 80, 94);
      ctx.fillStyle = '#d84018';
      ctx.fillRect(384, 156, 48, 16);

      // Bridge connecting island to Castle
      ctx.fillStyle = '#a05a28';
      ctx.fillRect(344, 124, 30, 14);

      // Scenic Oak Trees
      ctx.drawImage(this.sprites.scenery.oak_tree, 46, 86, 36, 48);
      ctx.drawImage(this.sprites.scenery.oak_tree, 250, 144, 36, 48);
      ctx.drawImage(this.sprites.scenery.oak_tree, 286, 68, 36, 48);
      ctx.drawImage(this.sprites.scenery.castle, 392, 82, 54, 54);

      // Paths between nodes
      ctx.strokeStyle = '#e8c478';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        if (i === 0) ctx.moveTo(nodes[i].x, nodes[i].y);
        else ctx.lineTo(nodes[i].x, nodes[i].y);
      }
      ctx.stroke();

      // Draw Nodes
      nodes.forEach((n, i) => {
        const unlocked = saveData.unlockAll || i <= saveData.maxUnlockedNode;
        const cleared = n.stageIdx >= 0 && saveData.cleared[n.stageIdx];
        const selected = i === cursorIdx;

        ctx.fillStyle = '#181010';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = !unlocked ? '#5a6070' : cleared ? '#38c848' : n.type === 'toad' ? '#ff5890' : '#f8b820';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
        ctx.fill();

        if (selected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 13 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        this.drawTextShadow(ctx, n.code, n.x, n.y + 21, unlocked ? '#ffffff' : '#8088a0', 'center', 'bold 8px monospace');

        if (n.stageIdx >= 0) {
          const stars = saveData.starCoins[n.stageIdx] || [];
          for (let s = 0; s < 3; s++) {
            ctx.fillStyle = stars[s] ? '#ffd838' : '#303848';
            ctx.fillRect(n.x - 11 + s * 8, n.y + 24, 5, 5);
          }
        }
      });

      // Mario standing on active node
      const active = nodes[cursorIdx];
      const mSprite = this.sprites.mario.normal.small['walk' + (Math.floor(t * 6) % 3 + 1)].R;
      ctx.drawImage(mSprite, active.x - 8, active.y - 20);

      // Top & Bottom Map Banners
      ctx.fillStyle = 'rgba(10, 14, 28, 0.86)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, 30);
      this.drawTextShadow(ctx, '世界地图 · 橡果与蘑菇王国', 14, 19, '#ffd838', 'left', 'bold 12px "Microsoft YaHei", sans-serif');
      const totalStars = saveData.starCoins.reduce((acc, arr) => acc + (arr ? arr.filter(Boolean).length : 0), 0);
      this.drawTextShadow(ctx, `★ ${totalStars}/12   最高分 ${saveData.highScore}`, VIRTUAL_WIDTH - 14, 19, '#a0e0ff', 'right', 'bold 10px "Microsoft YaHei", monospace');

      ctx.fillStyle = 'rgba(10, 14, 28, 0.88)';
      ctx.fillRect(0, VIRTUAL_HEIGHT - 42, VIRTUAL_WIDTH, 42);
      const curUnlocked = saveData.unlockAll || cursorIdx <= saveData.maxUnlockedNode;
      this.drawTextShadow(
        ctx,
        `${active.code}  ${active.name} (${active.sub})`,
        16,
        VIRTUAL_HEIGHT - 23,
        curUnlocked ? '#ffffff' : '#8890a8',
        'left',
        'bold 11px "Microsoft YaHei", sans-serif'
      );
      const hint = curUnlocked ? '←/→ 选关  |  Enter/Space 进入  |  Esc 返回标题' : '通关上一关即可解锁 (或点击顶部“全关解锁”)';
      this.drawTextShadow(ctx, hint, 16, VIRTUAL_HEIGHT - 8, '#ffd838', 'left', '10px "Microsoft YaHei", sans-serif');
    }

    // ---- TITLE SCREEN RENDERER ----
    renderTitle(ctx, menuIdx, saveData, t) {
      this.drawBackground(ctx, BIOME.MEADOW, t * 24, t);

      // Meadow ground strip
      for (let tx = 0; tx < 30; tx++) {
        ctx.drawImage(this.sprites.tiles.ground_meadow, tx * 16, 15 * 16);
        ctx.drawImage(this.sprites.tiles.deep_meadow, tx * 16, 16 * 16);
      }
      ctx.drawImage(this.sprites.scenery.oak_tree, 34, 15 * 16 - 64);
      ctx.drawImage(this.sprites.scenery.oak_tree, 396, 15 * 16 - 64);
      ctx.drawImage(this.sprites.scenery.bush, 108, 15 * 16 - 16);

      // Mario running across the title meadow!
      const mx = Math.round(((t * 68) % (VIRTUAL_WIDTH + 64)) - 32);
      const frame = (Math.floor(t * 10) % 3) + 1;
      ctx.drawImage(this.sprites.mario.acorn.big['walk' + frame].R, mx, 15 * 16 - 23);

      // Title Plaque
      ctx.fillStyle = '#702010';
      ctx.fillRect(72, 24, 336, 86);
      ctx.fillStyle = '#c84824';
      ctx.fillRect(76, 28, 328, 78);
      ctx.strokeStyle = '#ffd838';
      ctx.lineWidth = 3;
      ctx.strokeRect(75, 27, 330, 80);

      this.drawTextShadow(ctx, 'SUPER MARIO PIXEL', 240, 56, '#ffd838', 'center', 'bold 20px monospace');
      this.drawTextShadow(ctx, '超级马里奥 · 橡果王国大冒险', 240, 82, '#ffffff', 'center', 'bold 14px "Microsoft YaHei", sans-serif');
      this.drawTextShadow(ctx, '4大主题世界 · 隐藏管道 · 橡果滑翔 · 酷霸王决战', 240, 99, '#ffe8b8', 'center', '9px "Microsoft YaHei", sans-serif');

      // Menu Box
      const items = [
        '开始全新冒险 (Start Game)',
        '进入世界地图 (World Map)',
        `自由选关模式: ${saveData.unlockAll ? '开启' : '关闭'}`,
      ];
      ctx.fillStyle = 'rgba(12, 16, 30, 0.84)';
      ctx.fillRect(130, 122, 220, 76);
      ctx.strokeStyle = '#5064a0';
      ctx.lineWidth = 2;
      ctx.strokeRect(130, 122, 220, 76);

      items.forEach((label, i) => {
        const y = 144 + i * 21;
        const sel = i === menuIdx;
        if (sel) {
          ctx.drawImage(this.sprites.items.mushroom_super, 142, y - 12, 12, 12);
        }
        this.drawTextShadow(ctx, label, 162, y, sel ? '#ffd838' : '#e4eaf8', 'left', 'bold 10px "Microsoft YaHei", sans-serif');
      });

      const totalStars = saveData.starCoins.reduce((acc, arr) => acc + (arr ? arr.filter(Boolean).length : 0), 0);
      this.drawTextShadow(
        ctx,
        `HIGH SCORE: ${String(saveData.highScore).padStart(6, '0')}   |   ★ STAR COINS: ${totalStars}/12`,
        240,
        214,
        '#ffffff',
        'center',
        'bold 9px monospace'
      );
      this.drawTextShadow(ctx, '按 W/S 或 ↑/↓ 选择，Enter / Space 确认', 240, 232, '#ffe890', 'center', '9px "Microsoft YaHei", sans-serif');
    }

    // ---- TOAD HOUSE MINIGAME ----
    renderToadHouse(ctx, state, t) {
      ctx.fillStyle = '#2a1830';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = '#482850';
      ctx.fillRect(24, 24, VIRTUAL_WIDTH - 48, VIRTUAL_HEIGHT - 72);
      for (let tx = 0; tx < 30; tx++) {
        ctx.drawImage(this.sprites.tiles.ground_meadow, tx * 16, 15 * 16);
        ctx.drawImage(this.sprites.tiles.deep_meadow, tx * 16, 16 * 16);
      }

      ctx.drawImage(this.sprites.enemies.toad, 72, 15 * 16 - 16);
      ctx.drawImage(this.sprites.mario.normal.small.idle.R, 108, 15 * 16 - 16);
      this.drawTextShadow(ctx, '奇诺比奥宝箱屋 · TOAD TREASURE HOUSE', 240, 50, '#ffd838', 'center', 'bold 13px "Microsoft YaHei", sans-serif');
      this.drawTextShadow(ctx, state.message, 240, 74, '#ffffff', 'center', '11px "Microsoft YaHei", sans-serif');

      for (let i = 0; i < 3; i++) {
        const cx = 148 + i * 76;
        const cy = 144 + (state.openedIdx === -1 && state.cursor === i ? Math.round(Math.sin(t * 7) * 3) : 0);
        const isOpen = state.openedIdx === i;
        ctx.fillStyle = '#4a2408';
        ctx.fillRect(cx, cy, 32, 26);
        ctx.fillStyle = isOpen ? '#783c10' : '#d88820';
        ctx.fillRect(cx + 2, cy + (isOpen ? 10 : 2), 28, isOpen ? 14 : 22);
        ctx.fillStyle = '#ffd838';
        ctx.fillRect(cx + 13, cy + 11, 6, 5);

        if (state.cursor === i && state.openedIdx === -1) {
          ctx.strokeStyle = '#ffd838';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 4, cy - 4, 40, 34);
        }
        if (isOpen && state.reward) {
          const rImg = state.reward === 'mushroom' ? this.sprites.items.mushroom_super
            : state.reward === 'fire' ? this.sprites.items.fire_flower_1
            : state.reward === 'acorn' ? this.sprites.items.super_acorn
            : this.sprites.items.mushroom_1up;
          ctx.drawImage(rImg, cx + 8, cy - 22);
        }
      }
      this.drawTextShadow(ctx, '←/→ 选择宝箱   |   Space/Enter 打开   |   Esc 返回地图', 240, 224, '#ffe898', 'center', '10px "Microsoft YaHei", sans-serif');
    }

    // ---- OVERLAYS (PAUSE / CLEAR / GAME OVER / VICTORY) ----
    renderOverlay(ctx, mode, data, t) {
      ctx.fillStyle = 'rgba(6, 8, 18, 0.72)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      if (mode === 'PAUSED') {
        ctx.fillStyle = '#182038';
        ctx.fillRect(140, 56, 200, 152);
        ctx.strokeStyle = '#ffd838';
        ctx.lineWidth = 2;
        ctx.strokeRect(140, 56, 200, 152);
        this.drawTextShadow(ctx, '游戏暂停 PAUSED', 240, 82, '#ffd838', 'center', 'bold 13px "Microsoft YaHei", sans-serif');
        const opts = ['继续游戏 (Resume)', '重新开始本关 (Restart)', '返回世界地图 (World Map)'];
        opts.forEach((op, i) => {
          const sel = i === data.pauseIdx;
          this.drawTextShadow(ctx, (sel ? '▶ ' : '  ') + op, 240, 114 + i * 26, sel ? '#ffffff' : '#9aa8c8', 'center', 'bold 10px "Microsoft YaHei", sans-serif');
        });
      } else if (mode === 'STAGE_CLEAR') {
        ctx.fillStyle = '#141e38';
        ctx.fillRect(90, 38, 300, 196);
        ctx.strokeStyle = '#ffd838';
        ctx.lineWidth = 3;
        ctx.strokeRect(90, 38, 300, 196);
        this.drawTextShadow(ctx, `STAGE ${data.stageCode} CLEAR!`, 240, 66, '#ffd838', 'center', 'bold 16px monospace');
        this.drawTextShadow(ctx, data.stageName, 240, 86, '#a0e0ff', 'center', 'bold 11px "Microsoft YaHei", sans-serif');
        this.drawTextShadow(ctx, `剩余时间奖励: +${data.timeBonus}`, 240, 114, '#ffffff', 'center', '11px "Microsoft YaHei", sans-serif');
        this.drawTextShadow(ctx, `总得分: ${data.score}   评级: ${data.rank}`, 240, 138, '#78ff90', 'center', 'bold 12px "Microsoft YaHei", sans-serif');
        for (let i = 0; i < 3; i++) {
          ctx.drawImage(this.sprites.items.star_coin_1, 206 + i * 26, 154);
          if (!data.starCoins[i]) {
            ctx.fillStyle = 'rgba(10, 14, 28, 0.72)';
            ctx.fillRect(206 + i * 26, 154, 16, 16);
          }
        }
        this.drawTextShadow(ctx, '按 Enter / Space 继续前往世界地图', 240, 206, '#ffe898', 'center', '10px "Microsoft YaHei", sans-serif');
      } else if (mode === 'GAME_OVER') {
        this.drawTextShadow(ctx, 'GAME OVER', 240, 116, '#ff4848', 'center', 'bold 26px monospace');
        this.drawTextShadow(ctx, '别灰心！按 Enter / Space 重新挑战', 240, 152, '#ffffff', 'center', '11px "Microsoft YaHei", sans-serif');
      } else if (mode === 'VICTORY') {
        ctx.fillStyle = 'rgba(20, 12, 32, 0.86)';
        ctx.fillRect(54, 28, 372, 216);
        ctx.strokeStyle = '#ffd838';
        ctx.lineWidth = 3;
        ctx.strokeRect(54, 28, 372, 216);
        ctx.drawImage(this.sprites.enemies.peach.L, 260, 68);
        ctx.drawImage(this.sprites.mario.acorn.big.idle.R, 204, 68);
        this.drawTextShadow(ctx, '恭喜通关! 桃花公主获救了!', 240, 56, '#ffd838', 'center', 'bold 14px "Microsoft YaHei", sans-serif');
        this.drawTextShadow(ctx, '感谢游玩《超级马里奥：橡果王国大冒险》', 240, 124, '#ffffff', 'center', '11px "Microsoft YaHei", sans-serif');
        this.drawTextShadow(ctx, `最终得分: ${data.score}   收集星币: ${data.totalStars}/12`, 240, 154, '#80ff90', 'center', 'bold 12px "Microsoft YaHei", sans-serif');
        this.drawTextShadow(ctx, '按 Enter / Space 返回世界地图继续收集全星币', 240, 206, '#ffe898', 'center', '10px "Microsoft YaHei", sans-serif');
      }
    }
  }

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.GameRenderer = GameRenderer;
})(window);

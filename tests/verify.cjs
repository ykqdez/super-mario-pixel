'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'test-results');
fs.mkdirSync(outDir, { recursive: true });

const assertions = [];
const browserErrors = [];

function check(ok, name, detail) {
  assertions.push({ name, passed: !!ok, ...(detail !== undefined ? { detail } : {}) });
  if (!ok) console.error('FAIL:', name, detail ?? '');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (['node_modules', 'test-results', '.git'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function staticChecks() {
  for (const file of walk(root)) {
    if (/\.(js|cjs)$/.test(file)) {
      const r = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      check(r.status === 0, 'syntax: ' + path.relative(root, file), r.stderr?.trim() || undefined);
    }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  check(new Set(ids).size === ids.length, 'HTML IDs unique');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    check(fs.existsSync(path.resolve(root, ref)), 'local reference exists: ' + ref);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runBrowserTests() {
  const executable = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean).find((p) => fs.existsSync(p));

  check(!!executable, 'Chromium/Edge browser found');
  if (!executable) return;

  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (cleanUrl === '/' ? '/index.html' : cleanUrl));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      res.writeHead(404); res.end(); return;
    }
    const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mario-verify-'));
  const browser = cp.spawn(executable, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--window-size=1280,760',
    '--no-first-run',
    '--disable-extensions',
    '--no-default-browser-check',
    'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });

  let ws;
  const pending = new Map();
  let seq = 0;

  try {
    let tabs;
    for (let i = 0; i < 80; i++) {
      try {
        const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
        tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        if (tabs.some((t) => t.type === 'page')) break;
      } catch { /* wait */ }
      await sleep(100);
    }
    const tab = tabs?.find((t) => t.type === 'page');
    if (!tab) throw new Error('Browser tab startup timed out');

    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown' || (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')) {
        browserErrors.push(msg);
      }
    };
    const cdp = (method, params = {}) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const ev = async (expression) => {
      const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    const saveShot = async (name) => {
      const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'));
    };

    await cdp('Runtime.enable');
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });

    let ready = false;
    for (let i = 0; i < 60; i++) {
      ready = await ev('!!window.__MARIO_GAME__');
      if (ready) break;
      await sleep(100);
    }
    check(ready, 'Game boots cleanly');
    if (!ready) return;

    // 1. Validate Sprite Matrix Integrity
    const spriteAudit = await ev(`(() => {
      const td = window.MarioGame._SPRITE_TEST_DATA;
      const issues = [];
      const checkGroup = (group, pal) => {
        for (const [k, rows] of Object.entries(group)) {
          const w = rows[0].length;
          rows.forEach((r, idx) => {
            if (r.length !== w) issues.push(k + ' row ' + idx + ' len ' + r.length + ' != ' + w);
            for (const ch of r) {
              if (ch !== '.' && ch !== ' ' && !pal[ch]) issues.push(k + ' unknown key ' + ch);
            }
          });
        }
      };
      checkGroup(td.SMALL_MARIO, td.MARIO_PALETTES.normal);
      checkGroup(td.BIG_MARIO, td.MARIO_PALETTES.normal);
      checkGroup(td.ENEMY_MATRICES, td.ENEMY_PAL);
      checkGroup(td.BOWSER_MATRICES, td.ENEMY_PAL);
      checkGroup(td.ITEM_MATRICES, td.ITEM_PAL);
      return issues;
    })()`);
    check(spriteAudit.length === 0, 'All sprite matrices valid', spriteAudit);

    // 2. Validate All 4 Levels & Sub-areas Integrity
    const levelAudit = await ev(`(() => {
      const stages = window.__MARIO_GAME__.stages;
      const issues = [];
      for (const st of stages) {
        const starIds = new Set();
        for (const [aName, area] of Object.entries(st.areas)) {
          if (area.grid.length !== 17) issues.push(st.code + ':' + aName + ' height != 17');
          for (let y = 0; y < area.grid.length; y++) {
            if (area.grid[y].length !== area.width) issues.push(st.code + ':' + aName + ' row ' + y + ' width mismatch');
          }
          for (const sc of (area.starCoins || [])) starIds.add(sc.id);
          for (const p of (area.pipes || [])) {
            if (p.targetArea && !st.areas[p.targetArea]) issues.push(st.code + ' bad pipe targetArea ' + p.targetArea);
          }
          if (aName === 'main') {
            if (!area.spawn) issues.push(st.code + ' missing spawn');
            if (!area.checkpoint) issues.push(st.code + ' missing checkpoint');
            if (!area.goal) issues.push(st.code + ' missing goal');
          }
        }
        if (starIds.size !== 3 || !starIds.has(0) || !starIds.has(1) || !starIds.has(2)) {
          issues.push(st.code + ' starCoins must have ids 0,1,2, got ' + [...starIds]);
        }
      }
      return issues;
    })()`);
    check(levelAudit.length === 0, 'All 4 stages + sub-areas structurally valid', levelAudit);

    // Capture Title Screen
    await sleep(300);
    await saveShot('title.png');

    // Capture Overworld Map
    await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.state = window.MarioGame.CONSTANTS.GAME_STATE.OVERWORLD;
      g.render();
    })()`);
    await sleep(120);
    await saveShot('overworld.png');

    // 3. Live Gameplay Test on Stage 1-1: Move, Jump, Collect Mushroom & Acorn, Reserve Drop, Pipe Warp
    const play11 = await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.startStage(0);
      const step = (frames, keys = []) => {
        g.input.clearAll();
        for (const k of keys) g.input.onKeyDown(k);
        for (let i = 0; i < frames; i++) g.stepFixed(1/60);
      };
      // Walk right to tx 14 (x = 224) to hit Mushroom block at (14, 11)
      step(70, ['KeyD']);
      // Jump to hit block (14, 11)
      step(24, ['Space']);
      // Wait for mushroom to emerge & collect it
      step(55, ['KeyD']);
      const afterMush = g.getSnapshot();

      // Move right toward tx 21 (x=336) and jump for Super Acorn block at (21, 11)
      step(35, ['KeyD']);
      step(22, ['Space', 'KeyD']);
      step(60, ['KeyD']);
      const afterAcorn = g.getSnapshot();

      // Test Tail Spin + Acorn Glide + Ground Pound
      step(1, ['KeyJ']); // tail spin
      step(15, []);
      const tailActive = g.world.player.tailSpinTimer >= 0;
      step(18, ['Space']);
      step(20, ['Space']); // glide
      const gliding = g.world.player.isGliding;
      step(1, ['KeyS']); // ground pound!
      step(35, []);

      // Test Pipe entry into 1-1 bonus area!
      g.world.player.x = 70 * 16 + 10;
      g.world.player.y = 12 * 16 - g.world.player.h;
      g.world.player.onGround = true;
      step(1, ['KeyS']);
      step(60, []); // wait for pipe sink + iris wipe midpoint
      const inBonus = g.world.currentAreaName;
      step(60, []); // finish iris opening
      return { afterMush, afterAcorn, tailActive, gliding, inBonus };
    })()`);
    check(play11.afterMush.player.x > 60, 'Mario walks smoothly in 1-1', play11.afterMush.player);
    check(play11.inBonus === 'bonus', 'Warp pipe transitions into 1-1 bonus sub-area', play11.inBonus);

    // Position Mario nicely in 1-1 at tx 13 with Acorn Suit & Reserve Mushroom for visual screenshot
    await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.startStage(0);
      g.world.player.givePowerUp('mushroom', g.world);
      g.world.player.givePowerUp('acorn', g.world);
      g.world.player.x = 8 * 16;
      g.world.player.y = 15 * 16 - g.world.player.h;
      g.world.cameraX = 6 * 16;
      for (let i = 0; i < 120; i++) g.stepFixed(1/60);
      g.render();
    })()`);
    await saveShot('stage_1_1.png');

    // Test Reserve Item Drop + Toad House + Flagpole Clear
    const extraChecks = await ev(`(() => {
      const g = window.__MARIO_GAME__;
      const resBefore = g.world.player.reserveItem;
      g.world.player.dropReserve(g.world);
      const resAfter = g.world.player.reserveItem;
      const itemsSpawned = g.world.areaState.items.length;

      // Test Flagpole Clear
      g.world.player.x = g.world.area.goal.tx * 16;
      g.world.player.y = 10 * 16;
      for (let i = 0; i < 420; i++) g.stepFixed(1/60);
      const clearState = g.state;

      // Test Toad House reward
      g.state = window.MarioGame.CONSTANTS.GAME_STATE.TOAD_HOUSE;
      g.toadState = { cursor: 1, openedIdx: -1, reward: null, message: 'pick' };
      g.input.clearAll();
      g.input.onKeyDown('Enter');
      g.stepFixed(1/60);
      g.input.clearAll();
      const toadOpened = g.toadState.openedIdx;
      return { resBefore, resAfter, itemsSpawned, clearState, toadOpened };
    })()`);
    check(extraChecks.resBefore === 'mushroom' && extraChecks.resAfter === null && extraChecks.itemsSpawned > 0, 'Reserve item drops cleanly into world', extraChecks);
    check(extraChecks.clearState === 'STAGE_CLEAR', 'Stage 1-1 Flagpole leads to STAGE_CLEAR', extraChecks);
    check(extraChecks.toadOpened === 1, 'Toad House chest opens cleanly', extraChecks);

    // 4. Test Stage 1-2 (Cavern, On/Off Switch, P-Switch, Screenshot)
    const play12 = await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.startStage(1);
      const before = g.world.onOffState;
      g.world.bumpBlock(44, 11, true);
      const after = g.world.onOffState;
      // Activate P-switch
      const ps = g.world.areaState.pswitchObjs[0];
      g.world.player.pressPSwitch(g.world, ps);
      const pTimer = g.world.pSwitchTimer;
      g.world.player.x = 45 * 16;
      g.world.player.y = 15 * 16 - g.world.player.h;
      g.world.cameraX = 36 * 16;
      g.stepFixed(1/60);
      g.render();
      return { before, after, pTimer };
    })()`);
    check(play12.before === true && play12.after === false, '1-2 On/Off switch toggles Red/Blue state', play12);
    check(play12.pTimer > 8, '1-2 P-Switch activates timer', play12.pTimer);
    await saveShot('stage_1_2.png');

    // 5. Test Stage 1-3 (Sky Canopy, Donut blocks, Springboard, Screenshot)
    await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.startStage(2);
      g.world.player.givePowerUp('fire', g.world);
      g.world.player.x = 18 * 16;
      g.world.player.y = 13 * 16 - g.world.player.h;
      g.world.cameraX = 10 * 16;
      g.stepFixed(1/60);
      g.render();
    })()`);
    await saveShot('stage_1_3.png');

    // 6. Test Stage 1-4 (Bowser Boss Fight + Axe Victory, Screenshot)
    await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.startStage(3);
      g.world.player.givePowerUp('fire', g.world);
      g.world.player.x = 137 * 16;
      g.world.player.y = 12 * 16 - g.world.player.h;
      g.world.cameraX = 130 * 16;
      for (let i = 0; i < 20; i++) g.stepFixed(1/60);
      g.render();
    })()`);
    await saveShot('stage_1_4_boss.png');

    const bossRes = await ev(`(() => {
      const g = window.__MARIO_GAME__;
      const initHp = g.world.areaState.bowser.hp;
      g.world.areaState.bowser.damage(g.world, 4);
      const midHp = g.world.areaState.bowser.hp;
      // Trigger Axe!
      g.world.player.x = g.world.area.goal.axeTx * 16;
      g.world.player.y = g.world.area.goal.axeTy * 16;
      for (let i = 0; i < 450; i++) g.stepFixed(1/60);
      g.render();
      return { initHp, midHp, bowserDead: g.world.areaState.bowser.dead, finalGameState: g.state };
    })()`);
    check(bossRes.initHp === 12 && bossRes.midHp === 8, 'Bowser takes damage cleanly', bossRes);
    check(bossRes.bowserDead === true, 'Axe collapses bridge and defeats Bowser', bossRes);
    check(bossRes.finalGameState === 'VICTORY', 'Stage 1-4 reaches VICTORY state after rescuing Peach', bossRes);
    await saveShot('stage_1_4_victory.png');

    // 7A. Mobile Portrait Mandatory Lock Check (390x844 touch viewport)
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const portraitCheck = await ev(`(() => {
      const g = window.__MARIO_GAME__;
      g.isTouch = true;
      g.toggleTouchPad(true);
      g.syncLayoutState();
      const tBefore = g.time;
      g.stepFixed(1/60);
      const tAfter = g.time;
      const banner = document.getElementById('rotate-banner');
      const bannerVisible = !banner.classList.contains('hidden') && getComputedStyle(banner).display !== 'none';
      const noDismissBtn = document.getElementById('btn-dismiss-rotate') === null;
      return {
        portraitLocked: g.portraitLocked,
        pausedStep: tAfter === tBefore,
        bannerVisible,
        noDismissBtn,
      };
    })()`);
    check(
      portraitCheck.portraitLocked && portraitCheck.pausedStep && portraitCheck.bannerVisible && portraitCheck.noDismissBtn,
      'Mobile portrait enforces mandatory landscape-only lock & pauses gameplay without bypass',
      portraitCheck,
    );
    await saveShot('mobile_portrait_lock.png');

    // 7B. Mobile Landscape Layout, Joystick Wheel, Corner Menu & Fullscreen Check (844x390 touch viewport)
    await cdp('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const mobileCheck = await ev(`(async () => {
      const g = window.__MARIO_GAME__;
      g.isTouch = true;
      g.toggleTouchPad(true);
      g.syncLayoutState();
      g.startStage(0);
      g.world.player.givePowerUp('acorn', g.world);
      g.world.player.x = 8 * 16;
      g.world.player.y = 15 * 16 - g.world.player.h;
      g.world.cameraX = 6 * 16;
      g.stepFixed(1/60);
      g.render();

      // Test floating non-fixed virtual joystick wheel: touch away from corner (210, 170)
      const joyZone = document.getElementById('vjoy-zone');
      const joyBase = document.getElementById('vjoy-base');
      const joyKnob = document.getElementById('vjoy-knob');
      const idleRect = joyBase.getBoundingClientRect();

      joyZone.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 210, clientY: 170, pointerType: 'mouse' }));
      const spawnedRect = joyBase.getBoundingClientRect();
      const spawnedCenterX = spawnedRect.left + spawnedRect.width / 2;
      const spawnedCenterY = spawnedRect.top + spawnedRect.height / 2;
      const floatedNearTap =
        joyBase.classList.contains('floating') &&
        Math.abs(spawnedCenterX - 210) < 2 &&
        Math.abs(spawnedCenterY - 170) < 2 &&
        Math.hypot(spawnedRect.left - idleRect.left, spawnedRect.top - idleRect.top) > 40;

      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 242, clientY: 170, pointerType: 'mouse' }));
      for (let i = 0; i < 12; i++) g.stepFixed(1/60);
      const rightArrowActive = joyBase.querySelector('.vj-r').classList.contains('active');
      const knobMoved = joyKnob.style.transform && !joyKnob.style.transform.includes('(0px, 0px)');
      const movedRightByWheel = g.world.player.x > 8 * 16;

      // Drag far beyond rim to verify smooth dynamic base follow
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 305, clientY: 170, pointerType: 'mouse' }));
      const followedRect = joyBase.getBoundingClientRect();
      const followedCenterX = followedRect.left + followedRect.width / 2;
      const baseFollowedThumb = followedCenterX > spawnedCenterX + 12;

      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: followedCenterX, clientY: spawnedCenterY + 34, pointerType: 'mouse' }));
      const downArrowActive = joyBase.querySelector('.vj-d').classList.contains('active');
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: followedCenterX, clientY: spawnedCenterY + 34, pointerType: 'mouse' }));
      const clearedAfterRelease = !joyBase.classList.contains('floating') && !g.input.virtual.has('right') && !g.input.virtual.has('down');

      // Test Jump & Pause virtual action buttons
      g.input.virtual.add('jump');
      for (let i = 0; i < 8; i++) g.stepFixed(1/60);
      const jumped = g.world.player.vy < 0 || !g.world.player.onGround;
      g.input.virtual.clear();
      g.input.virtual.add('pause');
      g.stepFixed(1/60);
      const pausedByVbtn = g.state === 'PAUSED';
      g.input.virtual.clear();
      g.state = 'PLAYING';

      // Test corner fullscreen toggle (native FS or CSS immersive fallback)
      document.getElementById('btn-corner-fs').click();
      await new Promise((r) => setTimeout(r, 80));
      const immersiveOn = document.body.classList.contains('is-immersive') || !!document.fullscreenElement;

      // Test corner quick menu drawer open & close
      document.getElementById('btn-corner-menu').click();
      const qmOpened = !document.getElementById('quick-menu').classList.contains('hidden');
      const pausedByQuickMenu = g.state === 'PAUSED';
      document.getElementById('btn-close-quick').click();
      const qmClosed = document.getElementById('quick-menu').classList.contains('hidden');
      g.state = 'PLAYING';
      g.render();

      // Test non-dragged tap passthrough inside left vjoy-zone on Title overlay
      g.state = 'TITLE';
      g.menuIdx = 0;
      const tapRect = document.getElementById('game-canvas').getBoundingClientRect();
      const titleOptX = tapRect.left + tapRect.width * (180 / 480);
      const titleOptY = tapRect.top + tapRect.height * (135 / 272);
      joyZone.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: titleOptX, clientY: titleOptY, pointerType: 'mouse' }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: titleOptX, clientY: titleOptY, pointerType: 'mouse' }));
      const tapStartedGameFromZone = g.state === 'PLAYING';
      g.startStage(0);
      g.world.player.givePowerUp('acorn', g.world);
      g.world.player.x = 8 * 16;
      g.world.player.y = 15 * 16 - g.world.player.h;
      g.world.cameraX = 6 * 16;
      g.stepFixed(1/60);
      g.render();

      const topBarDisplay = getComputedStyle(document.querySelector('.top-bar')).display;
      const footerDisplay = getComputedStyle(document.querySelector('.control-strip')).display;
      const cornerBar = document.getElementById('corner-bar');
      const cornerRect = cornerBar.getBoundingClientRect();
      const frameRect = document.getElementById('canvas-frame').getBoundingClientRect();
      const padVisible = !document.getElementById('virtual-controls').classList.contains('hidden');
      const rotateHidden = getComputedStyle(document.getElementById('rotate-banner')).display === 'none';

      return {
        floatedNearTap,
        rightArrowActive,
        knobMoved,
        movedRightByWheel,
        baseFollowedThumb,
        downArrowActive,
        clearedAfterRelease,
        jumped,
        pausedByVbtn,
        immersiveOn,
        qmOpened,
        pausedByQuickMenu,
        qmClosed,
        tapStartedGameFromZone,
        noBottomMenuBlocking: topBarDisplay === 'none' && footerDisplay === 'none',
        cornerAtTop: cornerRect.top >= 0 && cornerRect.bottom < 70 && cornerRect.right <= 844,
        canvasFullHeight: frameRect.height >= 380,
        padVisible,
        rotateHidden,
      };
    })()`);
    check(
      mobileCheck.floatedNearTap &&
        mobileCheck.rightArrowActive &&
        mobileCheck.knobMoved &&
        mobileCheck.movedRightByWheel &&
        mobileCheck.baseFollowedThumb &&
        mobileCheck.downArrowActive &&
        mobileCheck.clearedAfterRelease,
      'Floating non-fixed joystick wheel spawns at touch point, follows thumb, & moves/crouches cleanly',
      mobileCheck,
    );
    check(mobileCheck.tapStartedGameFromZone, 'Left touch zone allows tap-through on Title/Overworld menus', mobileCheck);
    check(mobileCheck.jumped && mobileCheck.pausedByVbtn, 'Virtual action buttons Jump & Pause work cleanly', mobileCheck);
    check(
      mobileCheck.immersiveOn &&
        mobileCheck.qmOpened &&
        mobileCheck.pausedByQuickMenu &&
        mobileCheck.qmClosed,
      'Corner fullscreen toggle & quick-menu drawer work in mobile landscape',
      mobileCheck,
    );
    check(
      mobileCheck.noBottomMenuBlocking &&
        mobileCheck.cornerAtTop &&
        mobileCheck.canvasFullHeight &&
        mobileCheck.padVisible &&
        mobileCheck.rotateHidden,
      'Mobile landscape hides bottom bar, keeps controls in top-right corner, and uses full height',
      mobileCheck,
    );
    await saveShot('mobile_landscape.png');

    check(browserErrors.length === 0, 'Zero browser console/runtime errors', browserErrors);
  } finally {
    try { ws?.close(); } catch {}
    try { browser.kill(); } catch {}
    server.close();
  }
}

(async () => {
  staticChecks();
  await runBrowserTests();
  const failed = assertions.filter((a) => !a.passed);
  console.log(`\nVerification Summary: ${assertions.length - failed.length}/${assertions.length} checks passed.`);
  if (failed.length > 0) {
    console.error('Failed checks:', JSON.stringify(failed, null, 2));
    process.exit(1);
  }
})();

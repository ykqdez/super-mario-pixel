(function (global) {
  'use strict';

  const { TILE, BIOME } = global.MarioGame.CONSTANTS;

  function createGrid(width, height, fill = TILE.EMPTY) {
    const grid = new Array(height);
    for (let y = 0; y < height; y++) {
      grid[y] = new Uint8Array(width);
      if (fill !== 0) grid[y].fill(fill);
    }
    return grid;
  }

  function fillRect(grid, x, y, w, h, tile) {
    const H = grid.length;
    const W = grid[0].length;
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        grid[yy][xx] = tile;
      }
    }
  }

  function addGround(grid, x1, x2, topY = 15, topTile = TILE.GROUND, deepTile = TILE.GROUND_DEEP) {
    fillRect(grid, x1, topY, x2 - x1 + 1, 1, topTile);
    if (topY + 1 < grid.length) {
      fillRect(grid, x1, topY + 1, x2 - x1 + 1, grid.length - (topY + 1), deepTile);
    }
  }

  function addPipe(grid, tx, topY, bottomY) {
    grid[topY][tx] = TILE.PIPE_TL;
    grid[topY][tx + 1] = TILE.PIPE_TR;
    for (let y = topY + 1; y <= bottomY; y++) {
      grid[y][tx] = TILE.PIPE_BL;
      grid[y][tx + 1] = TILE.PIPE_BR;
    }
  }

  function addStair(grid, startX, baseY, height, dir = 1, tile = TILE.HARD) {
    for (let i = 0; i < height; i++) {
      const col = dir > 0 ? startX + i : startX + (height - 1 - i);
      fillRect(grid, col, baseY - i, 1, i + 1, tile);
    }
  }

  function addCoinsRow(grid, x1, x2, y) {
    for (let x = x1; x <= x2; x++) {
      grid[y][x] = TILE.COIN;
    }
  }

  // ---- OVERWORLD MAP DEFINITION ----
  const OVERWORLD_NODES = [
    { id: 0, code: '1-1', name: '橡果蘑菇草原', sub: 'Acorn Meadow', x: 74, y: 174, type: 'stage', stageIdx: 0 },
    { id: 1, code: 'TOAD', name: '奇诺比奥宝箱屋', sub: 'Toad House', x: 158, y: 132, type: 'toad', stageIdx: -1 },
    { id: 2, code: '1-2', name: '幽深水晶矿洞', sub: 'Crystal Cavern', x: 244, y: 176, type: 'stage', stageIdx: 1 },
    { id: 3, code: '1-3', name: '云端橡树浮岛', sub: 'Sky Canopy', x: 326, y: 108, type: 'stage', stageIdx: 2 },
    { id: 4, code: '1-4', name: '酷霸王熔岩堡垒', sub: "Bowser's Fortress", x: 414, y: 138, type: 'stage', stageIdx: 3 },
  ];

  // ---- STAGE 1-1: ACORN MEADOW ----
  function buildStage1() {
    const W = 186;
    const H = 17;
    const g = createGrid(W, H);
    const blockContents = {};
    const key = (x, y) => `${x},${y}`;

    // Ground with scenic gaps
    addGround(g, 0, 44, 15);
    // gap 45..47
    addGround(g, 48, 75, 15);
    // gap 76..80 (bouncy mushroom cap in middle!)
    addGround(g, 81, 146, 15);
    // gap 147..149
    addGround(g, 150, 185, 15);

    // Bounce mushroom cap over gap 76..80
    g[13][78] = TILE.BOUNCE_CAP;

    // Opening blocks
    g[11][14] = TILE.QUESTION; blockContents[key(14, 11)] = { kind: 'mushroom' };
    g[11][19] = TILE.BRICK;
    g[11][20] = TILE.QUESTION; blockContents[key(20, 11)] = { kind: 'coin' };
    g[11][21] = TILE.QUESTION; blockContents[key(21, 11)] = { kind: 'acorn' };
    g[11][22] = TILE.BRICK; blockContents[key(22, 11)] = { kind: 'multi_coin', count: 8 };
    g[11][23] = TILE.BRICK;
    g[7][21] = TILE.QUESTION; blockContents[key(21, 7)] = { kind: 'coin' };

    // Pipes + Fire Flower
    addPipe(g, 28, 13, 14);
    addPipe(g, 35, 12, 14); // Piranha pipe
    g[7][35] = TILE.QUESTION; blockContents[key(35, 7)] = { kind: 'fire' };
    addCoinsRow(g, 45, 47, 11);

    // Elevated Oak Canopy / Wood Bridge & Bricks (Star Coin #1)
    fillRect(g, 52, 11, 12, 1, TILE.ONEWAY);
    fillRect(g, 55, 7, 6, 1, TILE.BRICK);
    g[7][58] = TILE.QUESTION; blockContents[key(58, 7)] = { kind: 'coin' };
    addCoinsRow(g, 53, 56, 10);

    // Warp Pipe to Bonus Sub-area (tx 70..71)
    addPipe(g, 70, 12, 14);
    g[9][70] = TILE.COIN; g[9][71] = TILE.COIN;

    // Return pipe landing area (tx 83..84)
    addPipe(g, 83, 13, 14);

    // Koopa Bowling Alley (tx 94..114)
    g[11][100] = TILE.QUESTION; blockContents[key(100, 11)] = { kind: 'star' };
    addCoinsRow(g, 103, 107, 12);

    // Wall-Jump Twin Pillars (tx 122 & 127) with lower walk-under opening at ty 12..14
    fillRect(g, 122, 6, 1, 6, TILE.HARD);
    fillRect(g, 127, 6, 1, 6, TILE.HARD);
    g[11][124] = TILE.ONEWAY; g[11][125] = TILE.ONEWAY;
    g[5][124] = TILE.HIDDEN; blockContents[key(124, 5)] = { kind: '1up' };

    // Final Stairs & Goal
    addStair(g, 142, 14, 5, 1, TILE.HARD);
    addStair(g, 150, 14, 4, -1, TILE.HARD);
    addStair(g, 156, 14, 6, 1, TILE.HARD);

    const mainArea = {
      width: W,
      height: H,
      biome: BIOME.MEADOW,
      grid: g,
      blockContents,
      spawn: { tx: 3, ty: 13 },
      checkpoint: { tx: 87, ty: 14 },
      goal: { type: 'flagpole', tx: 165, ty: 14, castleTx: 171 },
      pipes: [
        { tx: 70, ty: 12, color: 'green', dir: 'down', targetArea: 'bonus', targetTx: 3, targetTy: 4 },
        { tx: 83, ty: 13, color: 'green', dir: 'none' },
      ],
      springs: [{ tx: 117, ty: 14 }],
      pswitch: [],
      platforms: [],
      firebars: [],
      signs: [
        { tx: 5, ty: 14, text: 'A/D移动 Space跳 Shift冲刺' },
        { tx: 68, ty: 14, text: '按S/↓进入秘密水管!' },
        { tx: 120, ty: 14, text: '贴墙跳或滑翔上顶层!' },
      ],
      enemies: [
        { type: 'goomba', tx: 17, ty: 14, dir: -1 },
        { type: 'goomba', tx: 24, ty: 14, dir: -1 },
        { type: 'piranha', tx: 35, ty: 12 },
        { type: 'koopa_r', tx: 56, ty: 10, dir: -1 },
        { type: 'goomba', tx: 63, ty: 14, dir: -1 },
        { type: 'koopa_g', tx: 94, ty: 14, dir: 1 },
        { type: 'goomba', tx: 100, ty: 14, dir: -1 },
        { type: 'goomba', tx: 103, ty: 14, dir: -1 },
        { type: 'goomba', tx: 106, ty: 14, dir: -1 },
        { type: 'goomba', tx: 109, ty: 14, dir: -1 },
        { type: 'koopa_r', tx: 112, ty: 14, dir: -1 },
        { type: 'goomba', tx: 134, ty: 14, dir: -1 },
      ],
      starCoins: [
        { id: 0, tx: 58, ty: 5 },
        { id: 2, tx: 124, ty: 3 },
      ],
    };

    // Sub-area: 1-1 Bonus Underground Coin Cavern
    const BW = 30;
    const bg = createGrid(BW, H);
    const bContents = {};
    fillRect(bg, 0, 0, BW, 2, TILE.HARD);
    fillRect(bg, 0, 2, 1, 13, TILE.HARD);
    fillRect(bg, BW - 1, 2, 1, 13, TILE.HARD);
    addGround(bg, 0, BW - 1, 15, TILE.GROUND, TILE.GROUND_DEEP);
    // Decorative 'M' coins + Fire Flower
    const coinPts = [
      [8, 9], [8, 8], [8, 7], [9, 6], [10, 7], [11, 8], [12, 7], [13, 6], [14, 7], [14, 8], [14, 9],
      [18, 9], [19, 9], [20, 9], [18, 7], [19, 7], [20, 7],
    ];
    for (const [cx, cy] of coinPts) bg[cy][cx] = TILE.COIN;
    bg[11][11] = TILE.QUESTION; bContents[key(11, 11)] = { kind: 'fire' };
    addPipe(bg, 25, 13, 14);
    fillRect(bg, 23, 14, 2, 1, TILE.HARD);

    const bonusArea = {
      width: BW,
      height: H,
      biome: BIOME.CAVERN,
      grid: bg,
      blockContents: bContents,
      pipes: [
        { tx: 25, ty: 13, color: 'green', dir: 'down', targetArea: 'main', targetTx: 83, targetTy: 11 },
      ],
      springs: [],
      pswitch: [],
      platforms: [],
      firebars: [],
      signs: [{ tx: 5, ty: 14, text: '秘密金币宝库! 右侧水管返回' }],
      enemies: [],
      starCoins: [{ id: 1, tx: 19, ty: 5 }],
    };

    return {
      id: 0,
      code: '1-1',
      name: '橡果蘑菇草原',
      timeLimit: 320,
      areas: { main: mainArea, bonus: bonusArea },
    };
  }

  // ---- STAGE 1-2: CRYSTAL CAVERN ----
  function buildStage2() {
    const W = 196;
    const H = 17;
    const g = createGrid(W, H);
    const blockContents = {};
    const key = (x, y) => `${x},${y}`;

    // Cavern ceiling (open above tx 30..63 for secret ceiling run!)
    fillRect(g, 0, 0, 29, 2, TILE.GROUND_DEEP);
    fillRect(g, 29, 4, 33, 1, TILE.HARD); // Ceiling floor to run on (ends at 61, drop at 62..63!)
    fillRect(g, 64, 0, 108, 2, TILE.GROUND_DEEP); // Open sky at tx 172..195 for exit!

    // Ground segments
    addGround(g, 0, 46, 15);
    // Pit 47..60 (On/Off bridge!)
    addGround(g, 61, 103, 15);
    // Abyss 104..128 (Moving Lifts!)
    addGround(g, 129, 195, 15);

    // Opening blocks
    g[11][16] = TILE.QUESTION; blockContents[key(16, 11)] = { kind: 'mushroom' };
    g[11][22] = TILE.BRICK;
    g[11][23] = TILE.QUESTION; blockContents[key(23, 11)] = { kind: 'fire' };
    g[11][24] = TILE.BRICK; blockContents[key(24, 11)] = { kind: 'multi_coin', count: 8 };
    g[11][29] = TILE.ONEWAY; g[11][30] = TILE.ONEWAY;
    g[8][29] = TILE.ONEWAY; g[8][30] = TILE.ONEWAY;
    g[5][27] = TILE.ONEWAY; g[5][28] = TILE.ONEWAY; // Steps up to secret ceiling!
    addCoinsRow(g, 38, 54, 2); // Ceiling coins!

    // On/Off Switch Bridge over crystal pit 47..60
    g[11][44] = TILE.ON_OFF_SWITCH;
    for (let x = 47; x <= 51; x++) g[14][x] = TILE.RED_BLOCK;
    for (let x = 52; x <= 55; x++) g[13][x] = TILE.BLUE_BLOCK;
    for (let x = 56; x <= 60; x++) g[14][x] = TILE.RED_BLOCK;
    addCoinsRow(g, 52, 55, 11);

    // P-Switch Puzzle Room (tx 70..92)
    addCoinsRow(g, 76, 80, 13);
    addCoinsRow(g, 79, 82, 11);
    addCoinsRow(g, 82, 85, 9);
    fillRect(g, 76, 8, 6, 1, TILE.BRICK);
    g[11][71] = TILE.BRICK;
    g[11][72] = TILE.QUESTION; blockContents[key(72, 11)] = { kind: 'acorn' };

    // Wall beside P-Switch room & Checkpoint
    fillRect(g, 89, 11, 2, 4, TILE.HARD);
    g[11][87] = TILE.ONEWAY; g[11][88] = TILE.ONEWAY;

    // Gold Warp Pipe to Bonus Vault
    addPipe(g, 136, 13, 14);
    addPipe(g, 148, 13, 14);

    // Final exit ascent to outdoor twilight Flagpole
    addStair(g, 162, 14, 4, 1, TILE.HARD);
    fillRect(g, 166, 11, 5, 4, TILE.HARD);

    const mainArea = {
      width: W,
      height: H,
      biome: BIOME.CAVERN,
      grid: g,
      blockContents,
      spawn: { tx: 3, ty: 13 },
      checkpoint: { tx: 96, ty: 14 },
      goal: { type: 'flagpole', tx: 176, ty: 14, castleTx: 181 },
      pipes: [
        { tx: 136, ty: 13, color: 'gold', dir: 'down', targetArea: 'bonus', targetTx: 3, targetTy: 4 },
        { tx: 148, ty: 13, color: 'green', dir: 'none' },
      ],
      springs: [{ tx: 66, ty: 14 }],
      pswitch: [{ tx: 72, ty: 14 }],
      platforms: [
        { x: 105 * 16, y: 13 * 16, w: 48, dx: 64, dy: 0, speed: 46 },
        { x: 115 * 16, y: 11 * 16, w: 48, dx: 0, dy: 48, speed: 40 },
        { x: 121 * 16, y: 12 * 16, w: 48, dx: 64, dy: 0, speed: 48 },
      ],
      firebars: [],
      signs: [
        { tx: 5, ty: 14, text: '铁甲龟耐火! 试试红蓝开关与P开关' },
        { tx: 70, ty: 14, text: '踩下P开关让金币变楼梯!' },
      ],
      enemies: [
        { type: 'beetle', tx: 18, ty: 14, dir: -1 },
        { type: 'goomba', tx: 27, ty: 14, dir: -1 },
        { type: 'beetle', tx: 38, ty: 14, dir: -1 },
        { type: 'koopa_r', tx: 64, ty: 14, dir: -1 },
        { type: 'paratroopa', tx: 110, ty: 9, dir: -1 },
        { type: 'paratroopa', tx: 120, ty: 8, dir: -1 },
        { type: 'beetle', tx: 153, ty: 14, dir: -1 },
        { type: 'goomba', tx: 158, ty: 14, dir: -1 },
      ],
      starCoins: [
        { id: 0, tx: 48, ty: 2 },
        { id: 1, tx: 84, ty: 6 },
      ],
    };

    // Sub-area: 1-2 Crystal Vault
    const BW = 28;
    const bg = createGrid(BW, H);
    const bContents = {};
    fillRect(bg, 0, 0, BW, 2, TILE.GROUND_DEEP);
    fillRect(bg, 0, 2, 1, 13, TILE.GROUND_DEEP);
    fillRect(bg, BW - 1, 2, 1, 13, TILE.GROUND_DEEP);
    addGround(bg, 0, BW - 1, 15, TILE.GROUND, TILE.GROUND_DEEP);
    fillRect(bg, 8, 11, 10, 1, TILE.BRICK);
    bg[11][12] = TILE.QUESTION; bContents[key(12, 11)] = { kind: 'star' };
    addCoinsRow(bg, 8, 17, 10);
    addCoinsRow(bg, 10, 15, 7);
    addPipe(bg, 23, 13, 14);

    const bonusArea = {
      width: BW,
      height: H,
      biome: BIOME.CAVERN,
      grid: bg,
      blockContents: bContents,
      pipes: [
        { tx: 23, ty: 13, color: 'gold', dir: 'down', targetArea: 'main', targetTx: 148, targetTy: 11 },
      ],
      springs: [],
      pswitch: [],
      platforms: [],
      firebars: [],
      signs: [{ tx: 4, ty: 14, text: '水晶密室! 收集第3枚星币' }],
      enemies: [{ type: 'beetle', tx: 14, ty: 14, dir: -1 }],
      starCoins: [{ id: 2, tx: 13, ty: 5 }],
    };

    return {
      id: 1,
      code: '1-2',
      name: '幽深水晶矿洞',
      timeLimit: 340,
      areas: { main: mainArea, bonus: bonusArea },
    };
  }

  // ---- STAGE 1-3: SKY CANOPY ISLANDS ----
  function buildStage3() {
    const W = 202;
    const H = 17;
    const g = createGrid(W, H);
    const blockContents = {};
    const key = (x, y) => `${x},${y}`;

    // Floating sky islands
    addGround(g, 0, 16, 14);
    addGround(g, 19, 32, 13);
    addGround(g, 35, 44, 12);
    // Donut falling bridge across sky chasm 45..64!
    for (let x = 46; x <= 51; x++) g[12][x] = TILE.DONUT;
    addGround(g, 52, 57, 13); // Bill Blaster island
    for (let x = 58; x <= 63; x++) g[12][x] = TILE.DONUT;

    // Wall-jump Sky Pillars island 65..92
    addGround(g, 65, 92, 14);
    // Two tall climb pillars at tx 75 & tx 80
    fillRect(g, 75, 4, 1, 7, TILE.HARD);
    fillRect(g, 80, 4, 1, 10, TILE.HARD);
    g[4][76] = TILE.ONEWAY; g[4][77] = TILE.ONEWAY; g[4][78] = TILE.ONEWAY; g[4][79] = TILE.ONEWAY;
    // Also a step at tx 72 and spring at tx 73 for alternative route!
    g[13][71] = TILE.HARD;
    g[12][85] = TILE.ONEWAY; g[12][86] = TILE.ONEWAY; g[12][87] = TILE.ONEWAY;

    // Checkpoint & Spring Island 95..135
    addGround(g, 95, 114, 14);
    fillRect(g, 113, 8, 10, 1, TILE.ONEWAY); // High cloud highway!
    addPipe(g, 118, 6, 7); // Gold warp pipe to Cloud Heaven!
    fillRect(g, 118, 8, 2, 1, TILE.HARD);
    addGround(g, 117, 135, 14); // Lower route so never dead-end
    addPipe(g, 131, 12, 13);

    // Starman Sprint Finale Bridge 138..198
    addGround(g, 138, 174, 13);
    addGround(g, 177, 201, 14);

    // Bounce Mushroom Caps & Blocks
    g[11][12] = TILE.QUESTION; blockContents[key(12, 11)] = { kind: 'acorn' };
    g[12][15] = TILE.BOUNCE_CAP;
    g[12][22] = TILE.BOUNCE_CAP;
    g[8][25] = TILE.QUESTION; blockContents[key(25, 8)] = { kind: 'coin' };
    g[8][26] = TILE.QUESTION; blockContents[key(26, 8)] = { kind: 'fire' };
    addCoinsRow(g, 20, 29, 6);

    // Bill Blasters
    g[11][54] = TILE.HARD; // Blaster base
    g[12][54] = TILE.HARD;

    // Wall-jump reward
    g[10][86] = TILE.QUESTION; blockContents[key(86, 10)] = { kind: 'acorn' };
    // Starman block
    g[9][140] = TILE.QUESTION; blockContents[key(140, 9)] = { kind: 'star' };
    addCoinsRow(g, 146, 168, 10);

    addStair(g, 168, 12, 4, 1, TILE.HARD);

    const mainArea = {
      width: W,
      height: H,
      biome: BIOME.SKY,
      grid: g,
      blockContents,
      spawn: { tx: 3, ty: 12 },
      checkpoint: { tx: 97, ty: 13 },
      goal: { type: 'flagpole', tx: 183, ty: 13, castleTx: 188 },
      pipes: [
        { tx: 118, ty: 6, color: 'gold', dir: 'down', targetArea: 'bonus', targetTx: 3, targetTy: 4 },
        { tx: 131, ty: 12, color: 'green', dir: 'none' },
      ],
      springs: [
        { tx: 73, ty: 13 },
        { tx: 108, ty: 13 },
      ],
      blasters: [
        { tx: 54, ty: 11 },
        { tx: 162, ty: 12 },
      ],
      pswitch: [],
      platforms: [
        { x: 38 * 16, y: 9 * 16, w: 48, dx: 48, dy: 0, speed: 44 },
      ],
      firebars: [],
      signs: [
        { tx: 5, ty: 13, text: '长按跳跃可橡果滑翔! 甜甜圈桥会掉落' },
        { tx: 105, ty: 13, text: '弹簧弹上云端进入黄金水管!' },
      ],
      enemies: [
        { type: 'paratroopa', tx: 26, ty: 10, dir: -1 },
        { type: 'koopa_g', tx: 39, ty: 11, dir: -1 },
        { type: 'paratroopa', tx: 60, ty: 9, dir: -1 },
        { type: 'goomba', tx: 68, ty: 13, dir: -1 },
        { type: 'beetle', tx: 102, ty: 13, dir: -1 },
        { type: 'goomba', tx: 148, ty: 12, dir: -1 },
        { type: 'koopa_r', tx: 152, ty: 12, dir: -1 },
        { type: 'spiny', tx: 156, ty: 12, dir: -1 },
        { type: 'goomba', tx: 160, ty: 12, dir: -1 },
        { type: 'paratroopa', tx: 166, ty: 9, dir: -1 },
      ],
      starCoins: [
        { id: 0, tx: 55, ty: 5 },
        { id: 1, tx: 78, ty: 2 },
      ],
    };

    // Sub-area: 1-3 Rainbow Cloud Heaven
    const BW = 30;
    const bg = createGrid(BW, H);
    const bContents = {};
    addGround(bg, 0, BW - 1, 14);
    fillRect(bg, 5, 10, 16, 1, TILE.ONEWAY);
    addCoinsRow(bg, 6, 20, 9);
    addCoinsRow(bg, 8, 18, 7);
    bg[11][12] = TILE.QUESTION; bContents[key(12, 11)] = { kind: '1up' };
    addPipe(bg, 25, 12, 13);

    const bonusArea = {
      width: BW,
      height: H,
      biome: BIOME.SKY,
      grid: bg,
      blockContents: bContents,
      pipes: [
        { tx: 25, ty: 12, color: 'gold', dir: 'down', targetArea: 'main', targetTx: 131, targetTy: 10 },
      ],
      springs: [{ tx: 14, ty: 13 }],
      pswitch: [],
      platforms: [],
      firebars: [],
      signs: [{ tx: 4, ty: 13, text: '云端金币天堂!' }],
      enemies: [],
      starCoins: [{ id: 2, tx: 14, ty: 5 }],
    };

    return {
      id: 2,
      code: '1-3',
      name: '云端橡树浮岛',
      timeLimit: 340,
      areas: { main: mainArea, bonus: bonusArea },
    };
  }

  // ---- STAGE 1-4: BOWSER'S LAVA FORTRESS ----
  function buildStage4() {
    const W = 184;
    const H = 17;
    const g = createGrid(W, H);
    const blockContents = {};
    const key = (x, y) => `${x},${y}`;

    // Castle ceiling & lava bed
    fillRect(g, 0, 0, W, 2, TILE.GROUND_DEEP);
    fillRect(g, 0, 15, W, 1, TILE.LAVA_TOP);
    fillRect(g, 0, 16, W, 1, TILE.LAVA_BODY);

    // Solid castle floors & lava gaps
    addGround(g, 0, 19, 13);
    // Lava gap 20..22
    addGround(g, 23, 33, 13);
    // Lava gap 34..36
    addGround(g, 37, 77, 13);
    // Thwomp pit alcove at tx 58..62 (floor at ty 14, open above)
    fillRect(g, 58, 13, 5, 1, TILE.EMPTY);
    fillRect(g, 58, 14, 5, 1, TILE.GROUND);

    // On/Off Lava Ferry chasm 78..107 (only lava below!)
    addGround(g, 108, 131, 13);

    // On/Off Gates in lava ferry chasm
    g[8][86] = TILE.ON_OFF_SWITCH;
    fillRect(g, 90, 5, 1, 7, TILE.RED_BLOCK);
    g[8][96] = TILE.ON_OFF_SWITCH;
    fillRect(g, 100, 5, 1, 7, TILE.BLUE_BLOCK);

    // Pre-boss supply room & wall-jump nook for Star Coin #3
    fillRect(g, 111, 5, 1, 5, TILE.HARD);
    fillRect(g, 116, 2, 1, 6, TILE.HARD);
    g[9][113] = TILE.ONEWAY; g[9][114] = TILE.ONEWAY; g[9][115] = TILE.ONEWAY;
    g[9][120] = TILE.QUESTION; blockContents[key(120, 9)] = { kind: 'fire' };
    g[9][122] = TILE.QUESTION; blockContents[key(122, 9)] = { kind: 'acorn' };

    // First Fire Bar Corridor blocks
    g[9][16] = TILE.QUESTION; blockContents[key(16, 9)] = { kind: 'mushroom' };
    g[9][28] = TILE.HARD; // Firebar mount 1
    g[9][43] = TILE.HARD; // Firebar mount 2

    // Bowser Arena Bridge (tx 132..155) + Pedestal (tx 156..158) + Peach Chamber (160..183)
    for (let x = 132; x <= 155; x++) g[12][x] = TILE.BRIDGE;
    fillRect(g, 139, 8, 6, 1, TILE.BRICK);
    g[8][142] = TILE.POW_BLOCK;
    addGround(g, 156, 183, 12);
    fillRect(g, 181, 2, 3, 10, TILE.HARD);

    const mainArea = {
      width: W,
      height: H,
      biome: BIOME.CASTLE,
      grid: g,
      blockContents,
      spawn: { tx: 3, ty: 11 },
      checkpoint: { tx: 112, ty: 12 },
      goal: {
        type: 'bowser_arena',
        bridgeTx: 132,
        bridgeLen: 24,
        bridgeTy: 12,
        axeTx: 157,
        axeTy: 11,
        peachTx: 172,
        peachTy: 11,
      },
      bowser: { tx: 149, ty: 10 },
      pipes: [],
      springs: [],
      pswitch: [],
      platforms: [
        { x: 79 * 16, y: 12 * 16, w: 48, dx: 24 * 16, dy: 0, speed: 44 },
      ],
      firebars: [
        { tx: 28, ty: 9, len: 5, speed: 2.1, angle: 0 },
        { tx: 43, ty: 9, len: 5, speed: -2.2, angle: 1.5 },
        { tx: 135, ty: 5, len: 4, speed: 1.9, angle: 0.7 },
      ],
      thwomps: [
        { tx: 51, ty: 4 },
        { tx: 60, ty: 4 },
        { tx: 70, ty: 4 },
      ],
      signs: [
        { tx: 5, ty: 12, text: '终极城堡! 躲避火棒与石像 Thwomp' },
        { tx: 125, ty: 12, text: '前方酷霸王! 砍断斧头或用火球/POW击败它!' },
      ],
      enemies: [
        { type: 'drybones', tx: 15, ty: 12, dir: -1 },
        { type: 'spiny', tx: 31, ty: 12, dir: -1 },
        { type: 'drybones', tx: 46, ty: 12, dir: -1 },
        { type: 'drybones', tx: 65, ty: 12, dir: -1 },
      ],
      starCoins: [
        { id: 0, tx: 60, ty: 12 },
        { id: 1, tx: 93, ty: 9 },
        { id: 2, tx: 114, ty: 4 },
      ],
    };

    return {
      id: 3,
      code: '1-4',
      name: '酷霸王熔岩堡垒',
      timeLimit: 360,
      areas: { main: mainArea },
    };
  }

  function createStageList() {
    return [buildStage1(), buildStage2(), buildStage3(), buildStage4()];
  }

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.OVERWORLD_NODES = OVERWORLD_NODES;
  global.MarioGame.createStageList = createStageList;
})(window);

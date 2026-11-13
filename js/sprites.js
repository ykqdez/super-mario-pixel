(function (global) {
  'use strict';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function renderMatrix(rows, palette, flipX) {
    const h = rows.length;
    const w = rows[0].length;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      if (row.length !== w) {
        throw new Error(`Sprite row width mismatch at row ${y}: expected ${w}, got ${row.length}`);
      }
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (!col) {
          throw new Error(`Missing palette key '${ch}' in sprite matrix`);
        }
        ctx.fillStyle = col;
        const dx = flipX ? w - 1 - x : x;
        ctx.fillRect(dx, y, 1, 1);
      }
    }
    return c;
  }

  // ---- MARIO PALETTES ----
  const MARIO_PALETTES = {
    normal: {
      O: '#181010', // outline / dark
      R: '#e62e20', // cap & shirt red
      r: '#ff6448', // highlight red
      B: '#1e58cc', // overalls blue
      b: '#4c8eff', // overalls highlight
      S: '#ffcca0', // skin
      s: '#e09860', // skin shadow
      H: '#5a2c10', // hair / mustache / boots
      h: '#8c4b1e', // boot highlight
      Y: '#ffd838', // gold buttons
      W: '#ffffff', // gloves
      A: '#944a16', // acorn accent (unused in normal)
      a: '#d98a36',
    },
    fire: {
      O: '#181010',
      R: '#f8f8ff', // white cap & shirt
      r: '#cce0ff',
      B: '#e62e20', // red overalls
      b: '#ff6448',
      S: '#ffcca0',
      s: '#e09860',
      H: '#5a2c10',
      h: '#8c4b1e',
      Y: '#ffd838',
      W: '#ffffff',
      A: '#ff9020',
      a: '#ffd838',
    },
    acorn: {
      O: '#181010',
      R: '#9c4e18', // oak acorn cap brown
      r: '#d98a38', // acorn highlight
      B: '#d83a24', // crimson overalls
      b: '#ff6b4a',
      S: '#ffcca0',
      s: '#e09860',
      H: '#4a2208',
      h: '#7a3c12',
      Y: '#ffe89a', // cream acorn rim / tail stripe
      W: '#fff4d4',
      A: '#c46b22', // tail brown
      a: '#ffe89a', // tail cream stripe
    },
    star0: {
      O: '#2a1800', R: '#ffe030', r: '#ffffff', B: '#ff6a00', b: '#ffb440',
      S: '#fff6b0', s: '#ffd040', H: '#9a5800', h: '#d88c00', Y: '#ffffff', W: '#ffffff', A: '#ffe030', a: '#ffffff',
    },
    star1: {
      O: '#002838', R: '#30f0ff', r: '#ffffff', B: '#1078ff', b: '#78b8ff',
      S: '#d0ffff', s: '#70d8ff', H: '#004878', h: '#0088c8', Y: '#ffffff', W: '#ffffff', A: '#30f0ff', a: '#ffffff',
    },
    star2: {
      O: '#300028', R: '#ff48d8', r: '#ffffff', B: '#9820ff', b: '#d078ff',
      S: '#ffd0f8', s: '#ff88e0', H: '#600050', h: '#a82098', Y: '#ffffff', W: '#ffffff', A: '#ff48d8', a: '#ffffff',
    },
    star3: {
      O: '#082c10', R: '#48ff78', r: '#ffffff', B: '#10b048', b: '#68e890',
      S: '#d8ffe0', s: '#78ee98', H: '#085020', h: '#209840', Y: '#ffffff', W: '#ffffff', A: '#48ff78', a: '#ffffff',
    },
  };

  // Small Mario 16x16 matrices
  const SMALL_MARIO = {
    idle: [
      '....RRRRRr......',
      '...RRRRRRRRr....',
      '...HHHSSSH......',
      '..HSHSSSHSS.....',
      '..HSHHSSSHSS....',
      '..HHSSSSHHHH....',
      '....SSSSSSS.....',
      '...RRBRRBR......',
      '..RRRBRRBRRR....',
      '..WWBBBBBBWW....',
      '..WWBYBBYBWW....',
      '...BBBBBBBB.....',
      '...BBB..BBB.....',
      '..HHH....HHH....',
      '.HHHH....HHHH...',
      '................',
    ],
    walk1: [
      '....RRRRRr......',
      '...RRRRRRRRr....',
      '...HHHSSSH......',
      '..HSHSSSHSS.....',
      '..HSHHSSSHSS....',
      '..HHSSSSHHHH....',
      '....SSSSSSS.....',
      '...RRBRRBR......',
      '..WWBBBBBBWW....',
      '..WWBYBBYBWW....',
      '...BBBBBBBB.....',
      '...BBB..BBB.....',
      '..HHH....HHH....',
      '.HHHH.....HHH...',
      '................',
      '................',
    ],
    walk2: [
      '....RRRRRr......',
      '...RRRRRRRRr....',
      '...HHHSSSH......',
      '..HSHSSSHSS.....',
      '..HSHHSSSHSS....',
      '..HHSSSSHHHH....',
      '....SSSSSSS.....',
      '..RRRBRRBR......',
      '..WWBBBBBB......',
      '...WBYBBYBW.....',
      '...BBBBBBBB.....',
      '....BBBBBB......',
      '...HHH..HHH.....',
      '...HHH...HHH....',
      '................',
      '................',
    ],
    walk3: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHHSSSHSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSS....',
      '...RRRBRRBRR....',
      '..WW.BBBBBB.WW..',
      '..W..BYBBYB..W..',
      '....BBBBBBBB....',
      '...BBBB..BBBB...',
      '..HHH......HHH..',
      '..HHH......HHH..',
      '................',
      '................',
    ],
    jump: [
      '.....RRRRRr..WW.',
      '....RRRRRRRRrWW.',
      '....HHHSSSH..R..',
      '...HSHSSSHSSR...',
      '...HSHHSSSHSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSS....',
      '..WW.RRBRRBR....',
      '..WWBBBBBBBB....',
      '....BYBBYBBB....',
      '...BBBBBBBB.....',
      '..HHH....BBBB...',
      '.HHHH.....HHH...',
      '..........HHHH..',
      '................',
      '................',
    ],
    skid: [
      '....RRRRRr......',
      '...RRRRRRRRr....',
      '...HHHSSSH......',
      '..HSHSSSHSS.....',
      '..HSHHSSSHSS....',
      '..HHSSSSHHHH....',
      '....SSSSSSS.....',
      '..WW.RRBRR......',
      '..WWBBBBBBWW....',
      '....BYBBYBWW....',
      '...BBBBBBBB.....',
      '..BBBB..BBB.....',
      '.HHHH....HHH....',
      '.HHH......HHHH..',
      '................',
      '................',
    ],
    crouch: [
      '................',
      '................',
      '....RRRRRr......',
      '...RRRRRRRRr....',
      '...HHHSSSH......',
      '..HSHSSSHSS.....',
      '..HSHHSSSHSS....',
      '..HHSSSSHHHH....',
      '...RRBBBBBRR....',
      '..WWBYBBYBWW....',
      '..WWBBBBBBWW....',
      '...BBBBBBBB.....',
      '..HHHH..HHHH....',
      '.HHHHH..HHHHH...',
      '................',
      '................',
    ],
    dead: [
      '....RRRRRr......',
      '...RRRRRRRRr....',
      '...HHHSSSH......',
      '..HSHOSSSHSS....',
      '..HSHHSSSHSS....',
      '..HHSSSSHHHH....',
      '..WW.SSSSS..WW..',
      '..WW.RRBRR..WW..',
      '....BBBBBBB.....',
      '....BYBBYBB.....',
      '...BBBBBBBB.....',
      '..HHH....HHH....',
      '.HHHH....HHHH...',
      '................',
      '................',
      '................',
    ],
  };

  // Big / Super / Fire / Acorn Mario 16x24 matrices
  const BIG_MARIO = {
    idle: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSSS...',
      '....RRRBRRR.....',
      '...RRRRBRRRR....',
      '..RRRRBBBBBRR...',
      '..WW.BBYBBYBB...',
      '..WW.BBBBBBBB...',
      '..W..BBBBBBBB...',
      '.....BBBBBBBB...',
      '....BBBB..BBBB..',
      '....BBBB..BBBB..',
      '....BBB....BBB..',
      '...HHHH....HHHH.',
      '..HHHHH....HHHHH',
      '..HHHHH....HHHHH',
      '................',
      '................',
      '................',
    ],
    walk1: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSSS...',
      '....RRRBRRR.....',
      '...RRRRBRRRWW...',
      '..WWRRRBBBBWW...',
      '..WW.BBYBBYB....',
      '.....BBBBBBBB...',
      '.....BBBBBBBB...',
      '....BBBB..BBBB..',
      '...BBBB....BBBB.',
      '...BBB......BBB.',
      '..HHHH......HHH.',
      '.HHHHH......HHHH',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    walk2: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSSS...',
      '....RRRBRRR.....',
      '...RRRRBRRRR....',
      '...RRRRBBBBRR...',
      '....BBYBBYBWW...',
      '....BBBBBBBWW...',
      '.....BBBBBBB....',
      '....BBBBBBBB....',
      '....BBBBBBBB....',
      '....HHH..HHH....',
      '...HHHH..HHHH...',
      '...HHHH...HHHH..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    walk3: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSSS...',
      '....RRRBRRR.....',
      '..WWRRRBRRRWW...',
      '..WW.RRBBBBRR...',
      '.....BBYBBYB....',
      '....BBBBBBBBB...',
      '...BBBBBBBBBB...',
      '..BBBB....BBBB..',
      '..HHH......BBB..',
      '.HHHH......HHHH.',
      '.HHHH......HHHH.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    jump: [
      '.....RRRRRr..WW.',
      '....RRRRRRRRrWW.',
      '....RRRRRRRRRR..',
      '....HHHSSSH.RR..',
      '...HSHSSSHSSR...',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSSS...',
      '..WW.RRRBRRR....',
      '..WWRRRRBRRR....',
      '....RRRBBBBBB...',
      '.....BBYBBYBB...',
      '.....BBBBBBBB...',
      '....BBBBBBBB....',
      '...BBBB..BBBB...',
      '..HHHH....BBBB..',
      '.HHHHH.....HHH..',
      '.HHHH......HHHH.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    fall: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '..WW.SSSSSSSSWW.',
      '..WWRRRBRRRRWW..',
      '....RRRBBBBBR...',
      '.....BBYBBYB....',
      '.....BBBBBBB....',
      '....BBBBBBBB....',
      '....BBBB.BBBB...',
      '...HHHH...BBBB..',
      '..HHHH.....HHHH.',
      '...........HHHH.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    skid: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '.....SSSSSSSS...',
      '...WW.RRBRRR....',
      '...WWRRRBRRRR...',
      '.....RRRBBBBWW..',
      '.....BBYBBYBWW..',
      '.....BBBBBBB....',
      '....BBBBBBBB....',
      '...BBBB..BBBB...',
      '..HHHH....HHH...',
      '.HHHHH....HHHH..',
      '.HHHH......HHHH.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    crouch: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHSSSH.....',
      '...HSHSSSHSS....',
      '...HSHSSSHSSS...',
      '...HHSSSSHHHH...',
      '....RRRRBBBBR...',
      '...WWRRBYBBYBW..',
      '...WWRRBBBBBBW..',
      '....BBBBBBBBBB..',
      '...HHHHH..HHHHH.',
      '..HHHHHH..HHHHHH',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    spin: [
      '.....RRRRRr.....',
      '....RRRRRRRRr...',
      '....RRRRRRRRRR..',
      '....HHHHHHHH....',
      '...HHSSSSSSHH...',
      '...HSSSSSSSSS...',
      '....SSSSSSSS....',
      '....RRRRRRRR....',
      '..WWRRRRRRRRWW..',
      '..WWBBBBBBBBWW..',
      '....BBYBBYBB....',
      '....BBBBBBBB....',
      '....BBBBBBBB....',
      '....BBB..BBB....',
      '...HHHH..HHHH...',
      '...HHHH..HHHH...',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  };

  // ---- ENEMY & NPC PALETTES + MATRICES ----
  const ENEMY_PAL = {
    O: '#181010',
    G: '#a65424', // goomba brown
    g: '#d87c3c', // goomba highlight
    T: '#ffe0b0', // tan/cream
    D: '#4a240c', // dark brown
    W: '#ffffff',
    K: '#28a830', // koopa green
    k: '#70e860',
    R: '#d82820', // red koopa / spiny / piranha
    r: '#ff6850',
    Y: '#ffd838',
    y: '#fff2a0',
    B: '#2848a0', // buzzy beetle blue
    b: '#5888e8',
    S: '#9098a8', // stone / thwomp / bullet
    s: '#c8d0e0',
    d: '#485060',
    P: '#ff90b8', // peach pink
    p: '#ffc8e0',
    C: '#e8d8b0', // bone / cream
    F: '#ff7018', // flame orange
    N: '#202028', // near black
  };

  const ENEMY_MATRICES = {
    goomba_1: [
      '......GGGG......',
      '....GGGGGGGG....',
      '...GGGGGGGGGG...',
      '..GGGGGGGGGGGG..',
      '.GGGOOGGGGOOGGG.',
      '.GGGWOGGGGOWGGG.',
      '.GGGWOGGGGOWGGG.',
      '.GGGGGGGGGGGGGG.',
      '..GGGGTTTTGGGG..',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '...DDDD..DDDD...',
      '..DDDDD..DDDD...',
      '..DDDDD...DDD...',
      '................',
      '................',
    ],
    goomba_2: [
      '......GGGG......',
      '....GGGGGGGG....',
      '...GGGGGGGGGG...',
      '..GGGGGGGGGGGG..',
      '.GGGOOGGGGOOGGG.',
      '.GGGWOGGGGOWGGG.',
      '.GGGWOGGGGOWGGG.',
      '.GGGGGGGGGGGGGG.',
      '..GGGGTTTTGGGG..',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '...DDDD..DDDD...',
      '...DDD...DDDDD..',
      '..DDD....DDDDD..',
      '................',
      '................',
    ],
    goomba_flat: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..GGGGGGGGGGGG..',
      '.GGGOOGGGGOOGGG.',
      'GGGGGGGGGGGGGGGG',
      'GGTTTTTTTTTTTTGG',
      '.DDDDDDDDDDDDDD.',
      '................',
      '................',
      '................',
    ],
    koopa_g_1: [
      '.........YYYY...',
      '........YYWWYY..',
      '........YYWOYY..',
      '........YYYYYY..',
      '...KKKK..YYYY...',
      '..KkKKKK.YYY....',
      '.KkKKKKKKYYY....',
      '.KKKKKKKKKKY....',
      '.KKKKkKKKKKK....',
      '.WWWWWWWWWWW....',
      '..TTTTTTTTTT....',
      '...TTTTTTTT.....',
      '...YYYY..YYYY...',
      '..YYYYY..YYYY...',
      '..YYYY....YYY...',
      '................',
    ],
    koopa_g_2: [
      '.........YYYY...',
      '........YYWWYY..',
      '........YYWOYY..',
      '........YYYYYY..',
      '...KKKK..YYYY...',
      '..KkKKKK.YYY....',
      '.KkKKKKKKYYY....',
      '.KKKKKKKKKKY....',
      '.KKKKkKKKKKK....',
      '.WWWWWWWWWWW....',
      '..TTTTTTTTTT....',
      '...TTTTTTTT.....',
      '....YYY..YYY....',
      '...YYYY..YYYY...',
      '...YYY....YYYY..',
      '................',
    ],
    koopa_g_shell: [
      '................',
      '................',
      '................',
      '....KKKKKKKK....',
      '..KKkKKKKKKkKK..',
      '.KkKKKKKKKKKKkK.',
      '.KKKKKKKKKKKKKK.',
      '.KKKkKKKKKKkKKK.',
      '.WWWWWWWWWWWWWW.',
      '..TTTTTTTTTTTT..',
      '...TTTTTTTTTT...',
      '....OOOOOOOO....',
      '................',
      '................',
      '................',
      '................',
    ],
    koopa_g_spin: [
      '................',
      '................',
      '................',
      '....KKKKKKKK....',
      '..KKKKkKKkKKKK..',
      '.KKKKWWWWWWKKKK.',
      '.KKKKKKKKKKKKKK.',
      '.KKkKKKKKKKKkKK.',
      '.WWWWWWWWWWWWWW.',
      '..TTTTTTTTTTTT..',
      '...TTTTTTTTTT...',
      '....OOOOOOOO....',
      '................',
      '................',
      '................',
      '................',
    ],
    beetle_1: [
      '................',
      '................',
      '.....BBBBBB.....',
      '...BBBBbBBBBB...',
      '..BBBbBBBBBBBB..',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBB.',
      '.WWWWWWWWWWWWWW.',
      '..OOOTTTTTTOOO..',
      '..OWWTTTTTTWWO..',
      '..YYYY....YYYY..',
      '.YYYYY....YYYY..',
      '................',
      '................',
      '................',
    ],
    beetle_2: [
      '................',
      '................',
      '.....BBBBBB.....',
      '...BBBBbBBBBB...',
      '..BBBbBBBBBBBB..',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBB.',
      '.WWWWWWWWWWWWWW.',
      '..OOOTTTTTTOOO..',
      '..OWWTTTTTTWWO..',
      '...YYYY..YYYY...',
      '...YYYY..YYYYY..',
      '................',
      '................',
      '................',
    ],
    beetle_shell: [
      '................',
      '................',
      '................',
      '.....BBBBBB.....',
      '...BBBBbBBBBB...',
      '..BBBbBBBBBBBB..',
      '.BBBBBBBBBBBBBB.',
      '.BBBBBBBBBBBBBB.',
      '.WWWWWWWWWWWWWW.',
      '..TTTTTTTTTTTT..',
      '...OOOOOOOOOO...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    spiny_1: [
      '......W..W......',
      '....W.W..W.W....',
      '...WRRRRRRRRW...',
      '..WRRRRRRRRRRW..',
      '.WRRWRRRRRRWRRW.',
      '.RRRRRRRRRRRRRR.',
      'WRRRRRRRRRRRRRRW',
      '.RRRRRRRRRRRRRR.',
      '.TTTTTTTTTTTTTT.',
      '..TTWWTTTTWWTT..',
      '..TTWOTTTTWOTT..',
      '..YYYY....YYYY..',
      '.YYYYY....YYYY..',
      '................',
      '................',
      '................',
    ],
    spiny_2: [
      '......W..W......',
      '....W.W..W.W....',
      '...WRRRRRRRRW...',
      '..WRRRRRRRRRRW..',
      '.WRRWRRRRRRWRRW.',
      '.RRRRRRRRRRRRRR.',
      'WRRRRRRRRRRRRRRW',
      '.RRRRRRRRRRRRRR.',
      '.TTTTTTTTTTTTTT.',
      '..TTWWTTTTWWTT..',
      '..TTWOTTTTWOTT..',
      '...YYYY..YYYY...',
      '...YYYY..YYYYY..',
      '................',
      '................',
      '................',
    ],
    piranha_1: [
      '..W..........W..',
      '.WWR........RWW.',
      '.WWRWR....RWRWW.',
      '.RRRRWRRRWRRRRR.',
      '.RRWRRRRRRRRWRR.',
      '..RRRRWRRWRRRR..',
      '..RRWRRRRRRWRR..',
      '...RRRRRRRRRR...',
      '....KKKKKKKK....',
      '..KK..KKKK..KK..',
      '.KKK..KKKK..KKK.',
      '.KKKK.KKKK.KKKK.',
      '..KKKKKKKKKKKK..',
      '......KKKK......',
      '......KKKK......',
      '......KKKK......',
    ],
    piranha_2: [
      '................',
      '....RRRRRRRR....',
      '..RRRWRRRRWRRR..',
      '.RRRRRRRRRRRRRR.',
      '.RRWRRRWWWRRWRR.',
      '.RRRRWWWWWWRRRR.',
      '..RRRRRRRRRRRR..',
      '...RRRRRRRRRR...',
      '....KKKKKKKK....',
      '..KK..KKKK..KK..',
      '.KKK..KKKK..KKK.',
      '.KKKK.KKKK.KKKK.',
      '..KKKKKKKKKKKK..',
      '......KKKK......',
      '......KKKK......',
      '......KKKK......',
    ],
    bullet_bill: [
      '................',
      '....NNNNNNNNNNN.',
      '..NNssNNNNNNNNNN',
      '.NNsNNNNNNNNNNNN',
      '.NNNNWWONNNNNNN.',
      'NNNNNWONNNNNNNNN',
      'NNNNNNNNNNNNNNNN',
      'NNNNNNNNNNNNNNN.',
      '.NNNNNNNNNNNNNN.',
      '.NNNNNNNNNNNNNNN',
      '..NNNNNNNNNNNNNN',
      '....NNNNNNNNNNN.',
      '................',
      '................',
      '................',
      '................',
    ],
    drybones_1: [
      '.........CCCC...',
      '........CCWWCC..',
      '........CCWOCC..',
      '........CCCCCC..',
      '...CCCC..CCCC...',
      '..CWWWWC.CCC....',
      '.CWWCCWWCCCC....',
      '.CCCCCCCSSC.....',
      '.CWWWWWWWWC.....',
      '..CCCCCCCC......',
      '...CCCCCC.......',
      '...CCC..CCC.....',
      '..CCCC..CCCC....',
      '..CCC....CCC....',
      '................',
      '................',
    ],
    drybones_2: [
      '.........CCCC...',
      '........CCWWCC..',
      '........CCWOCC..',
      '........CCCCCC..',
      '...CCCC..CCCC...',
      '..CWWWWC.CCC....',
      '.CWWCCWWCCCC....',
      '.CCCCCCCSSC.....',
      '.CWWWWWWWWC.....',
      '..CCCCCCCC......',
      '...CCCCCC.......',
      '....CCC..CCC....',
      '...CCCC..CCCC...',
      '...CCC....CCCC..',
      '................',
      '................',
    ],
    drybones_pile: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....CCCC........',
      '..CCWWCC..CCCC..',
      '.CWWWWWWCCCCCC..',
      '.CCCCCCCCCCCCC..',
      '................',
      '................',
      '................',
    ],
  };

  // Bowser 32x32 pixel art!
  const BOWSER_MATRICES = {
    idle1: [
      '................................',
      '..........W.......W.............',
      '.........WW......WW.............',
      '........WYYW....WYYW............',
      '.......KKKKKK..KKKKKK...........',
      '......KKKKKKKKKKKKKKKK..........',
      '.....KKKRRRRRRRRRRKKKKK.........',
      '.....KKRRWWORRRRWWORRKK.........',
      '....KKKKKWOORRRRWOORKKK.........',
      '....KKKKKKKKKKKKKKKKKKK...W.....',
      '....KKKKKYYYYYYYYYYKKKK..WW.....',
      '....KKKWYYYYYYYYYYYYKK..WKKW....',
      '....KKKWYYWWWWWWYYYYK..KKKKKW...',
      '.....KKKKYYYYYYYYYYK..KKKKKKKW..',
      '......KKKKKKKKKKKKK..KKrKKKKKW..',
      '.....TTTTTTTTTTTTTT.KKrrKKKKKK..',
      '....TTTTYYYYYYYYTTTTKKKKKKKKKK..',
      '...TTTTTYYYYYYYYTTTTKKKKKKKKKKW.',
      '..KKKKTTYYYYYYYYTTTKKKKKKKKKKKW.',
      '.WKKKKTTYYYYYYYYTTTKKKKKKKKKKK..',
      '..KKKKTTYYYYYYYYTTTKKKKKKKKKW...',
      '...KKKTTYYYYYYYYTTTKKKKKKKKK....',
      '......TTYYYYYYYYTTTKKKKKKKK.....',
      '......TTTTYYYYTTTTTKKKKKKK......',
      '......TTTTT..TTTTT..KKKKKK......',
      '.....KKKKK....KKKKK..KKKK.......',
      '....KKKKKK....KKKKKK............',
      '...WWKKKK......WWKKKK...........',
      '...W.KKKK......W.KKKK...........',
      '................................',
      '................................',
      '................................',
    ],
    roar: [
      '..........W.......W.............',
      '.........WW......WW.............',
      '........WYYW....WYYW............',
      '.......KKKKKK..KKKKKK...........',
      '......KKKKKKKKKKKKKKKK..........',
      '.....KKKRRRRRRRRRRKKKKK.........',
      '.....KKRRWWORRRRWWORRKK.........',
      '....KKKKKWOORRRRWOORKKK.........',
      '....KKKKKKKKKKKKKKKKKKK...W.....',
      '...KKKKKKKKKKKKKKKKKKKK..WW.....',
      '..WWKKKKKKKKKKKKKKKKKK..WKKW....',
      '..FFRRRRRRRRKKKKKKKKK..KKKKKW...',
      '.FFORRRRRRRRRKKKKKKK..KKKKKKKW..',
      '..FFWWWWWWWWWKKKKKK..KKrKKKKKW..',
      '....YYYYYYYYYKKKKK..KKrrKKKKKK..',
      '....TTTTTTTTTTTTTT..KKKKKKKKKK..',
      '...TTTTTYYYYYYYYTTT.KKKKKKKKKKW.',
      '..KKKKTTYYYYYYYYTTTKKKKKKKKKKKW.',
      '.WKKKKTTYYYYYYYYTTTKKKKKKKKKKK..',
      '..KKKKTTYYYYYYYYTTTKKKKKKKKKW...',
      '...KKKTTYYYYYYYYTTTKKKKKKKKK....',
      '......TTYYYYYYYYTTTKKKKKKKK.....',
      '......TTTTYYYYTTTTTKKKKKKK......',
      '......TTTTT..TTTTT..KKKKKK......',
      '.....KKKKK....KKKKK..KKKK.......',
      '....KKKKKK....KKKKKK............',
      '...WWKKKK......WWKKKK...........',
      '...W.KKKK......W.KKKK...........',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  };

  // Thwomp 24x24
  const THWOMP_CALM = [
    '..S..S..S..S..S..S..S...',
    '.SSSSSSSSSSSSSSSSSSSSS..',
    'SSsssssssssssssssssssSS.',
    'SSsSSSSSSSSSSSSSSSSSsSS.',
    'SSsSSddSSSSSSSSSddSSsSS.',
    'SSsSdddSSSSSSSSSdddSsSS.',
    'SSsSdWWdSSSSSSSdWWdSsSS.',
    'SSsSdWOdSSSSSSSdWOdSsSS.',
    'SSsSSddSSSSSSSSSddSSsSS.',
    'SSsSSSSSSSSdSSSSSSSSsSS.',
    'SSsSSSSSSSdddSSSSSSSsSS.',
    'SSsSSSSSSSdSdSSSSSSSsSS.',
    'SSsSSSSSSSSSSSSSSSSSsSS.',
    'SSsSSSdddddddddddSSSsSS.',
    'SSsSSdWWWWWWWWWWWdSSsSS.',
    'SSsSSdWdWdWdWdWdWdSSsSS.',
    'SSsSSdWWWWWWWWWWWdSSsSS.',
    'SSsSSSdddddddddddSSSsSS.',
    'SSsSSSSSSSSSSSSSSSSSsSS.',
    'SSdddddddddddddddddddSS.',
    '.SSSSSSSSSSSSSSSSSSSSS..',
    '..S..S..S..S..S..S..S...',
    '........................',
    '........................',
  ];
  const THWOMP_MAD = [
    '..S..S..S..S..S..S..S...',
    '.SSSSSSSSSSSSSSSSSSSSS..',
    'SSsssssssssssssssssssSS.',
    'SSsSSSSSSSSSSSSSSSSSsSS.',
    'SSsSRRRSSSSSSSSSRRRSsSS.',
    'SSsSSRRRRSSSSSRRRRSsSS..',
    'SSsSdRRRSSSSSSSRRRdSsSS.',
    'SSsSdWROdSSSSSdWORdSsSS.',
    'SSsSSddSSSSSSSSSddSSsSS.',
    'SSsSSSSSSSSdSSSSSSSSsSS.',
    'SSsSSSSSSSdddSSSSSSSsSS.',
    'SSsSSSSSSSdSdSSSSSSSsSS.',
    'SSsSSdWWWWWWWWWWWdSSsSS.',
    'SSsSSdWdddddddddWdSSsSS.',
    'SSsSSdWdRRRRRRRdWdSSsSS.',
    'SSsSSdWdRRRRRRRdWdSSsSS.',
    'SSsSSdWdddddddddWdSSsSS.',
    'SSsSSdWWWWWWWWWWWdSSsSS.',
    'SSsSSSSSSSSSSSSSSSSSsSS.',
    'SSdddddddddddddddddddSS.',
    '.SSSSSSSSSSSSSSSSSSSSS..',
    '..S..S..S..S..S..S..S...',
    '........................',
    '........................',
  ];

  // Princess Peach 16x24
  const PEACH_MATRIX = [
    '.....YYYYYY.....',
    '....YRYRYRYR....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...',
    '...YYYSSSSYYY...',
    '..YYYSOSSOSYYY..',
    '..YYYSSSSSSYYY..',
    '...YYYSSSSYYY...',
    '....YYSSSSYY....',
    '.....PPPPPP.....',
    '....PPPPPPPP....',
    '...PPpPPPPpPP...',
    '..WPPpPPPPpPPW..',
    '..W.PPPPPPPP.W..',
    '....PPPPPPPP....',
    '...PPPPPPPPPP...',
    '..PPPPpPPpPPPP..',
    '..PPPPPPPPPPPP..',
    '.PPPPPPPPPPPPPP.',
    '.PPPPpPPPPpPPPP.',
    '.PPPPPPPPPPPPPP.',
    '..WWWWWWWWWWWW..',
    '................',
    '................',
  ];

  // Toad 16x16
  const TOAD_MATRIX = [
    '....WWWWWWWW....',
    '..WWWRRWWWRRWW..',
    '.WWWRRRRWWWRRWW.',
    '.WWWWWWWWWWWWWW.',
    '.WRRWWWWWWWWRRW.',
    '..RRWWWWWWWWRR..',
    '....SSSSSSSS....',
    '...SSSOSSSOSS...',
    '...SSSOSSSOSS...',
    '....SSSSSSSS....',
    '...BBBBBBBBBB...',
    '..WWBBBBBBBBWW..',
    '....WWWWWWWW....',
    '...DDDD..DDDD...',
    '..DDDD....DDDD..',
    '................',
  ];

  // Items 16x16
  const ITEM_PAL = {
    O: '#181010',
    R: '#e62e20',
    r: '#ff6e50',
    W: '#ffffff',
    C: '#ffe8b8',
    G: '#28b838',
    g: '#78f078',
    Y: '#ffd838',
    y: '#fff4a0',
    D: '#d08810',
    A: '#9a4c18',
    a: '#d6822c',
    K: '#20a030',
    F: '#ff7018',
  };

  const ITEM_MATRICES = {
    mushroom_super: [
      '.....OOOOOO.....',
      '...OORRRRRROO...',
      '..ORWWWRRWWWRo..'.replace('o', 'O'),
      '.ORWWWWrrWWWWRO.',
      '.ORWWWWrrWWWWRO.',
      'ORRRRrRRRRrRRRRO',
      'ORWWWRRRRRRWWWRO',
      'ORWWWRRRRRRWWWRO',
      'OORRRRRRRRRRRROO',
      '.OOOOOOOOOOOOOO.',
      '..OOCCCCCCCCOO..',
      '..OCOOCCCCOOCO..',
      '..OCOOCCCCOOCO..',
      '..OCCCCCCCCCCO..',
      '...OCCCCCCCCO...',
      '....OOOOOOOO....',
    ],
    mushroom_1up: [
      '.....OOOOOO.....',
      '...OOGGGGGGOO...',
      '..OGWWWGGWWWGO..',
      '.OGWWWWggWWWWGO.',
      '.OGWWWWggWWWWGO.',
      'OGGGGgGGGGgGGGGO',
      'OGWWWGGGGGGWWWGO',
      'OGWWWGGGGGGWWWGO',
      'OOGGGGGGGGGGGGOO',
      '.OOOOOOOOOOOOOO.',
      '..OOCCCCCCCCOO..',
      '..OCOOCCCCOOCO..',
      '..OCOOCCCCOOCO..',
      '..OCCCCCCCCCCO..',
      '...OCCCCCCCCO...',
      '....OOOOOOOO....',
    ],
    fire_flower_1: [
      '....OOOOOOOO....',
      '..OORRRRRRRROO..',
      '.ORRYYYYYYYYRRO.',
      '.ORRYWWWWWWYRRO.',
      '.ORRYWOOOWOYRRO.',
      '.ORRYYWWWWYYRRO.',
      '..OORRRRRRRROO..',
      '....OOOOOOOO....',
      '.......OO.......',
      '..OOO..OO..OOO..',
      '.OGggO.OO.OggGO.',
      '.OGGGGOOOOGGGGO.',
      '..OGGGGGGGGGGO..',
      '...OOGGGGGGOO...',
      '.....OOOOOO.....',
      '................',
    ],
    fire_flower_2: [
      '....OOOOOOOO....',
      '..OOYYYYYYYYOO..',
      '.OYYRRRRRRRRYYO.',
      '.OYRRWWYYWWRRYO.',
      '.OYRRWOOOWORRYO.',
      '.OYYRWWWWWWYYYO.',
      '..OOYYYYYYYYOO..',
      '....OOOOOOOO....',
      '.......OO.......',
      '..OOO..OO..OOO..',
      '.OGggO.OO.OggGO.',
      '.OGGGGOOOOGGGGO.',
      '..OGGGGGGGGGGO..',
      '...OOGGGGGGOO...',
      '.....OOOOOO.....',
      '................',
    ],
    super_acorn: [
      '.......OO.......',
      '......OAAO......',
      '....OOAAAAOO....',
      '..OOAAAAAAAAOO..',
      '.OAAaAAAAAAaAAO.',
      '.OAAAAAAAAAAAAO.',
      '.OOOOOOOOOOOOOO.',
      '..OCCCCCCCCCCO..',
      '..OCWWCCCCWWCO..',
      '..OCWOCOOOCWCO..',
      '..OCCCCCCCCCCO..',
      '...OCCCCCCCCO...',
      '...OCCCCaCCCO...',
      '....OCCCCCCCO...',
      '.....OOCCOO.....',
      '.......OO.......',
    ],
    starman_1: [
      '.......OO.......',
      '......OYYO......',
      '......OYYO......',
      '.....OYYYYO.....',
      '.OOOOYYYYYYOOOO.',
      'OYYYYYYYYYYYYYYO',
      '.OYYYYOYYOYYYYO.',
      '..OYYYOYYOYYYO..',
      '...OYYYYYYYYO...',
      '...OYYYYYYYYO...',
      '..OYYYYYYYYYYO..',
      '..OYYYYOOYYYYO..',
      '.OYYYO....OYYYO.',
      '.OYYO......OYYO.',
      '..OO........OO..',
      '................',
    ],
    starman_2: [
      '.......OO.......',
      '......OyyO......',
      '......OyyO......',
      '.....OyyyyO.....',
      '.OOOOyyyyyyOOOO.',
      'OyyyyyyyyyyyyyyO',
      '.OyyyyOyyOyyyyO.',
      '..OyyyOyyOyyyO..',
      '...OyyyyyyyyO...',
      '...OyyyyyyyyO...',
      '..OyyyyyyyyyyO..',
      '..OyyyyOOyyyyO..',
      '.OyyyO....OyyyO.',
      '.OyyO......OyyO.',
      '..OO........OO..',
      '................',
    ],
    coin_1: [
      '.....OOOOOO.....',
      '...OOYYYYYYOO...',
      '..OYYyyyyYYDDO..',
      '..OYyYYYYYYDDO..',
      '.OYyYYDDDDYYDDO.',
      '.OYyYYDyyDYYDDO.',
      '.OYyYYDyyDYYDDO.',
      '.OYyYYDyyDYYDDO.',
      '.OYyYYDyyDYYDDO.',
      '.OYyYYDDDDYYDDO.',
      '..OYyYYYYYYDDO..',
      '..OYYDDDDDDDDO..',
      '...OOYYYYYYOO...',
      '.....OOOOOO.....',
      '................',
      '................',
    ],
    coin_2: [
      '......OOOO......',
      '.....OYYYYO.....',
      '....OYyYYDDO....',
      '....OYyYYDDO....',
      '....OYyDYDDO....',
      '....OYyDYDDO....',
      '....OYyDYDDO....',
      '....OYyDYDDO....',
      '....OYyYYDDO....',
      '....OYYDDDDO....',
      '.....OYYYYO.....',
      '......OOOO......',
      '................',
      '................',
      '................',
      '................',
    ],
    coin_3: [
      '.......OO.......',
      '......OYYO......',
      '......OYDO......',
      '......OYDO......',
      '......OYDO......',
      '......OYDO......',
      '......OYDO......',
      '......OYDO......',
      '......OYDO......',
      '......OYDO......',
      '......OYYO......',
      '.......OO.......',
      '................',
      '................',
      '................',
      '................',
    ],
    star_coin_1: [
      '....OOOOOOOO....',
      '..OOYYYYYYYYOO..',
      '.OYYyyyyYYYYDDO.',
      '.OYyYYYWWYYYYDO.',
      'OYyYYYYWWYYYYDDO',
      'OYyYYWWWWWWYYDDO',
      'OYyYYYWWWWYYYDDO',
      'OYyYYYWWWWYYYDDO',
      'OYyYYWWDDWWYYDDO',
      'OYyYYWDDDDWYYDDO',
      '.OYyYYYYYYYYDDO.',
      '.OYYDDDDDDDDDDO.',
      '..OOYYYYYYYYOO..',
      '....OOOOOOOO....',
      '................',
      '................',
    ],
    star_coin_2: [
      '.....OOOOOO.....',
      '....OYYYYYYO....',
      '...OYyYYYYDDO...',
      '...OYyYWWYYDO...',
      '...OYyWWWWYDO...',
      '...OYyWWWWYDO...',
      '...OYyWWWWYDO...',
      '...OYyWDDWYDO...',
      '...OYyYYYYDDO...',
      '...OYYDDDDDDO...',
      '....OYYYYYYO....',
      '.....OOOOOO.....',
      '................',
      '................',
      '................',
      '................',
    ],
  };

  function buildSprites() {
    const cache = {
      mario: {},
      enemies: {},
      items: {},
      tiles: {},
      scenery: {},
    };

    // Mario variants
    const forms = ['normal', 'fire', 'acorn', 'star0', 'star1', 'star2', 'star3'];
    for (const form of forms) {
      const pal = MARIO_PALETTES[form];
      cache.mario[form] = { small: {}, big: {} };
      for (const [pose, matrix] of Object.entries(SMALL_MARIO)) {
        cache.mario[form].small[pose] = {
          R: renderMatrix(matrix, pal, false),
          L: renderMatrix(matrix, pal, true),
        };
      }
      for (const [pose, matrix] of Object.entries(BIG_MARIO)) {
        cache.mario[form].big[pose] = {
          R: renderMatrix(matrix, pal, false),
          L: renderMatrix(matrix, pal, true),
        };
      }
    }

    // Enemies
    for (const [name, matrix] of Object.entries(ENEMY_MATRICES)) {
      cache.enemies[name] = {
        R: renderMatrix(matrix, ENEMY_PAL, false),
        L: renderMatrix(matrix, ENEMY_PAL, true),
      };
    }

    // Red Koopa variant by palette swap
    const RED_KOOPA_PAL = Object.assign({}, ENEMY_PAL, { K: '#d82820', k: '#ff7060' });
    for (const suffix of ['1', '2', 'shell', 'spin']) {
      const mat = ENEMY_MATRICES['koopa_g_' + suffix];
      cache.enemies['koopa_r_' + suffix] = {
        R: renderMatrix(mat, RED_KOOPA_PAL, false),
        L: renderMatrix(mat, RED_KOOPA_PAL, true),
      };
    }

    // Bowser
    for (const [pose, mat] of Object.entries(BOWSER_MATRICES)) {
      cache.enemies['bowser_' + pose] = {
        R: renderMatrix(mat, ENEMY_PAL, true), // matrix naturally faces left
        L: renderMatrix(mat, ENEMY_PAL, false),
      };
    }
    cache.enemies.thwomp_calm = renderMatrix(THWOMP_CALM, ENEMY_PAL, false);
    cache.enemies.thwomp_mad = renderMatrix(THWOMP_MAD, ENEMY_PAL, false);
    const NPC_PAL = Object.assign({}, ENEMY_PAL, { S: '#ffcca0', s: '#e09860' });
    cache.enemies.peach = {
      R: renderMatrix(PEACH_MATRIX, NPC_PAL, false),
      L: renderMatrix(PEACH_MATRIX, NPC_PAL, true),
    };
    cache.enemies.toad = renderMatrix(TOAD_MATRIX, NPC_PAL, false);

    // Items
    for (const [name, mat] of Object.entries(ITEM_MATRICES)) {
      cache.items[name] = renderMatrix(mat, ITEM_PAL, false);
    }

    // Build custom procedural crisp pixel-art tiles & props
    buildTiles(cache.tiles);
    buildScenery(cache.scenery);

    return cache;
  }

  function buildTiles(tiles) {
    const biomes = {
      meadow: { top1: '#42b830', top2: '#70e048', topDark: '#267818', dirt: '#b86830', dirt2: '#944a1c', dirtHi: '#d88c4c', brick: '#c85828', brickHi: '#ec8854', brickLo: '#6a240e' },
      cavern: { top1: '#2860a0', top2: '#50a0e8', topDark: '#163868', dirt: '#28385c', dirt2: '#1a2640', dirtHi: '#425a8c', brick: '#3a5488', brickHi: '#6488c8', brickLo: '#1e2c48' },
      sky: { top1: '#38c878', top2: '#88f8a8', topDark: '#1c8848', dirt: '#e8e0c8', dirt2: '#c4b898', dirtHi: '#ffffff', brick: '#e0a038', brickHi: '#ffd868', brickLo: '#8c5814' },
      castle: { top1: '#686c7c', top2: '#989cb0', topDark: '#383c48', dirt: '#404452', dirt2: '#282a34', dirtHi: '#5a5e70', brick: '#505462', brickHi: '#787c90', brickLo: '#22242c' },
    };

    for (const [bName, pal] of Object.entries(biomes)) {
      // Ground Top
      const gt = makeCanvas(16, 16);
      const gx = gt.getContext('2d');
      gx.fillStyle = pal.dirt;
      gx.fillRect(0, 0, 16, 16);
      // dirt speckles
      gx.fillStyle = pal.dirt2;
      [[2, 7, 3, 2], [9, 8, 2, 3], [5, 12, 4, 2], [12, 13, 3, 2]].forEach(([x, y, w, h]) => gx.fillRect(x, y, w, h));
      gx.fillStyle = pal.dirtHi;
      [[1, 10, 2, 1], [7, 7, 2, 1], [13, 10, 2, 1]].forEach(([x, y, w, h]) => gx.fillRect(x, y, w, h));
      // top turf
      gx.fillStyle = pal.topDark;
      gx.fillRect(0, 0, 16, 6);
      gx.fillStyle = pal.top1;
      gx.fillRect(0, 0, 16, 5);
      gx.fillStyle = pal.top2;
      gx.fillRect(0, 0, 16, 2);
      // hanging grass tufts
      gx.fillStyle = pal.top1;
      [1, 5, 10, 14].forEach((x) => gx.fillRect(x, 5, 2, 2));
      tiles[`ground_${bName}`] = gt;

      // Ground Deep
      const gd = makeCanvas(16, 16);
      const gdx = gd.getContext('2d');
      gdx.fillStyle = pal.dirt;
      gdx.fillRect(0, 0, 16, 16);
      gdx.fillStyle = pal.dirt2;
      [[1, 2, 4, 3], [9, 1, 3, 2], [4, 9, 5, 3], [12, 10, 3, 4]].forEach(([x, y, w, h]) => gdx.fillRect(x, y, w, h));
      gdx.fillStyle = pal.dirtHi;
      [[2, 2, 2, 1], [10, 6, 3, 1], [5, 9, 2, 1]].forEach(([x, y, w, h]) => gdx.fillRect(x, y, w, h));
      tiles[`deep_${bName}`] = gd;

      // Brick
      const br = makeCanvas(16, 16);
      const bx = br.getContext('2d');
      bx.fillStyle = pal.brickLo;
      bx.fillRect(0, 0, 16, 16);
      const drawBrick = (x, y, w, h) => {
        bx.fillStyle = pal.brick;
        bx.fillRect(x, y, w, h);
        bx.fillStyle = pal.brickHi;
        bx.fillRect(x, y, w, 1);
        bx.fillRect(x, y, 1, h);
      };
      drawBrick(0, 0, 7, 7);
      drawBrick(8, 0, 7, 7);
      drawBrick(0, 8, 3, 7);
      drawBrick(4, 8, 7, 7);
      drawBrick(12, 8, 4, 7);
      tiles[`brick_${bName}`] = br;
    }

    // Question Block (3 animation frames)
    for (let f = 0; f < 3; f++) {
      const c = makeCanvas(16, 16);
      const ctx = c.getContext('2d');
      const mainCols = ['#f8b818', '#ffd840', '#e09010'];
      ctx.fillStyle = '#402000';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = mainCols[f];
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#fff0a0';
      ctx.fillRect(1, 1, 13, 1);
      ctx.fillRect(1, 1, 1, 13);
      ctx.fillStyle = '#a05008';
      ctx.fillRect(2, 14, 13, 1);
      ctx.fillRect(14, 2, 1, 13);
      // bolts
      ctx.fillStyle = '#703000';
      [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      // ? glyph shadow
      ctx.fillStyle = '#703000';
      ctx.fillRect(6, 4, 5, 2);
      ctx.fillRect(9, 5, 2, 3);
      ctx.fillRect(7, 8, 3, 2);
      ctx.fillRect(7, 11, 2, 2);
      // ? glyph white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 3, 5, 2);
      ctx.fillRect(8, 4, 2, 3);
      ctx.fillRect(6, 7, 3, 2);
      ctx.fillRect(6, 10, 2, 2);
      tiles[`question_${f}`] = c;
    }

    // Used Block
    const used = makeCanvas(16, 16);
    const ux = used.getContext('2d');
    ux.fillStyle = '#241812';
    ux.fillRect(0, 0, 16, 16);
    ux.fillStyle = '#8c6848';
    ux.fillRect(1, 1, 14, 14);
    ux.fillStyle = '#b48c68';
    ux.fillRect(1, 1, 13, 1);
    ux.fillRect(1, 1, 1, 13);
    ux.fillStyle = '#4c3424';
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => ux.fillRect(x, y, 1, 1));
    tiles.used = used;

    // Hard Steel Block
    const hard = makeCanvas(16, 16);
    const hx = hard.getContext('2d');
    hx.fillStyle = '#1c2028';
    hx.fillRect(0, 0, 16, 16);
    hx.fillStyle = '#9aa4b8';
    hx.fillRect(1, 1, 14, 14);
    hx.fillStyle = '#d8e0f0';
    hx.fillRect(1, 1, 13, 2);
    hx.fillRect(1, 1, 2, 13);
    hx.fillStyle = '#50586c';
    hx.fillRect(2, 13, 13, 2);
    hx.fillRect(13, 2, 2, 13);
    hx.fillStyle = '#6c748a';
    hx.fillRect(4, 4, 8, 8);
    tiles.hard = hard;

    // Pipes (green & gold)
    for (const [pName, cDark, cMid, cHi, cRim] of [
      ['green', '#105810', '#28a828', '#80f868', '#083808'],
      ['gold', '#885808', '#e8a818', '#fff080', '#503000'],
    ]) {
      const makePipeHalf = (isTop, isRight) => {
        const c = makeCanvas(16, 16);
        const cx = c.getContext('2d');
        cx.fillStyle = cRim;
        cx.fillRect(0, 0, 16, 16);
        if (isTop) {
          cx.fillStyle = cMid;
          cx.fillRect(isRight ? 0 : 1, 1, 15, 13);
          cx.fillStyle = cHi;
          cx.fillRect(isRight ? 0 : 2, 1, isRight ? 3 : 6, 13);
          cx.fillStyle = cDark;
          cx.fillRect(isRight ? 10 : 13, 1, isRight ? 5 : 3, 13);
          cx.fillStyle = cRim;
          cx.fillRect(0, 14, 16, 2);
        } else {
          const sx = isRight ? 0 : 2;
          const sw = 14;
          cx.clearRect(0, 0, 16, 16);
          cx.fillStyle = cRim;
          cx.fillRect(sx, 0, sw, 16);
          cx.fillStyle = cMid;
          cx.fillRect(isRight ? 0 : 3, 0, 12, 16);
          cx.fillStyle = cHi;
          cx.fillRect(isRight ? 0 : 4, 0, isRight ? 2 : 5, 16);
          cx.fillStyle = cDark;
          cx.fillRect(isRight ? 9 : 13, 0, isRight ? 4 : 2, 16);
        }
        return c;
      };
      tiles[`pipe_${pName}_tl`] = makePipeHalf(true, false);
      tiles[`pipe_${pName}_tr`] = makePipeHalf(true, true);
      tiles[`pipe_${pName}_bl`] = makePipeHalf(false, false);
      tiles[`pipe_${pName}_br`] = makePipeHalf(false, true);
    }

    // One-way platform & Bridge
    const ow = makeCanvas(16, 16);
    const owx = ow.getContext('2d');
    owx.fillStyle = '#5c2c0e';
    owx.fillRect(0, 0, 16, 6);
    owx.fillStyle = '#c87c38';
    owx.fillRect(0, 1, 16, 4);
    owx.fillStyle = '#f0b868';
    owx.fillRect(0, 1, 16, 1);
    owx.fillStyle = '#5c2c0e';
    owx.fillRect(7, 1, 1, 4);
    owx.fillRect(15, 1, 1, 4);
    tiles.oneway = ow;

    const brg = makeCanvas(16, 16);
    const brgx = brg.getContext('2d');
    brgx.fillStyle = '#3c1e0c';
    brgx.fillRect(0, 0, 16, 16);
    brgx.fillStyle = '#a05a28';
    brgx.fillRect(1, 1, 14, 10);
    brgx.fillStyle = '#d48a48';
    brgx.fillRect(1, 1, 14, 2);
    brgx.fillStyle = '#7c4018';
    brgx.fillRect(0, 11, 16, 5);
    tiles.bridge = brg;

    // Bounce Mushroom Cap
    const bc = makeCanvas(16, 16);
    const bcx = bc.getContext('2d');
    bcx.fillStyle = '#901018';
    bcx.fillRect(0, 1, 16, 12);
    bcx.fillStyle = '#ff3848';
    bcx.fillRect(1, 1, 14, 10);
    bcx.fillStyle = '#ffffff';
    bcx.fillRect(2, 3, 4, 4);
    bcx.fillRect(10, 2, 4, 4);
    bcx.fillStyle = '#ffe0b0';
    bcx.fillRect(5, 12, 6, 4);
    tiles.bounce_cap = bc;

    // Donut falling block
    const dn = makeCanvas(16, 16);
    const dnx = dn.getContext('2d');
    dnx.fillStyle = '#6a3814';
    dnx.fillRect(0, 0, 16, 16);
    dnx.fillStyle = '#f8c860';
    dnx.fillRect(1, 1, 14, 14);
    dnx.fillStyle = '#d88038';
    dnx.fillRect(1, 9, 14, 6);
    dnx.fillStyle = '#6a3814';
    dnx.fillRect(6, 5, 4, 4);
    tiles.donut = dn;

    // Ice tile
    const ice = makeCanvas(16, 16);
    const ix = ice.getContext('2d');
    ix.fillStyle = '#3890d8';
    ix.fillRect(0, 0, 16, 16);
    ix.fillStyle = '#88dcff';
    ix.fillRect(0, 0, 16, 5);
    ix.fillStyle = '#ffffff';
    ix.fillRect(2, 1, 5, 1);
    ix.fillRect(10, 2, 4, 1);
    ix.fillRect(4, 9, 3, 2);
    tiles.ice = ice;

    // On/Off Switch & Red/Blue Blocks
    for (const [key, bg, fg, label] of [
      ['onoff_red', '#e83030', '#ffffff', 'ON'],
      ['onoff_blue', '#2870e8', '#ffffff', 'OF'],
    ]) {
      const c = makeCanvas(16, 16);
      const cx = c.getContext('2d');
      cx.fillStyle = '#181820';
      cx.fillRect(0, 0, 16, 16);
      cx.fillStyle = bg;
      cx.fillRect(1, 1, 14, 14);
      cx.fillStyle = fg;
      cx.fillRect(3, 5, 4, 6);
      cx.fillRect(4, 6, 2, 4);
      cx.fillStyle = bg;
      cx.fillRect(4, 6, 2, 4);
      cx.fillStyle = fg;
      cx.fillRect(9, 5, 1, 6);
      cx.fillRect(12, 5, 1, 6);
      cx.fillRect(10, 6, 2, 2);
      if (label === 'OF') {
        cx.fillStyle = '#a0d8ff';
        cx.fillRect(10, 5, 3, 1);
        cx.fillRect(10, 8, 2, 1);
      }
      tiles[key] = c;
    }

    for (const [name, col, hi] of [
      ['red_solid', '#e83030', '#ff9898'],
      ['blue_solid', '#2878f0', '#90c8ff'],
    ]) {
      const c = makeCanvas(16, 16);
      const cx = c.getContext('2d');
      cx.fillStyle = '#181820';
      cx.fillRect(0, 0, 16, 16);
      cx.fillStyle = col;
      cx.fillRect(1, 1, 14, 14);
      cx.fillStyle = hi;
      cx.fillRect(2, 2, 12, 2);
      cx.fillRect(2, 2, 2, 12);
      cx.fillStyle = '#ffffff';
      cx.fillRect(5, 5, 6, 6);
      cx.fillStyle = col;
      cx.fillRect(6, 6, 4, 4);
      tiles[name] = c;
    }

    for (const [name, col] of [
      ['red_ghost', '#e83030'],
      ['blue_ghost', '#2878f0'],
    ]) {
      const c = makeCanvas(16, 16);
      const cx = c.getContext('2d');
      cx.fillStyle = col;
      for (let i = 0; i < 16; i += 3) {
        cx.fillRect(i, 0, 2, 1);
        cx.fillRect(i, 15, 2, 1);
        cx.fillRect(0, i, 1, 2);
        cx.fillRect(15, i, 1, 2);
      }
      tiles[name] = c;
    }

    // POW Block
    const pow = makeCanvas(16, 16);
    const px = pow.getContext('2d');
    px.fillStyle = '#102048';
    px.fillRect(0, 0, 16, 16);
    px.fillStyle = '#2870e8';
    px.fillRect(1, 1, 14, 14);
    px.fillStyle = '#70b8ff';
    px.fillRect(1, 1, 13, 1);
    px.fillStyle = '#ffffff';
    px.fillRect(2, 5, 3, 6);
    px.fillRect(3, 6, 2, 2);
    px.fillRect(6, 5, 3, 6);
    px.fillRect(10, 5, 4, 6);
    px.fillStyle = '#2870e8';
    px.fillRect(7, 6, 1, 4);
    px.fillRect(11, 5, 1, 4);
    px.fillRect(12, 5, 1, 4);
    tiles.pow = pow;

    // Lava
    for (let f = 0; f < 2; f++) {
      const lv = makeCanvas(16, 16);
      const lx = lv.getContext('2d');
      lx.fillStyle = '#d82800';
      lx.fillRect(0, 3, 16, 13);
      lx.fillStyle = '#ff7810';
      lx.fillRect(0, 3, 16, 4);
      lx.fillStyle = '#ffe040';
      const off = f * 4;
      lx.fillRect((1 + off) % 14, 2, 4, 2);
      lx.fillRect((9 + off) % 14, 3, 4, 2);
      tiles[`lava_top_${f}`] = lv;
    }
    const lb = makeCanvas(16, 16);
    const lbx = lb.getContext('2d');
    lbx.fillStyle = '#c81c00';
    lbx.fillRect(0, 0, 16, 16);
    lbx.fillStyle = '#f85800';
    lbx.fillRect(2, 4, 5, 2);
    lbx.fillRect(10, 11, 4, 2);
    tiles.lava_body = lb;

    // Spikes
    const sp = makeCanvas(16, 16);
    const spx = sp.getContext('2d');
    for (const sx of [1, 6, 11]) {
      spx.fillStyle = '#505868';
      spx.fillRect(sx, 10, 4, 6);
      spx.fillStyle = '#c8d4e8';
      spx.fillRect(sx + 1, 5, 2, 11);
      spx.fillStyle = '#ffffff';
      spx.fillRect(sx + 1, 2, 1, 6);
    }
    tiles.spike = sp;

    // Bill Blaster
    const blt = makeCanvas(16, 16);
    const bltx = blt.getContext('2d');
    bltx.fillStyle = '#181820';
    bltx.fillRect(0, 0, 16, 16);
    bltx.fillStyle = '#384050';
    bltx.fillRect(1, 1, 14, 14);
    bltx.fillStyle = '#6c7890';
    bltx.fillRect(2, 2, 12, 2);
    bltx.fillStyle = '#101218';
    bltx.fillRect(0, 4, 3, 8);
    bltx.fillRect(13, 4, 3, 8);
    bltx.fillStyle = '#ffffff';
    bltx.fillRect(5, 5, 6, 5);
    bltx.fillStyle = '#181820';
    bltx.fillRect(6, 7, 1, 1);
    bltx.fillRect(9, 7, 1, 1);
    tiles.blaster = blt;

    // Springboard
    for (let s = 0; s < 2; s++) {
      const c = makeCanvas(16, 16);
      const cx = c.getContext('2d');
      const topY = s === 0 ? 2 : 8;
      cx.fillStyle = '#901818';
      cx.fillRect(1, topY, 14, 4);
      cx.fillStyle = '#ff4848';
      cx.fillRect(2, topY, 12, 2);
      cx.fillStyle = '#d0d8e8';
      for (let y = topY + 4; y < 14; y += 2) {
        cx.fillRect(4 + ((y % 4) ? 2 : 0), y, 6, 1);
      }
      cx.fillStyle = '#404858';
      cx.fillRect(2, 14, 12, 2);
      tiles[`spring_${s}`] = c;
    }

    // P-Switch
    for (let s = 0; s < 2; s++) {
      const c = makeCanvas(16, 16);
      const cx = c.getContext('2d');
      const topY = s === 0 ? 3 : 10;
      cx.fillStyle = '#103888';
      cx.fillRect(2, topY, 12, 13 - topY);
      cx.fillStyle = '#3890ff';
      cx.fillRect(3, topY, 10, 3);
      if (s === 0) {
        cx.fillStyle = '#ffffff';
        cx.fillRect(6, topY + 4, 4, 4);
      }
      cx.fillStyle = '#505868';
      cx.fillRect(1, 13, 14, 3);
      tiles[`pswitch_${s}`] = c;
    }

    // Axe
    for (let f = 0; f < 2; f++) {
      const c = makeCanvas(16, 16);
      const cx = c.getContext('2d');
      cx.fillStyle = '#884818';
      cx.fillRect(7, 4, 2, 12);
      cx.fillStyle = f === 0 ? '#e0e8f8' : '#ffd840';
      cx.fillRect(2, 1, 6, 7);
      cx.fillRect(8, 2, 5, 5);
      cx.fillStyle = '#ffffff';
      cx.fillRect(2, 2, 2, 5);
      tiles[`axe_${f}`] = c;
    }

    // Vine
    const vine = makeCanvas(16, 16);
    const vx = vine.getContext('2d');
    vx.fillStyle = '#1c8c28';
    vx.fillRect(7, 0, 2, 16);
    vx.fillStyle = '#50d848';
    vx.fillRect(4, 2, 3, 4);
    vx.fillRect(9, 9, 3, 4);
    tiles.vine = vine;
  }

  function buildScenery(scenery) {
    // Pixel Oak Tree (48x64) - rich leafy crown + acorns!
    const oak = makeCanvas(48, 64);
    const ox = oak.getContext('2d');
    // Trunk
    ox.fillStyle = '#5c3012';
    ox.fillRect(19, 36, 10, 28);
    ox.fillStyle = '#84481e';
    ox.fillRect(21, 36, 4, 28);
    ox.fillStyle = '#402008';
    ox.fillRect(27, 36, 2, 28);
    // Crown shadow
    ox.fillStyle = '#185c1c';
    ox.fillRect(6, 16, 36, 22);
    ox.fillRect(12, 8, 24, 10);
    // Mid leaves
    ox.fillStyle = '#2c9430';
    ox.fillRect(8, 14, 32, 20);
    ox.fillRect(14, 6, 20, 10);
    // Highlight clusters
    ox.fillStyle = '#58c848';
    [[12, 10, 10, 6], [24, 14, 12, 6], [10, 20, 10, 6], [26, 24, 10, 5]].forEach(([x, y, w, h]) => ox.fillRect(x, y, w, h));
    // Cute hanging golden acorns
    ox.fillStyle = '#d8882c';
    [[14, 28], [32, 26], [22, 18]].forEach(([x, y]) => {
      ox.fillStyle = '#703810';
      ox.fillRect(x, y, 3, 2);
      ox.fillStyle = '#f0a848';
      ox.fillRect(x, y + 2, 3, 3);
    });
    scenery.oak_tree = oak;

    // Pixel Bush (32x16)
    const bush = makeCanvas(32, 16);
    const bx = bush.getContext('2d');
    bx.fillStyle = '#248828';
    bx.fillRect(2, 8, 28, 8);
    bx.fillRect(6, 4, 20, 6);
    bx.fillRect(11, 2, 10, 4);
    bx.fillStyle = '#58d048';
    bx.fillRect(7, 5, 8, 4);
    bx.fillRect(16, 7, 8, 4);
    scenery.bush = bush;

    // Pixel Cloud (48x24)
    const cloud = makeCanvas(48, 24);
    const cx = cloud.getContext('2d');
    cx.fillStyle = '#b8dcff';
    cx.fillRect(4, 14, 40, 8);
    cx.fillStyle = '#ffffff';
    cx.fillRect(4, 10, 40, 9);
    cx.fillRect(10, 4, 26, 8);
    cx.fillRect(16, 2, 14, 4);
    scenery.cloud = cloud;

    // End Castle (80x80)
    const cas = makeCanvas(80, 80);
    const cs = cas.getContext('2d');
    cs.fillStyle = '#8c4424';
    cs.fillRect(8, 32, 64, 48);
    cs.fillRect(20, 8, 40, 26);
    // Brick lines
    cs.fillStyle = '#5a2812';
    for (let y = 12; y < 80; y += 8) cs.fillRect(y < 32 ? 20 : 8, y, y < 32 ? 40 : 64, 1);
    // Battlements
    cs.fillStyle = '#b05c34';
    for (let x = 8; x < 72; x += 12) cs.fillRect(x, 26, 7, 7);
    for (let x = 20; x < 60; x += 10) cs.fillRect(x, 2, 6, 7);
    // Door
    cs.fillStyle = '#181014';
    cs.fillRect(32, 54, 16, 26);
    cs.fillRect(34, 48, 12, 8);
    // Windows
    cs.fillRect(26, 18, 6, 8);
    cs.fillRect(48, 18, 6, 8);
    scenery.castle = cas;
  }

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.buildSprites = buildSprites;
  global.MarioGame._SPRITE_TEST_DATA = {
    MARIO_PALETTES,
    SMALL_MARIO,
    BIG_MARIO,
    ENEMY_PAL,
    ENEMY_MATRICES,
    BOWSER_MATRICES,
    THWOMP_CALM,
    THWOMP_MAD,
    PEACH_MATRIX,
    TOAD_MATRIX,
    ITEM_PAL,
    ITEM_MATRICES,
  };
})(window);

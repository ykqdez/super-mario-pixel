(function (global) {
  'use strict';

  const VIRTUAL_WIDTH = 480;
  const VIRTUAL_HEIGHT = 272;
  const TILE_SIZE = 16;
  const VIEW_COLS = VIRTUAL_WIDTH / TILE_SIZE; // 30
  const VIEW_ROWS = VIRTUAL_HEIGHT / TILE_SIZE; // 17
  const FIXED_DT = 1 / 60;

  const POWER = {
    SMALL: 'small',
    SUPER: 'super',
    FIRE: 'fire',
    ACORN: 'acorn',
  };

  const TILE = {
    EMPTY: 0,
    GROUND: 1,
    GROUND_DEEP: 2,
    BRICK: 3,
    QUESTION: 4,
    USED: 5,
    HARD: 6,
    HIDDEN: 7,
    PIPE_TL: 8,
    PIPE_TR: 9,
    PIPE_BL: 10,
    PIPE_BR: 11,
    COIN: 12,
    ONEWAY: 13,
    BOUNCE_CAP: 14,
    ICE: 15,
    LAVA_TOP: 16,
    LAVA_BODY: 17,
    BRIDGE: 18,
    ON_OFF_SWITCH: 19,
    RED_BLOCK: 20,
    BLUE_BLOCK: 21,
    CRUMBLED: 22,
    CASTLE_WALL: 23,
    VINE: 24,
    SPIKE: 25,
    POW_BLOCK: 26,
    DONUT: 27,
  };

  const SOLID_TILES = new Set([
    TILE.GROUND,
    TILE.GROUND_DEEP,
    TILE.BRICK,
    TILE.QUESTION,
    TILE.USED,
    TILE.HARD,
    TILE.PIPE_TL,
    TILE.PIPE_TR,
    TILE.PIPE_BL,
    TILE.PIPE_BR,
    TILE.BOUNCE_CAP,
    TILE.ICE,
    TILE.BRIDGE,
    TILE.ON_OFF_SWITCH,
    TILE.POW_BLOCK,
    TILE.DONUT,
  ]);

  const PHYSICS = {
    GRAVITY_HOLD: 690,
    GRAVITY_FALL: 1220,
    GRAVITY_CUT: 1680,
    MAX_FALL: 365,
    ACORN_GLIDE_FALL: 64,
    WALL_SLIDE_MAX: 74,
    GROUND_POUND_VY: 395,

    WALK_SPEED: 115,
    RUN_SPEED: 185,
    STAR_MULT: 1.22,
    ACCEL_GROUND: 720,
    ACCEL_RUN: 860,
    ACCEL_AIR: 580,
    FRICTION_GROUND: 820,
    FRICTION_ICE: 145,
    FRICTION_AIR: 110,
    SKID_DECEL: 1480,

    JUMP_VY: -288,
    RUN_JUMP_VY: -314,
    BOUNCE_CAP_VY: -410,
    SPRING_LOW_VY: -310,
    SPRING_HIGH_VY: -435,
    STOMP_LOW_VY: -225,
    STOMP_HIGH_VY: -330,
    WALL_JUMP_VX: 160,
    WALL_JUMP_VY: -280,
    ACORN_BOOST_VY: -225,

    COYOTE_TIME: 0.1,
    JUMP_BUFFER: 0.12,
    WALL_COYOTE_TIME: 0.11,
    INVULN_TIME: 2.0,
    STAR_TIME: 10.0,
    PSWITCH_TIME: 9.0,
  };

  const GAME_STATE = {
    TITLE: 'TITLE',
    OVERWORLD: 'OVERWORLD',
    TOAD_HOUSE: 'TOAD_HOUSE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    STAGE_CLEAR: 'STAGE_CLEAR',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY',
  };

  const BIOME = {
    MEADOW: 'meadow',
    CAVERN: 'cavern',
    SKY: 'sky',
    CASTLE: 'castle',
  };

  const STORAGE_KEY = 'super_mario_pixel_save_v1';

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.CONSTANTS = {
    VIRTUAL_WIDTH,
    VIRTUAL_HEIGHT,
    TILE_SIZE,
    VIEW_COLS,
    VIEW_ROWS,
    FIXED_DT,
    POWER,
    TILE,
    SOLID_TILES,
    PHYSICS,
    GAME_STATE,
    BIOME,
    STORAGE_KEY,
  };
})(window);

// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start, restart, pause, bomb, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
// Pointer drag also steers: the ship chases the pointer's x/y while held.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BOMB = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BOMB = new Set(['KeyB']);
const MUTE = new Set(['KeyM']);
const FIRE = new Set(['Space', 'KeyJ', 'KeyZ']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let firing = false;
  let actions = 0;
  let pointer = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (FIRE.has(event.code)) {
      firing = true;
      // Space is both fire and confirm: the same press that starts the game
      // also starts shooting, instead of the fire branch swallowing it.
      if (CONFIRM.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (BOMB.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BOMB;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (FIRE.has(event.code)) firing = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    left = false; right = false; up = false; down = false; firing = false; pointer = null;
  });

  target.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    if (pointer !== null) pointer = { x: event.clientX, y: event.clientY };
  });
  target.addEventListener('pointerup', () => { pointer = null; });

  return {
    /** Steering from keys: {x: -1|0|1, y: -1|0|1}. */
    direction() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** Pointer target in client pixels, or null when not dragging. */
    pointerTarget() { return pointer; },
    isFiring() { return firing || pointer !== null; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

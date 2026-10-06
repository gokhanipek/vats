// Seeded RNG (mulberry32). Every random choice in the vat game goes through an
// rng created here, so a duel or run can be replayed from its seed.

/**
 * Create a seeded RNG. Calling it returns a float in [0, 1).
 * @param {number} seed
 * @returns {function(): number}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh 32-bit seed drawn from an rng.
 * @param {function(): number} rng
 * @returns {number}
 */
export function nextSeed(rng) {
  return Math.floor(rng() * 4294967296);
}

/**
 * Random integer in [0, n).
 * @param {function(): number} rng
 * @param {number} n
 */
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

/**
 * Random element of a non-empty array.
 * @param {function(): number} rng
 * @param {Array} array
 */
export function pick(rng, array) {
  return array[randInt(rng, array.length)];
}

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate the input.
 * @param {function(): number} rng
 * @param {Array} array
 */
export function shuffleWith(rng, array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

// Hints: flipping a card briefly marks an area that contains its pair.
// The area is placed randomly so the pair is not always at its centre.
import { HINTS } from './tuning';
import { isMatch } from './fragments';
import { randInt, pick } from './rng';

/**
 * Positions of unclaimed cards that would match the card at `pos`.
 * Face-down candidates are preferred over face-up ones.
 * @param {Array} cards
 * @param {number} pos
 */
export function partnerPositions(cards, pos) {
  const card = cards[pos];
  const all = [];
  cards.forEach((c, i) => {
    if (c.claimedBy === null && isMatch(card, c, pos, i)) all.push(i);
  });
  const faceDown = all.filter((i) => !cards[i].faceUp);
  return faceDown.length > 0 ? faceDown : all;
}

// A square area of side `size` that contains (px, py) and fits the grid.
function squareAround(px, py, size, cols, rows, rng) {
  const w = Math.min(size, cols);
  const h = Math.min(size, rows);
  const minX = Math.max(0, px - w + 1);
  const maxX = Math.min(px, cols - w);
  const minY = Math.max(0, py - h + 1);
  const maxY = Math.min(py, rows - h);
  const x0 = minX + randInt(rng, maxX - minX + 1);
  const y0 = minY + randInt(rng, maxY - minY + 1);
  const area = [];
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      area.push(y * cols + x);
    }
  }
  return area;
}

/**
 * The hint for flipping the card at `pos`, or null if it has no unclaimed pair.
 * @param {{cols:number, rows:number, cards:Array}} board
 * @param {number} pos
 * @param {function(): number} rng
 * @returns {null | {source:number, positions:number[], type:string, tier:number, ms:number}}
 */
export function hintFor(board, pos, rng) {
  const { cols, rows, cards } = board;
  const partners = partnerPositions(cards, pos);
  if (partners.length === 0) return null;
  const target = pick(rng, partners);
  const card = cards[pos];
  const spec = HINTS[card.tier];
  const px = target % cols;
  const py = Math.floor(target / cols);
  let positions;
  if (spec.size) {
    positions = squareAround(px, py, spec.size, cols, rows, rng);
  } else {
    const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [px + dx, py + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows)
      .map(([x, y]) => y * cols + x);
    positions = neighbours.length > 0 ? [target, pick(rng, neighbours)] : [target];
  }
  // A short last row can leave area cells past the end of the cards.
  positions = positions.filter((i) => i < cards.length);
  return { source: pos, positions, type: card.type, tier: card.tier, ms: spec.ms };
}

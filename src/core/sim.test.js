import { simulateDuel, simulateMany } from './sim';

const PERFECT = { player: 99, opponent: 99 };

describe('duel simulation', () => {
  it('every simulated duel finishes, with and without bonus cards', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      [1, 2, 3, 4].forEach((boardTier) => {
        [false, true].forEach((bonus) => {
          const r = simulateDuel({
            seed, boardTier, bonus, memory: PERFECT, policies: { player: 'planner', opponent: 'greedy' },
          });
          expect(['player', 'opponent', 'draw']).toContain(r.outcome);
        });
      });
    }
  });

  it('is deterministic for a seed', () => {
    const options = { seed: 7, boardTier: 2, bonus: true, memory: PERFECT, policies: { player: 'planner', opponent: 'planner' } };
    expect(simulateDuel(options)).toEqual(simulateDuel(options));
  });

  // Prints the strategy report. Run with: $env:VAT_SIM_REPORT="1"; npx vitest run src/core/sim
  it('reports whether planning beats greed with perfect memory', () => {
    if (!process.env.VAT_SIM_REPORT) return;
    const n = Number(process.env.VAT_SIM_N) || 400;
    const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
    const rows = [];
    [
      ['planner vs greedy', { player: 'planner', opponent: 'greedy' }],
      ['greedy vs greedy ', { player: 'greedy', opponent: 'greedy' }],
      ['planner vs planner', { player: 'planner', opponent: 'planner' }],
    ].forEach(([label, policies]) => {
      [false, true].forEach((bonus) => {
        [1, 2, 3, 4].forEach((boardTier) => {
          const r = simulateMany(n, { boardTier, bonus, memory: PERFECT, policies });
          rows.push(`${label} | bonus ${bonus ? 'yes' : 'no '} | tier ${boardTier} | win ${pct(r.wins)} draw ${pct(r.draws)}`
            + ` | starter wins ${pct(r.starterWins)} | margin ${r.avgMargin.toFixed(1).padStart(5)}`
            + ` | holds ${r.holdsPerDuel.toFixed(1)} reorders ${r.reordersPerDuel.toFixed(1)}`);
        });
      });
    });
    // eslint-disable-next-line no-console
    console.log(rows.join('\n'));
  });
});

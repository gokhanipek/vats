# Vats MVP

> Built 2026-10-04 to find out whether [GAME-DESIGN.md](GAME-DESIGN.md) is fun before building the full plan.
> Play it with `npm run dev` and open the URL Vite prints.
> It started inside the `pokemon-safari-zone` repo at `/vat` and moved to its own repo (`vats`) on 2026-10-06.
> OpenSpec: changes `2026-10-04-vat-mvp`, `2026-10-05-vat-owner-hints-loadout`, `2026-10-05-vat-world-map` and `2026-10-05-vat-strategy-layer` (archived), specs `vat-duel` and `vat-run`.

## The two questions
1. **Is the duel fun?**
2. **Is the life loop fun?**

## What's in

### Duel
- **Table:** one shared table of 4 fragment types (water, fire, air, electric) at tiers 1–3, with a symbol and pips on every card. Same type and tier match whoever brought them.
- **Scoring:** doubled so there are no halves: your own card scores 2× tier, theirs 1× tier.
- **Resonance:** your last claimed type. The next type in the cycle 💧 → 🔥 → 🌀 → ⚡ → 💧 scores +2 per tier, the one before it −2 per tier.
- **Hold:** after a match you may end your turn instead of flipping again.
- **Hints:** only when you flip **your own** card as the **first** flip of a turn, and only you see them. Tiered and placed randomly (tier 1: 3x3 area, tier 2: 2x2 area, tier 3: the pair plus a neighbour). Each type has its own effect (wet, heat, sway, spark). The move log notes when the opponent got a clue.
- **Board:** 4x3 at Lucidity 1–2, 4x4 at 3–4, 5x4 at 5–6, and 6x4 for the Wake Attempt. Every board splits evenly between the sides.
- **Hand:** five bonus cards, each with its own cooldown and recharge rule. Ping (Electric pairs) privately peeks at 2 cards. Echo (2 turns) shakes your own face-down cards, only for you; the AI holds it but doesn't play it yet. Defrag (4 turns) reshuffles every unclaimed card. Double Down (Fire pairs) doubles matches this turn, but a miss costs 4 points. Lock (own pairs) stops anyone flipping a card until your next turn.
- **Affinity:** two types from your spawn vat. Claiming them recharges every card.
- **AI:** limited memory that grows with level. It completes pairs it remembers, searches its own hint area and plays bonus cards.

### Life loop
- **Spawn:** each life starts by keeping 3 fragments and 1 bonus card from a random Sleeper, all at tier 1.
- **Loadout:** if you own more fragments than the board needs, you choose which ones to bring. Your last choice is pre-selected.
- **The map:** 40 colonists on a grid of Lucidity rows by distance columns (1–3 days away). You can duel within 1 Lucidity of yours. Near ones show level and main type; far ones show their whole deck.
- **A living world:** every day the colonists duel each other too. Winners climb and grow their decks, 20% of losers die and start over at Lucidity 1, and a few at Lucidity 6 wake and leave for good. Nobody new arrives.
- **Anchors:** rare cards that take no slot and give +5% or +10% to survive a lost duel (max 30%).
- **Points and shop:** your duel scores add up to a points total (lost on death). The shop on the map sells bonus cards you don't own. Cards beyond your hand slots wait in storage.
- **After a win:** take one of their cards (or their anchor). Beating an equal or stronger opponent gives +1 Lucidity, which grows the board every 2 levels.
- **Merging:** 2 equal fragments become 1 of the next tier. Each fragment puts one pair on the table, so merging trades how many pairs you bring for stronger cards.
- **Death:** a loss kills the body (unless an anchor holds) and costs an extra day. You respawn at Lucidity 1 with nothing.
- **Waking:** at Lucidity 6 you can try the Wake Attempt, 3 duels in a row on 6x4 against Wardens, with one loadout. If day 30 passes first, the game ends without a wake.

## What's out (until the core proves fun)
Past selves, unlocks across games, buying fragments, reactions, tier 4, Shapeless and Virus, and saving across page reloads (a refresh resets the run).

## Balance

> The table below was measured **before** the 2026-10-05 changes (smaller boards, private owner-only hints). Hints now help the player less, since you no longer see the AI's clues, so expect lower win rates until it is re-measured.
Every number is in [`src/core/tuning.js`](../src/core/tuning.js).

An AI-vs-AI simulation (400 duels per row) found no stalls; every duel finishes. The first AI memory values were too punishing, so they were lowered one step. Against a simulated player who remembers about 5 cards:

| Lucidity | 1 | 2 | 3 | 4 | 5 | 6 | One wake duel | All 3 wake duels |
|---|---|---|---|---|---|---|---|---|
| Win rate | 89% | 84% | 70% | 70% | 61% | 49% | 47% | ~10% |

## What to watch in playtests
1. **Hint length:** tier-1 hints last 0.5s, which may be too short to read.
2. **Death:** going back to Lucidity 1 with nothing may feel too harsh.
3. **Merging:** whether trading pairs for stronger cards is an interesting choice.
4. **Ownership scoring:** whether players notice and care whose cards they're claiming.

## Playtest log

### 2026-10-04: first impression
- Played a couple of runs. **Lost every time and never woke up.**
- **The game feels frustrating, but makes you want to win so badly.**
- Overall: **feels good.** The core hook seems to work.

**Changes made after this session:**
- The move log moved to a left side panel with two tabs. **Game** lists every move with the cards flipped. **History** lists previous lives with peak Lucidity, wins, W/L/D per duel and the day each life died.
- **Defrag** is now hard to miss. It shows a highlighted log entry, a banner over the board and a board shake. (Feedback: "you remember a card's place, pick it, and it's gone because the opponent shuffled.")

- Added a **"Reveal cards (testing)"** toggle under the board. Face-down cards show faintly to the player only, and the AI is unaffected. It's for reaching later content (Lucidity 6, the Wake Attempt) without having won yet. Runs played with it on don't count as balance data.

**Takeaway:** the "one more try" pull is there. The open question is whether the frustration is the good kind (I almost had it) or the bad kind (I never stood a chance). Next playtests should track how far each life gets (highest Lucidity, which day it died) to tell the two apart.

### 2026-10-05: hints, loadout and board sizes
Design review after the first playtest. Changes:
- **Hints are owner-only, first-flip-only and private.** Before, a weaker opponent could flip your high-tier card and be pointed to its pair. Now your best cards only help you.
- **New bonus card: Echo.** Shakes your own face-down cards so you can choose one of yours for the first flip on purpose.
- **Loadout step** before a duel when you own more fragments than needed.
- **Smaller boards:** 4x3 → 4x4 → 5x4, with a 6x4 Wake Attempt.

**Watch next:** whether losing the AI's clues makes the duel feel blind, whether Echo is worth its charge, and the new win rates at Lucidity 5–6 and in the Wake Attempt.

### 2026-10-05: the map, a living world and a new story
Changes:
- **New story:** a fixed group of colonists sent from a ruined Earth to another planet, sleeping in vats until they remember enough to wake and build the colony. See GAME-DESIGN.md section 1.
- **The map** replaces the 3 daily signals. Distance costs days, and far signals show their deck.
- **40 colonists live their own lives:** they duel each other daily, climb, die and start over, and sometimes wake. The numbers came from a population simulation (GAME-DESIGN.md section 7.4).
- **Anchors**, a rare no-slot card that can save you from a lost duel.

**Watch next:** whether the map makes choosing an opponent interesting (near and blind vs far and known), whether you start to recognise rivals, and whether anchors feel exciting or just make death rarer.

### 2026-10-05: strategy layer, and the perfect-memory test
Prompted by an outside review: *"memory should give information, but perfect memory should not solve the game."* Changes:
- **Resonance, hold, per-card cooldowns with recharge rules, affinity, Lock,** a **points total** with a **shop**, and **storage** for bonus cards.
- **A simulation of the perfect-memory test** (GAME-DESIGN.md section 3.8). Two AIs that remember everything play full duels.

**What the simulation says:** the new systems add texture, but **planning doesn't beat greedy play yet** (40–47%). Known pairs almost never pile up, so the "which order?" choice rarely comes up, and holding is usually a mistake. Going first only wins 50–60%. The next experiment candidates are in section 3.8.

**Watch next in playtests:** do you ever hold, or delay a known pair? Do you look at resonance before claiming? Does Lock feel useful? Do you plan around a card's recharge? Do points and the shop make winning big feel different from scraping a win?

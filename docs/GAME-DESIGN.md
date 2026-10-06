# Game Design: working draft

> Status: design in progress, last updated 2026-10-05 (story and world revised; strategy layer added and simulated, section 3.8).
> This document replaces the Pokemon prototype. Pokemon content and the asylum theme are retired.
> Items marked **(proposed)** have been suggested but not confirmed. Items marked **(open)** have not been decided.

---

## 1. Setting

> Draft story, revised 2026-10-05. Details marked **(open)** are still to be written.

Earth has run out. Its natural resources were used up, and the nuclear wars fought over what was left finished the job. As a last resort, a committee drawn from what remained of the world's nations chose a small group of people and sent them to another planet to start again. (The tone is inspired by Ursula K. Le Guin's *The Dispossessed*: a small society trying to build something new on a hard, unfamiliar world.)

The new planet is not kind. For reasons the colonists can't yet fix *(open: the atmosphere, radiation, something living there)*, they can't survive on its surface unprotected. So they sleep in **vats**: their bodies are sealed in tanks and their minds are joined in a shared **network**.

The only way out of a vat is **remembering**. A mind that reaches a high enough level of memory wakes up and can step outside. The network holds hidden pieces of its own code, called **fragments**. The colonists collect fragments into decks and duel each other with them to train their memory.

**Why waking matters:** the colony can only be built by people who are awake. Every colonist who wakes is another pair of hands outside, and humanity's last chance depends on enough of them making it.

**The population is fixed.** The ship brought a set number of colonists (40 in the MVP), and nobody new will arrive. The ship also brought more vats than people. When a mind loses its hold on a body, the body dies, but the mind drifts through the network to a spare vat and starts over, with its memory set back to the beginning. So colonists don't disappear when they "die"; they lose their progress. The only way anyone leaves the network is by waking, and that is the story's progress: the network slowly empties as the colony outside grows.

**The player** is one of the colonists, but their mind came online late, after the others had settled in. They never had a vat of their own and have to take over a spare one, with whatever fragments its last occupant left behind. A borrowed body doesn't hold well: **the player dies on their first lost duel**, while the other colonists, anchored in their own vats, usually survive a defeat. Rare **anchor** cards (section 5.3) help the player hold on.

---

## 2. Structure at a glance

| Layer | Length | Goal | What persists |
|---|---|---|---|
| **Duel** | one match | out-score the opponent | nothing directly |
| **Life** | until your first loss (unless an anchor holds) | climb Lucidity, build your deck | nothing after death, except unlocks |
| **Game** | 30 days, any number of lives | **wake** before day 30 | unlocks, wake count |
| **Meta** | across games | **10 wakes** gives the true ending | unlocks, wake count, story, past selves |

---

## 3. The duel

### 3.1 Board size
Board size grows every 2 Lucidity levels and stays small on purpose. Within a size, difficulty comes from opponent memory and the opponent's card tiers (section 7). Every board has an even pair count, so both sides supply the same share.

| Lucidity | Grid | Cards | Pairs | Split |
|---|---|---|---|---|
| 1–2 | 4x3 | 12 | 6 | 3 / 3 |
| 3–4 | 4x4 | 16 | 8 | 4 / 4 |
| 5–6 | 5x4 | 20 | 10 | 5 / 5 |
| Wake Attempt (boss) | 6x4 | 24 | 12 | 6 / 6 |

### 3.2 Who supplies the pairs
Each side normally supplies half the pairs. When the count is odd, or one side doesn't own enough pairs, one side supplies more. That side is chosen by these checks, in order:
1. whoever has enough cards
2. whoever has the higher level
3. whoever has the better cards
4. random

Being higher level should never be a disadvantage, but it should not give every advantage either. Supplying more pairs also gives the opponent more to score from.

### 3.3 Loadout
Before each duel, if you own more fragments than your side needs, you choose exactly which ones to bring. Your last loadout is pre-selected. The Wake Attempt uses one loadout for all three duels.

Later, when types have reactions (section 4.3), the loadout is where type combinations become a real choice: which types to bring against an opponent whose main type you can see.

### 3.4 Shared table, private hand
- **Table:** both sides' fragment cards are shuffled face down into one grid. **Either player may flip or claim any card**, whoever brought it.
- **Hand:** bonus cards are private, never placed on the board, and only usable by their owner (section 5).

### 3.5 Turn
1. Optionally play one bonus card from your hand (also allowed between pairs, after a match).
2. Flip 2 cards.
   - **Match:** claim the pair, score it, and keep the turn. You may now **hold**: end your turn instead of flipping again.
   - **Miss:** both cards flip back and the turn passes.
3. The duel ends when the board is cleared. The higher score wins.

**Hold** exists so you can stop after a match instead of being forced into another flip, for example to avoid revealing cards to the opponent, or to save a pair for a better moment (section 3.6). The simulation (section 3.8) found that with good memory, holding is rarely worth it.

Hints and effects must **never block or slow down play**.

### 3.6 Scoring
Each card in a claimed pair scores separately:
- **your own card:** its full tier value
- **the opponent's card:** half its tier value

| Pair (tier 3 example) | Points |
|---|---|
| your card + your card | 3 + 3 = **6** |
| their card + your card | 1.5 + 3 = **4.5** |
| their card + their card | 1.5 + 1.5 = **3** |

Identical cards are interchangeable (section 4.1), so pairs can mix owners. That makes choosing which pair to take a small calculation each time.

Done in the MVP: values are doubled so there are no halves (own card 2 × tier, theirs 1 × tier).

**Resonance** (added 2026-10-05): each side's last claimed type is its resonance. The types form a cycle, **Water → Fire → Air → Electric → Water**. Claiming the type *after* your resonance is **resonant** (+2 per tier). Claiming the type *before* it is **dissonant** (−2 per tier, never below 0). The same type or the opposite type is neutral. Resonance carries over between turns. It replaces the reaction chart of section 4.3, because it is a state that lasts and is easy to read on screen. The cycle is not "Water beats Fire": it represents network resonance, not strength.

**Your duel score also becomes points** (section 10): it is added to a total you keep between duels, unless you die.

### 3.7 Winning and losing
- **Win:** take one card from the opponent's set (it arrives at tier 1), plus currency and Lucidity (section 7).
- **Loss:** death (section 8).

### 3.8 Does perfect memory solve the duel? (simulated 2026-10-05)
The goal: **memory gives information, but perfect memory should not decide the game.** A player who remembers everything should still face real choices.

This is measured with a simulation (`src/core/sim.js`, report: `$env:VAT_SIM_REPORT="1"; npx vitest run src/core/sim`). Two AIs that remember every revealed card play full duels, 300 per setting, with alternating starters:
- **greedy:** takes any known pair, never holds.
- **planner:** takes the pair that swings the score most (resonance, and what the opponent would score if it were left), holds when a blind flip looks bad, and saves dissonant pairs of its own with Lock.

**Findings:**
1. **Planning does not beat greed yet.** The planner wins 40–47% against greedy. The first hold rule ("hold rather than flip blind") won only 8–17%. With a good memory, a "blind" flip often isn't blind: the new card's partner is frequently already remembered, so flipping is usually right.
2. **Known pairs almost never pile up.** A pair becomes known when its second card is seen, and whoever flips next takes it. So "I know several pairs, which order?" happens about 0.0–0.1 times per duel, and resonance rarely creates a choice.
3. **Capping pairs per turn (1, 2 or 3) changed nothing**, for the same reason. It stays in `tuning.js` as `MATCHES_PER_TURN = 0` (off).
4. **Going first is not decisive:** the starter wins 50–60%. The "run the whole board" problem is smaller than feared once both sides remember well.

**So, under perfect memory the duel is still mostly "flip and take what you know".** The new systems (resonance, cooldowns, affinity, Lock, hold) add texture and small edges, but they don't yet create the decisive choices the goal above asks for.

**Candidates for the next experiment** (not built; each can be checked with the same simulation):
1. **Claim effects by type:** claiming a pair does something to the board (for example, Fire reveals a neighbour, Water reshuffles a row, Air swaps two cards, Electric locks a card). *Which* pair you take then changes the board, even when you only know one pair. "Take it now" stops being automatic.
2. **Information as the decision:** with private hints, Echo and Ping, the real choice is *which unknown card to flip*. An AI that plays this well (flipping its own cards first for hints) would show whether it matters.
3. **Knowledge that decays on purpose:** cards that drift a little each round, so memory alone stops being enough. Careful: the goal is not just a harder memory test.

---

## 4. Fragment cards (table)

### 4.1 Types and tiers
- **Types at launch (4):** water, fire, air, electric.
- **Later types:** grass, ghost, dark, psychic, fairy, ice *(open: final count, 8 or 10)*.
- **Tiers:** 1–4. All tiers of one type share a colour, with a different shade per tier.
- **Tier marks:** 1–3 pips for tiers 1–3, a **star** for tier 4. These marks are required for colour-blind support.
- **Interchangeable:** cards of the same type *and* tier match each other, whoever owns them. If both sides bring water tier 2, all 4 of those cards are interchangeable.

### 4.2 Hints
Flipping **your own** fragment as the **first flip of a turn** plays a brief hint toward the location of its pair. Higher tiers give a more precise hint.

| Tier | Hint area | Duration |
|---|---|---|
| 1 | a 3x3 area (9 cards) that contains the pair | about 0.4–0.5s |
| 2 | a 2x2 area (4 cards) that contains the pair | about 1s |
| 3 | the pair plus a neighbouring card, stronger effect | (open) |
| 4 | the pair card itself | (open) |

- **The hint area is placed randomly so that it contains the pair.** The pair is not at its centre, otherwise tier 1 would give away the exact position.
- **Hints belong to the card's owner.** Flipping the opponent's card gives you no hint, so your best cards only ever work for you.
- **Only the first flip gives a hint.** The second flip of a turn never does.
- **Hints are private.** The other player sees the flipped card but not the hint area. The move log notes that a clue was given.
- Card backs don't show who owns a card. Knowing which face-down cards are yours is what the Echo bonus card is for (section 5.2).

Visual style by type:

| Type | Tiers 1–2 | Tier 3 | Tier 4 |
|---|---|---|---|
| Water | the area looks wet | the pair is faintly visible through the water | the pair card becomes visible |
| Fire | the area looks heated | the card, its pair and a neighbour heat up more | the pair card burns |
| Air | the area moves briefly | the card and its neighbour move more | the pair card lifts |
| Electric | the area is briefly electrified | the card and its neighbour are electrified more | the pair card is electrified |

### 4.3 Reactions *(superseded by resonance, section 3.6)*
The earlier idea was a chart of reactions between overlapping hint effects (for example, fire then water cancels). It was stuck on a timing problem: hints last under a second, so effects rarely overlap. Resonance replaces it with a state that lasts (your last claimed type) and changes the value of your next claim. Type effects on the board itself (section 3.8, candidate 2) are the other way types could interact.

### 4.4 Getting and upgrading cards
- **Every card arrives at tier 1**: stolen, bought, unlocked or picked when respawning.
- **Merging:** 2× tier 1 → 1× tier 2, and 2× tier 2 → 1× tier 3. A newly acquired card is therefore a *potential* upgrade, not an immediate one.
- **Tier 4** needs a special condition *(open)*. **(proposed)** 2× tier 3 plus claiming that card N times in duels (mastery).

---

## 5. Bonus cards (hand)

- Private to their owner. **Each card has its own cooldown** and starts each duel ready.
- **Each card recharges its own way**, so cards relate differently to the board:
  - **type:** claim a pair of the card's type (Ping: Electric, Double Down: Fire)
  - **own:** claim a pair of two of your own cards (Lock)
  - **turns:** a number of your turns pass (Echo: 2, Defrag: 4)
- **Affinity:** every Sleeper has two affinity types (the two most common in the vat it spawned in, for the player). Claiming a pair of an affinity type recharges **every** bonus card by one step.
- **Hand and storage:** you own any number of bonus cards; your **hand** (2 slots, 3 from Lucidity 4) is what you take into duels, and the rest wait in **storage**. You swap them on the map between duels. A card you steal or buy goes into the hand if there's room, otherwise into storage.
- One bonus card per turn.
- **MVP set: 5 cards,** one from each category: Ping and Echo (information), Defrag (board manipulation), Double Down (scoring) and Lock (denial).
- **Lock:** pick a face-down card; nobody can flip it until your next turn. It can protect a pair you want to take later (for better resonance), or keep the opponent away from a pair you think they know. Locks open automatically if they would leave fewer than 2 cards to flip.

### 5.1 Special cards
- **Shapeless:**
  - **If played first**, it takes the shape of the next card you flip.
  - **If played second**, it becomes the card you need to complete the match.
  - Afterwards, the other cards shuffle and any earlier effects reset.
- **Virus:** reveals the other card of the pair, whether played first or second. If it's used on a second flip and misses, the next player now knows where that pair is.
  - The reveal area by tier is 9, 3 and then 1 card. The pair is not centred in the area.
- How many specials you hold depends on your progress.

### 5.2 Candidate bonus cards
| Category | Card | Effect |
|---|---|---|
| Info | Ping | briefly reveals 1 / 2 / 3 random cards |
| Info | Cache | a marked card stays faintly see-through for N turns |
| Info | Trace | shows the area the opponent last remembered |
| Info | Scan [colour] | briefly lights up every card of one colour or type family |
| Info | **Echo** (in the MVP) | your own face-down cards shake briefly, only for you. Lets you choose your own card for the first flip and get its hint |
| Disruption | Lag | opponent's next reveal is shorter (old Blind Spot) |
| Disruption | Overclock | opponent's next turn has a time limit (old Speed Round) |
| Disruption | Defrag | reshuffles all unclaimed cards (old Chaos) |
| Denial | **Lock** (in the MVP) | a face-down card can't be flipped until your next turn |
| Disruption | Firewall | opponent's hints don't show for one turn |
| Tempo | Rollback | after a miss, flip one card again |
| Tempo | Extra Thread | flip a third card this turn |
| Tempo | Fork | take 2 turns in a row (4 flips). Long cooldown |
| Scoring | Double Down | next match scores double, but a miss costs 1 point |
| Synergy | Amplifier [type] | that type's hints and reactions are stronger for N turns |
| Synergy | Insulator | blocks the next reaction |

When more types are added, they are grouped into colour families (for example water and ice both in blue), and each family gets its own symbol.

---

### 5.3 Anchors (rare, no slot)
Anchors are a separate, rare kind of card. They don't sit in the hand and take no slot.
- **Anchor:** +5% chance to survive a lost duel.
- **Deep Anchor:** +10% chance to survive a lost duel.
- They stack, up to a cap (30% in the MVP). They are lost when you die, like everything else.
- **Where they come from:** a spare vat sometimes holds one at spawn (kept for free), and some colonists carry one. After beating a colonist you can steal their anchor instead of a fragment or bonus card. The anchor then leaves them.
- **When one holds:** you lose the duel but keep the body, your Lucidity and your cards. A Wake Attempt stage lost this way ends the attempt and sends you back to the map.
- Colonists' anchors lower their own chance of dying when they lose.

## 6. Collection limits
**Lucidity raises how many cards you can own**, for both fragments and bonus cards *(open: exact numbers)*.

---

## 7. Progression: Lucidity

| Lucidity | Effect |
|---|---|
| 1–6 | board grows every 2 levels (4x3, 4x4, 5x4; section 3.1) |
| 7–10 | board stays 5x4; opponent memory grows (1 → 4 remembered turns) |
| 10 | the Wake Attempt unlocks |

### 7.1 Experience and rewards *(still being discussed)*
| Opponent vs you | Lucidity XP | Currency |
|---|---|---|
| higher level | bonus | bonus |
| same level | full | full |
| 1 below (same grid tier) | 0 | half |
| 2+ below, or a smaller grid tier | 0 | minimal |

Farming weak opponents is allowed but costs days, so it is a bad trade. Currency name *(open)*: Bits or Shards.

### 7.2 The map
- **A rectangular grid.** Rows are Lucidity, with 1 at the bottom and 6 at the top. Columns are distance from you, and you stand at the left edge. The MVP uses 6 rows by 8 columns.
- **Each colonist sits in one cell** as a signal, shown by its main type. A cell can hold several colonists or none; empty cells are grey.
- **You can duel rows within 1 Lucidity of yours.** Other rows stay visible but dimmed, so you can watch rivals climb.
- **Distance costs days:** columns 1–3 cost 1 day, 4–6 cost 2, and 7–8 cost 3. The rest of the world moves on for each of those days.
- **Far signals are clear:** a colonist 2 or more days away shows its whole deck (fragments, bonus cards and anchors). Near ones show only level and main type. Travel time buys information.
- A colonist keeps its column as it climbs, so a rival is easy to follow. A colonist that dies moves to a spare vat somewhere else (a new random column) and starts again on the bottom row.

### 7.3 Opponent memory
The AI remembers a limited number of recently revealed cards. At the top end this reaches the last 3–4 turns (6–8 cards), which is very hard for most people to beat. It uses the hints from its own cards, the same as the player. **(proposed)** A little random forgetting so the AI feels human rather than perfect.

### 7.4 The world moves every day
Every day the colonists also duel each other, off-screen, settled by the rng:
- **About half** the colonists fight each day, each against a random colonist at their own level. It's a coin flip.
- **Winner:** goes up one level and gains one card: usually a fragment rolled at its new level's tier odds, sometimes a bonus card. If it now holds two equal fragments and can spare one, it may merge them. Rarely, it finds an anchor.
- **Loser:** dies 20% of the time (minus its anchors) and starts over at Lucidity 1 in another vat. Otherwise it stays where it is, except at Lucidity 6, where a surviving loser drops to 5.
- **A Lucidity 6 winner wakes** 15% of the time and leaves the network for good.
- **Your duels count too.** Beat a colonist and it has the same 20% chance to die. Lose to one at or below your level and it climbs.
- **Warm-up:** the world runs 15 days (without wakes) before your day 1, so every level is already populated when you arrive.

**Why these numbers (simulated, 300 runs of 30 days):** if every loser died, each fight would make one death and at most one level-up, so every level could hold at most half the level below it. 40 colonists would give roughly 20 / 10 / 5 / 3 / 2 / 1 from L1 to L6, and an L5 player would often have nobody to fight. With 20% deaths, the levels stay close to even (about 6–8 per level), a player at any level always had at least 3 colonists in reach, and about 7 of 40 colonists wake by day 30. Dropping surviving L6 losers to L5 stops the top row from filling up with colonists who never wake. Every one of these numbers is in `tuning.js`.

---

## 8. Death and respawn

- **Strict for the player:** losing a duel kills the current body, unless an anchor holds (section 5.3).
- **Respawn:** your mind drifts to a **spare vat**. You keep **3 of the fragments and 1 of the bonus cards** its last occupant left (plus any anchor in it). Everything arrives at tier 1.
- **The first life is also a spawn.** It uses the same rules, so a new start and a post-death start are identical and dying gives no shortcut.
- A respawned body always starts at Lucidity 1, and **respawning costs 1 day** (the world moves on that day).
- **Colonists die too,** but less often (section 7.4). A colonist that dies keeps its name and starts over at Lucidity 1 in a new vat with a fresh deck.
- **Death's only benefit is unlocks:** bonus cards found during a life become **available to buy** in later lives. They do not carry over as owned cards.

---

## 9. Ending

### 9.1 Waking (ends a game)
At Lucidity 10 (Lucidity 6 in the MVP) you can try the **Wake Attempt**: **3 back-to-back duels on 6x4** against the network's **Wardens**, maximum-memory opponents that are not colonists. There is no marketplace between them.
- **Win:** you break out of the vat and the wake count goes up by 1.
- **Lose:** death (strict).
- If you haven't woken by **day 30**, the game ends without a wake.

### 9.2 True ending
**After 10 wakes.** *(open: to be rewritten for the new story.)* One direction: each of your wakes adds to the colony outside, and with 10 there are enough people to found the society the colonists were sent to build. Each wake also reveals part of the story: what went wrong on Earth, and what is keeping the colonists inside their vats.

### 9.3 Past selves *(open: needs rethinking)*
The earlier idea was that each dead body you played joins the NPC pool with the deck you built, so the pool slowly becomes your own past selves. With a fixed population (section 1) this no longer fits as written: nobody new joins the pool. Possible directions:
- Your past bodies are spare vats, not colonists, so they don't duel. A colonist who later takes over one of them inherits your old deck.
- Across games (wakes), the colonists remember you: rivals you beat or lost to carry a mark.

---

## 10. Marketplace
- **Currency: points** (MVP name; the final name is open: Bits or Shards). Your duel score is added to your points total after every duel you survive. Points are lost on death like everything else.
- **MVP shop:** on the map, between duels. It sells every bonus card you don't own yet, for points (25 to 40 each; prices are in `tuning.js`). Fragments and anchors are not for sale.
- Later: only cards you have unlocked are on sale, and unlocks also widen the card choices in multiplayer.
- Bonus cards can strengthen certain types *(open: rules)*. Type-specific recharge (section 5) is a first step.

---

## 11. Multiplayer architecture principles
These apply now, even though multiplayer comes later.
- **One Sleeper model for everyone:** id, level, Lucidity, collection, active deck and hand. The player, NPCs, past selves and remote humans are all Sleepers, each driven by a different controller (local input, AI, or network).
- **The duel engine is pure and action-driven.** All randomness comes from an injected, seeded RNG, so a match can be replayed from its seed and action log.
- **One authority for the board.** The identities of face-down cards sit behind a single interface. In online play the server holds them and clients never see hidden card names.
- **Content is data:** types, tier values (area, duration, intensity), the reaction table and bonus cards are data tables, not code branches.
- Every card on the board has an `ownerId`, `type` and `tier`.

---

## 12. Accessibility
- Never use colour alone. Every type has a symbol and every tier has a pip or star mark.
- Hints and effects never block input. **(open)** An option to lengthen effect durations.

---

## 13. Reuse from the prototype
| Prototype | Becomes |
|---|---|
| `matchMachine.js` (pure turn state machine) | duel engine core; add ownership, hints, statuses and an injected RNG |
| `opponent.js` memory capacity | opponent memory scaling (section 7.3) |
| `modifiers.js` (Blind Spot, Speed Round, Chaos) | the bonus cards Lag, Overclock and Defrag |
| `economy.js` | the new scoring rules and marketplace prices |
| `campaign.js` (30-day counter) | the 30-day game clock |
| steal after a win | kept, but stolen cards arrive at tier 1 |
| Pokemon images and names | removed and replaced with fragment card art |

---

## 14. Open questions
1. ~~What the natural disaster was.~~ Answered 2026-10-05: resource depletion and nuclear war on Earth (section 1).
2. The final type list (8 or 10), and the full reaction chart.
3. How reactions persist (lingering marks or triggering on claimed pairs), and what "multiply" increases.
4. Hint durations for tiers 3 and 4.
5. The tier-4 upgrade condition.
6. Which 6 bonus cards ship at launch, plus their cooldown and charge numbers.
7. Collection limits per Lucidity level.
8. Exact XP and currency numbers, and the currency name.
9. Day cost of respawning and of map distance.
10. Whether to display scores doubled to avoid halves.
11. Exact rules for how past selves level up.
12. Rules for type bonuses in the marketplace.
13. Which bonus cards earn their slot, and their final costs (Echo currently costs the same as Ping and Double Down).
14. How type combinations should shape loadout choices.
15. What keeps the colonists in their vats on the new planet (section 1).
16. The true ending and past selves under a fixed population (sections 9.2, 9.3).
17. Whether the player should ever fight outside reach, and whether the AI should play Echo.
18. What makes choices matter under perfect memory (section 3.8): claim effects by type, information choices, or something else.
19. Whether hold should stay, given the simulation says it is rarely right.

---

## 15. Proposed build order (OpenSpec changes)
1. **Sleeper entity and shared-table ownership:** one model for player and NPCs, `ownerId` on board cards, seeded RNG.
2. **Fragment types and tiers:** 4 types, interchangeable matching, the new scoring, merge upgrades.
3. **Hints:** tiered hint areas, public visibility, pips and symbols.
4. **Hand with charges:** port the 3 existing modifiers, then add the rest of the launch set.
5. **Lucidity, board tiers and the 30-day clock**, plus the XP rules.
6. **Map of signals.** *(MVP version done 2026-10-05: grid map, a living world of 40 colonists, anchors.)*
7. **Death and respawn, plus unlocks.**
8. **Past selves and the Wake gauntlet**, plus the story framing.
9. **Reactions** (once the persistence question is decided).

# First Adventure: the Lanternwick road

The first adventure now supports solo levels 1–10 across 63 rooms. Lanternwick is the working town name; Emberford and Copperhollow are alternatives. The Copper Lantern remains the starting inn, preserving existing character locations and the original orchard quest.

| Region | Recommended levels | Hidden guardian |
|---|---|---|
| Drowned Orchard | 1–2 | The Graftmother |
| Briarwood | 3–4 | The Antler Widow |
| Cinder Quarry | 5–6 | The Kiln Warden |
| Sunken Abbey | 7–8 | The Bellless Prior |
| Hollow Crown | 9–10 | The Hollow Regent |

Each region has a six-room northbound spine, four optional eastern branches, and a concealed guardian room. EXAMINE signs supplies clues; SEARCH reveals hidden exits permanently for that character. MAP draws a north-up ASCII chart of the current region and floor, with numbered rooms, connecting paths, a compass, and a room key. @ marks your position; ? marks unexplored destinations. Stairs appear in the key only after their route is known. Names and exits of unvisited rooms remain hidden. The chart changes pages as you travel between regions. The original Root Cellar encounter is still available.

## Getting started

Choose one of the six disciplines. TALK KEEPER and ACCEPT ORCHARD start the original quest. Travel NORTH twice, ATTACK CRAWLER, LOOT, and DOWN to face the rootbound keeper. Return to the inn and TALK KEEPER for rewards and the next assignment. Follow the road north from the Drowned Orchard to explore the expanded regions. TALK KEEPER turns in ready quests before offering more work. QUESTS tracks progress.

Lanternwick has a smith on Market Lane (east of the inn) and an apothecary east of the market. SHOP lists stock, BUY <item> purchases, and SELL <item> sells an unequipped item for one third of its price, minimum one gold. Characters start with 15 gold; kills award more. The legacy copper-coins item remains a sellable keepsake.

## Equipment and supplies

INVENTORY uses an ANSI panel with equipped slots, gear bonuses, grouped backpack stacks, gold, and [E] markers. EQUIPMENT shows a text figure, occupied weapon/armor/focus slots, power and armor. EQUIP <item> replaces a slot without deleting the old item; UNEQUIP <slot> returns it to the pack. Armor training and discipline restrictions still apply.

Five tiers of trail equipment provide increasing weapon/focus power and armor. Blades add Might, foci add Intellect, and armor adds Agility. Guardian loot supplies all three choices so every discipline can progress. Bonuses are derived from equipped items, never permanently added to base attributes, preventing equip/unequip stacking.

USE healing draught restores 40 HP; USE mana draught restores 24 MP. Supplies and equipment changes are available outside combat. Full resources do not consume a draught. REST remains a free recovery option outside combat. A player can flee, recover and retry.

## Stats and progression

STATS uses an ANSI panel with HP/MP/XP bars, exact resource values, and separate base/gear/total columns:

- Might contributes to physical damage. Each level also adds one physical damage.
- Agility controls attack interval (minimum 1.4 seconds), attacks per volley (1/2/3 at agility 0/4/7), and critical chance (capped at 40%).
- Intellect contributes to spell damage and starting mana. Arcanist automatic attacks use the higher of weapon and focus power.
- Vitality sets initial maximum health: 34 + 6 × Vitality. Each level adds 6 HP. Mana users gain 4 MP per level. Level-ups fully restore resources.
- Armor reduces physical damage; class magic resistance applies to magic damage. Existing discipline abilities remain available.

Cumulative XP thresholds: 0, 100, 200, 600, 1400, 2800, 4800, 7600, 11200, 16000. This preserves the original level-three opening and stretches later progression. Ordinary creatures return after three minutes; guardians after ten minutes. Timers use server time and persist per character. Permanent kill history separately records quest objectives. Defeat preserves XP, gold, items and quest progress.

## Pacing and validation

The target is at least two hours of exploration, fighting, recovery, side paths and repeat encounters. This is a content/balance baseline, not a verified two-hour playtime claim. A complete unique clear does not supply all 16,000 XP; later levels intentionally require some repeat encounters. Automated tests verify connected routes, hidden discoveries, respawn boundaries, trading, bonus removal, quest turn-ins, repeat XP to level ten, and all six disciplines defeating each guardian at the region's upper recommended level with previous-tier equipment.

Human playtesting is still needed to measure discovery time and tune encounter density, XP and class difficulty. Encounters and respawns are per-character; room chat/presence remains shared. No shared boss locking or party loot distribution is introduced.

The entry screen uses original ANSI artwork with a classic 16-color palette, foreground/background colors, and shaded block characters. The scene shows a golden lantern before a moonlit castle and forest. Type TITLE to replay it. It remains entirely text-based, with no image assets or copied LORD artwork. See [ANSI artwork](ANSI_ART.md) for supported controls and legacy-file compatibility.

## Command shortcuts

Full commands remain supported. You can abbreviate commands and use unique word prefixes for visible targets or available items:

| Input | Meaning |
|---|---|
| `a c` / `a m` | Attack the marsh crawler when it is the unique matching creature |
| `a` | Attack the sole visible creature; show choices if several are present |
| `b blade 1` | Buy trail blade 1 at the smith |
| `t k` | Talk to Keeper Vale |
| `x trac` | Examine tracks |
| `equip blade 1` | Equip a carried trail blade 1 |
| `uneq w` | Unequip the weapon slot |
| `use heal` | Use a carried healing draught |
| `c e m` | Cast ember at the marsh crawler |

Exact names and IDs take priority over partial matches. Ambiguous targets list choices without acting or spending gold; for example, `b blade` asks for a tier. Duplicate copies of the same carried item count as one choice. Matching is limited to the current room, shop stock, or inventory as appropriate. Existing direction shortcuts, social messages, and full commands keep their meaning. HELP lists common shortcuts.

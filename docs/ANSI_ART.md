# ANSI artwork

The intro now renders actual ANSI SGR color sequences as styled text. Its original 72-column composition uses a classic 16-color palette, foreground and background colors, half-block pixels, shaded blocks, and box-drawing characters. A gold lantern stands before moonlit castle walls and a forest; block lettering titles the scene NEXTMUD: FIRST LIGHT.

The identity screens and game transcript share `components/ansi-art.tsx`. Type TITLE to replay the intro. The art scales to the terminal's width, preserves character spacing, and has an accessible text description. There is no blinking, animation, downloaded font, image asset, or added dependency.

## Authoring

`lib/game/intro.ts` exports the ANSI string and an accessible description. Its scene builds pairs of colored pixel rows using the upper-half-block character, with independent foreground and background colors. This is text-cell art, not a bitmap. The block letters and border use normal ANSI sequences too.

`lib/game/ansi.ts` supports SGR reset (0), bold-as-bright (1/22), reverse video (7/27), default foreground/background (39/49), basic colors (30–37/40–47), and explicit bright colors (90–97/100–107). It follows the [xterm control-sequence reference](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html) for these controls. Each artwork starts with independent styling state.

Artwork is limited to 65,536 input characters. Unsupported cursor and screen controls and OSC/DCS payloads are discarded. Extended color groups are consumed without interpreting their components as separate flags. React renders content as escaped text; embedded HTML is not executed. Intro artwork uses the `art` tone; MAP, INVENTORY and STATS use `format: "ansi"` with their existing semantic tone and a descriptive label. Social and narrative text keep their existing presentation.

## Legacy file compatibility

This is a static SGR renderer, not a complete DOS terminal emulator. Current assets use Unicode equivalents of CP437 block and box-drawing characters. Before importing historical `.ANS` files, decode their original character encoding, remove metadata such as SAUCE, and flatten cursor-positioned drawing into rows. Raw CP437 files, cursor painting, blinking, 256-color and truecolor palettes are not supported by this first version.

## Game panels

MAP uses cyan box borders and routes, a bright green current-position marker, neutral unexplored markers, and gold stair labels. It retains the same discovery filtering as the plain map and does not expose hidden rooms.

INVENTORY (also INV and I) separates equipped slots and their bonuses from grouped backpack stacks. Equipped entries are green with [E], supplies are purple, and gold is yellow. Stacks show total carried quantity, including the equipped copy. Empty slots and empty packs remain explicit.

STATS includes labeled HP/MP/XP bars with exact numeric values, base/gear/total attribute columns, combat cadence, armor, resistance, gold and deaths. XP bars show progress within the current level rather than lifetime XP. Characters without mana and those at the level cap have explicit labels.

Panels render as readable text groups, rather than decorative images, so their contents remain available to assistive technology. They scale by column count, retaining horizontal scrolling at narrow widths instead of wrapping or truncating columns. Styling never changes character state or combat calculations.

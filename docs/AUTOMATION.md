# Player automation

Automation is an explicit game mechanic, not an accidental loophole. It should reward planning while preserving risk, discovery, social play, and the in-game economy.

## Proposed language

The automation language will be declarative and narrow:

```text
script copper_run {
  repeat 5 {
    go north
    hunt "cave rat" until hp < 35%
    loot coins
    if hp < 35% {
      return "The Copper Lantern"
      rest until hp > 90%
    }
  }
}
```

It is not JavaScript and has no filesystem, network, database, environment, reflection, dynamic import, or arbitrary code execution.

## Execution rules

- Compile scripts into a validated internal instruction tree.
- Require each emitted game command to pass through the normal command engine.
- Limit total steps, loop depth, runtime, command rate, and allowed capabilities.
- Stop on unexpected combat, unreachable locations, insufficient resources, or changed world conditions.
- Record a human-readable trace explaining every action and stop reason.
- Begin with online-only execution in a browser worker.
- Add durable server-side runs only after a queue, quotas, cancellation, and abuse controls exist.

## AI interface

An LLM can convert a natural-language goal into proposed DSL source. The player sees, edits, and approves the script before it runs. The compiler—not the LLM—decides whether it is valid, and the game server independently authorizes every resulting action.

## Design questions before implementation

- Which automation capabilities are available at level one, and which are earned?
- Does automation consume focus, stamina, tools, or script slots?
- Can scripts react to other players, or only to the owner's state and public room events?
- Which economic activities must remain interactive?
- Is offline execution ever allowed, and under what daily budget?

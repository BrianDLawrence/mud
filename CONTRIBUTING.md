# Contributing

Thank you for helping build NextMUD. The project is early, so a small proposal before a large implementation can prevent incompatible systems from developing in parallel.

## Before opening a pull request

1. Read the product principles and architecture documentation.
2. Open or reference an issue for changes to game mechanics, schemas, dependencies, or public APIs.
3. Keep domain rules in `lib/game` and presentation concerns in `app` or `components`.
4. Add tests for game-rule and world-schema changes.
5. Run `npm test`, `npm run lint`, and `npm run build`.

## Pull request expectations

- Explain the player or author outcome, not only the implementation.
- Keep changes focused and call out deferred work.
- Include migration and rollback notes for persistent data changes.
- Include screenshots only when visual layout changes; text transcripts are preferred for game behavior.
- Do not include secrets, production data, copied game content, or generated lockfiles from a different package manager.

## Design constraints

- The primary game UI remains text-only.
- The server remains authoritative.
- AI and player scripts cannot bypass normal command authorization.
- Published content IDs are stable.
- New dependencies need a concrete reason and maintenance assessment.
- Accessibility is part of the terminal design, particularly color contrast and non-color cues.

## Commit style

Use short imperative subjects such as `Add room exit validation` or `Prevent duplicate combat commands`. Separate unrelated refactors from behavior changes.

## License status

No project license has been selected yet. Until one is added, normal copyright restrictions apply. Maintainers should choose and publish a license before accepting public code contributions.

# Working on 4emp (for coding agents and new contributors)

4emp is a local-first Expo SDK 53 / React Native app: personal money plus work-time tracking. There is no backend. SQLite is the source of truth. Read `README.md` for product behaviour; this file is the map and the rules.

## Commands

```sh
npm ci
npm run typecheck   # strict TypeScript
npm test            # logic tests: node:test + real SQLite (node:sqlite), no device needed
npm run test:ui     # Jest + React Native Testing Library
npm run check       # all three; run before every commit
```

Logic tests live in `tests-ts/`, UI tests in `tests-ui/`. Logic tests need Node 22+ (Node 24 recommended) because they use `node:sqlite`.

## Where things live

| Path | What belongs there |
| --- | --- |
| `app/` | Expo Router route files. Each is a one-line re-export of a screen. |
| `src/domain/` | Pure rules (shifts, finance cycle, settings schema). No React, no SQLite. |
| `src/db/` | Connection, migrations (`schema.ts`), exclusive-transaction wrapper (`open.ts`). |
| `src/repositories/` | All writes. Validate with Zod, then write inside one exclusive transaction. |
| `src/services/` | Recurrence/reconciliation, notifications, backup, crypto. |
| `src/state/store.ts` | Zustand store. `refresh()` reloads everything; `mutate()` wraps a write. |
| `src/features/design/` | Theme tokens (`theme.ts`), charts, shared controls. |
| `src/features/rules/` | The user-rules registry and the generated Rules screen. |
| `src/ui/kit.tsx` | `useTheme`, `Page`, `Card`, `Button`, `Chips`, `Field`, `Label`, `act()`. |
| `src/features/*`, `src/screens/` | Screens. |

## Rules that keep data correct

1. **Money is integer minor units** (`*_minor`, paise). Never store or sum floats. `amount` fields in rupees are read-only view projections.
2. **Balances are derived** from `opening_minor` plus non-voided ledger rows. There is no balance column to update.
3. **Calendar dates are local `YYYY-MM-DD` keys.** Build and check them with `dateKey()` / `localDate()` from `src/domain/shift.ts`. Never use `toISOString().slice(0, 10)` for a calendar date: it shifts by a day in far-east and far-west timezones.
4. **Timestamps are ISO-8601 UTC strings** (`toISOString()`).
5. **Every multi-statement write runs in `db().withExclusiveTransactionAsync`.** Ledger rows are created only through `writeEntry()`.
6. **Deleting a transaction is a soft void** (`voided_at`), and edits/deletes lock when the user's edit window ends (`readEditWindow`). Enforce this in the repository, not only in the UI.
7. **Occurrence identities are permanent.** Salary, recurring and auto-post subscription occurrences keep their row after a reversal so reopening the app never re-posts them.
8. **`reconcilePlans()` runs on every refresh and must never throw for bad plan data.** A rule that cannot post stays visible as a due reminder. A throw here locks the user out of the app.
9. **Reading settings must not throw** (`recoverSettings`); writing settings stays strict (`validateSettings`).
10. **Schema changes are append-only migrations** in `src/db/schema.ts`. Add new tables to `backupTables`, and never edit a shipped migration.

## Adding a user rule

Behaviour a user might reasonably want to change is a **rule**, not a constant.

1. Add the setting to `Settings` and `defaultSettings` (`src/domain/models.ts`) and to `settingsSchema` with a `.default()` (`src/domain/settingsValidation.ts`). The default must keep existing behaviour.
2. Add one entry to `rules` in `src/features/rules/registry.ts`.
3. Read the value where the behaviour is enforced. Enforce in the repository or service, and only mirror it in the UI.

The Rules screen, the focused editor and validation pick the rule up automatically. `tests-ts/rules.test.ts` checks that every registered rule has a schema and a default of the right type.

## Adding a screen

1. Export the screen component from a feature file.
2. Add `app/<route>.tsx` that re-exports it as default.
3. Add the route to `RootStack` and `paths` in `src/ui/navigation.ts`.

`tests-ts/regressions.test.ts` fails if a path in `navigation.ts` has no route file.

## UI and theme rules

- Take every colour from `useTheme()`. Do not write hex literals in screens. The one exception is the fixed-navy balance console on Home.
- `t.accent` is the user's raw colour and is for **fills**; pair it with `t.onAccent`. For accent-coloured **text or icons** use `t.accentInk`, which is contrast-adjusted.
- `tests-ts/design.test.ts` checks WCAG AA contrast for all tokens in both modes. Change a token, run the test.
- Do not use `textTransform`. On Android it rewrites the real text, which breaks the smoke test (`scripts/android-smoke.py`) and text lookups.
- Touch targets are at least 44×44 (use `hitSlop` for small icons).

## Accessibility and automation contract

Screen readers, the Jest tests and the Android smoke test all find controls the same way, so treat these as API:

- Every pressable has `accessibilityRole` and either visible text or an `accessibilityLabel`.
- Stateful controls expose `accessibilityState` (`selected`, `disabled`, `busy`, `expanded`).
- Visible labels and `accessibilityLabel` strings are stable identifiers. If you rename one, update `tests-ui/` and `scripts/android-smoke.py` in the same change.
- Decorative views (HUD brackets, header rules) are hidden from accessibility.

## Before you finish

- Add a failing test first for any bug fix (`tests-ts/regressions.test.ts` is the place for cross-cutting ones).
- Run `npm run check`.
- Update `README.md` when behaviour changes.

# Diagrams

PlantUML source, hand-written against the real schema/code (not auto-generated) —
regenerate by hand whenever the underlying migration or module changes shape.

| File | What it shows | Traces to |
|---|---|---|
| `er-diagram.puml` | Full database schema — every table, column, and FK as of migration `0012` | `supabase/migrations/*.sql` |
| `sequence-meta-sync.puml` | The daily Meta Ads sync flow, one ad account, success + error paths | `app/api/cron/sync/route.ts`, `lib/meta/sync.ts` |
| `class-domain-model.puml` | Application-layer types and the pure functions that operate on them (distinct from the DB shape — several fields here are computed at query time, never stored) | `lib/campaigns/`, `lib/profitability/`, `lib/alerts/`, `lib/meta/`, `lib/dashboard/`, `components/CampaignTable.tsx` |

## Rendering

No Java/PlantUML was available in the environment these were written in, so
they haven't been rendered — reviewed instead by hand for balanced blocks
(`alt`/`end`, `loop`/`end`, `{`/`}`, `note`/`end note`). Render before trusting
the layout:

- **VS Code** — install the "PlantUML" extension (jebbs.plantuml), open a
  `.puml` file, `Alt+D` for a live preview.
- **plantuml.com** — paste the file contents into
  [plantuml.com/plantuml](https://www.plantuml.com/plantuml/uml/).
- **CLI** — `plantuml er-diagram.puml` (needs a local JRE + `plantuml.jar`,
  or `npx node-plantuml`, both of which still shell out to Java).

## Keeping these current

There's no CI check tying these to the schema — if you add a migration or
change a type in one of the traced files, update the matching diagram in the
same PR. `docs/DATA_MODEL.md` Section 0 has the fuller prose history of schema
changes if you need context beyond what a diagram can show.

## What & why

<!-- What does this PR do, and which epic/sprint (see docs/DEVELOPMENT_PLAN.md) does it belong to? -->

## PRD traceability

<!-- Which PRD section(s) does this satisfy? e.g. "Section 9.2 Campaign Monitoring" -->

## Checklist

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] New workspace-scoped tables have RLS enabled + policies (see `docs/DATA_MODEL.md` §5)
- [ ] Any "Estimated ROI/ROAS" surface is labeled per `docs/DEVELOPMENT_PLAN.md` §7
- [ ] Mutating actions are captured in the audit log

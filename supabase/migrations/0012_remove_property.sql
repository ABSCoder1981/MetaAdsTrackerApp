-- Business decision: remove the Property module (and, as a consequence,
-- the Profitability Advisor, since its profitable/break-even/loss-making
-- verdict is defined entirely by a property's assumed conversion rate and
-- average deal value — with Property gone there's no revenue estimate left
-- to classify against). See docs/DEVELOPMENT_PLAN.md's Deviation Log.
--
-- City remains untouched: campaign.city is already an independent,
-- bulk-taggable attribute (PRD v4 Section 9.2, migration 0008), never
-- derived from Property, so City Leaderboard and city tagging keep working
-- exactly as before.

-- ---------------------------------------------------------------------------
-- 1. Profitability Advisor: drop the snapshot table and its workspace
--    thresholds column. Any open 'pause_recommended' alerts are left as
--    historical records (alert.rule_key is just a string, no FK) — they'll
--    simply never be created again.
-- ---------------------------------------------------------------------------

drop table if exists profitability_snapshot;
alter table workspace drop column if exists profitability_thresholds;

-- ---------------------------------------------------------------------------
-- 2. Property tagging: drop the FK columns that pointed at property.
-- ---------------------------------------------------------------------------

alter table lead drop column if exists property_id;
alter table campaign drop column if exists property_id;
alter table campaign drop column if exists tagging_source; -- only ever recorded property-tagging provenance

-- ---------------------------------------------------------------------------
-- 3. Drop the property table itself.
-- ---------------------------------------------------------------------------

drop table if exists property;

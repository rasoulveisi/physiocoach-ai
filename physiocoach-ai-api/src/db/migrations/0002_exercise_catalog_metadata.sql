ALTER TABLE `master_exercises`
  ADD COLUMN `recommended_level` text;

ALTER TABLE `master_exercises`
  ADD COLUMN `goal_tags_json` text;

ALTER TABLE `master_exercises`
  ADD COLUMN `excluded_limitations_json` text;

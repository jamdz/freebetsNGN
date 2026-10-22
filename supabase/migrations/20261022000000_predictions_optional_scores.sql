alter table public.predictions
  alter column home_goals drop not null,
  alter column away_goals drop not null;

alter table public.predictions
  drop constraint if exists predictions_scores_both_or_none,
  drop constraint if exists predictions_outcome_matches_score;

alter table public.predictions
  add constraint predictions_scores_both_or_none
  check ((home_goals is null) = (away_goals is null)),
  add constraint predictions_outcome_matches_score
  check (
    home_goals is null
    or (outcome = 'home' and home_goals > away_goals)
    or (outcome = 'draw' and home_goals = away_goals)
    or (outcome = 'away' and home_goals < away_goals)
  );

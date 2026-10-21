-- FreeBetNGN local/test seed. Safe to rerun by external_id.
with current_gameweek as (
  insert into public.gameweeks(starts_at, ends_at, prize_status, qualification_waived)
  values (date_trunc('week', now()), date_trunc('week', now()) + interval '7 days', 'open', false)
  returning id
)
select id from current_gameweek;

insert into public.competitions(name, country, external_id) values
  ('Premier League', 'England', 'seed-epl'),
  ('La Liga', 'Spain', 'seed-laliga'),
  ('Serie A', 'Italy', 'seed-serie-a'),
  ('NPFL', 'Nigeria', 'seed-npfl')
on conflict (external_id) do update set name = excluded.name, country = excluded.country;

insert into public.teams(name, competition_id, external_id)
select v.name, c.id, v.external_id
from (values
  ('Arsenal','seed-epl','seed-arsenal'), ('Chelsea','seed-epl','seed-chelsea'), ('Liverpool','seed-epl','seed-liverpool'), ('Manchester City','seed-epl','seed-man-city'),
  ('Barcelona','seed-laliga','seed-barcelona'), ('Real Madrid','seed-laliga','seed-real-madrid'), ('Atletico Madrid','seed-laliga','seed-atletico'), ('Sevilla','seed-laliga','seed-sevilla'),
  ('Inter Milan','seed-serie-a','seed-inter'), ('AC Milan','seed-serie-a','seed-ac-milan'), ('Juventus','seed-serie-a','seed-juventus'), ('Napoli','seed-serie-a','seed-napoli'),
  ('Enyimba','seed-npfl','seed-enyimba'), ('Kano Pillars','seed-npfl','seed-kano-pillars'), ('Rivers United','seed-npfl','seed-rivers'), ('Plateau United','seed-npfl','seed-plateau')
) as v(name, competition_external_id, external_id)
join public.competitions c on c.external_id = v.competition_external_id
on conflict (external_id) do update set name = excluded.name, competition_id = excluded.competition_id;

with gw as (select id from public.gameweeks where starts_at = date_trunc('week', now()) limit 1), games as (
  select * from (values
    ('seed-fix-01','seed-arsenal','seed-chelsea',1), ('seed-fix-02','seed-liverpool','seed-man-city',2), ('seed-fix-03','seed-barcelona','seed-real-madrid',3), ('seed-fix-04','seed-atletico','seed-sevilla',4), ('seed-fix-05','seed-inter','seed-ac-milan',5),
    ('seed-fix-06','seed-juventus','seed-napoli',6), ('seed-fix-07','seed-enyimba','seed-kano-pillars',7), ('seed-fix-08','seed-rivers','seed-plateau',8), ('seed-fix-09','seed-chelsea','seed-liverpool',9), ('seed-fix-10','seed-man-city','seed-arsenal',10),
    ('seed-fix-11','seed-real-madrid','seed-atletico',11), ('seed-fix-12','seed-sevilla','seed-barcelona',12), ('seed-fix-13','seed-ac-milan','seed-juventus',13), ('seed-fix-14','seed-napoli','seed-inter',14), ('seed-fix-15','seed-kano-pillars','seed-rivers',15),
    ('seed-fix-16','seed-plateau','seed-enyimba',16), ('seed-fix-17','seed-arsenal','seed-liverpool',17), ('seed-fix-18','seed-barcelona','seed-sevilla',18), ('seed-fix-19','seed-inter','seed-napoli',19), ('seed-fix-20','seed-enyimba','seed-rivers',20)
  ) as x(external_id, home_external_id, away_external_id, match_no)
)
insert into public.fixtures(competition_id, home_team_id, away_team_id, kickoff_at, external_id)
select hc.id, ht.id, at.id, now() + (g.match_no || ' hours')::interval, g.external_id
from games g join public.teams ht on ht.external_id = g.home_external_id join public.teams at on at.external_id = g.away_external_id join public.competitions hc on hc.id = ht.competition_id cross join gw
on conflict (external_id) do update set home_team_id = excluded.home_team_id, away_team_id = excluded.away_team_id, kickoff_at = excluded.kickoff_at;

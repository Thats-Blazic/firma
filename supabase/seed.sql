-- OPTIONAL starter data: the places already shown on the public website.
-- Contains NO prices, routes, trips or bookings — everything commercial is
-- created by the administrator in /admin. Safe to run more than once.

insert into public.destinations (name, slug, country, description, is_pickup, is_destination, sort_order) values
  ('Zlatibor',        'zlatibor',        'Srbija',    'Planinski predeli zapadne Srbije.',      true, true, 10),
  ('Manastir Ostrog', 'manastir-ostrog', 'Crna Gora', 'Manastir ukopan u stenu.',               true, true, 20),
  ('Budva',           'budva',           'Crna Gora', 'Stari grad, plaže i jadranska obala.',   true, true, 30),
  ('Kotor',           'kotor',           'Crna Gora', 'Kotorski zaliv i stari grad.',           true, true, 40),
  ('Tivat',           'tivat',           'Crna Gora', 'Marina Porto Montenegro i aerodrom.',    true, true, 50),
  ('Podgorica',       'podgorica',       'Crna Gora', 'Glavni grad Crne Gore.',                 true, true, 60),
  ('Herceg Novi',     'herceg-novi',     'Crna Gora', 'Grad na ulazu u Bokokotorski zaliv.',    true, true, 70),
  ('Žabljak',         'zabljak',         'Crna Gora', 'Durmitor i Crno jezero.',                true, true, 80),
  ('Beograd',         'beograd',         'Srbija',    '',                                       true, true, 5),
  ('Novi Sad',        'novi-sad',        'Srbija',    '',                                       true, true, 6)
on conflict (slug) do nothing;

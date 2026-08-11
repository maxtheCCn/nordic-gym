-- =============================================================================
--  NW Logg — databasschema för synk mellan enheter
--
--  Klistra in hela filen i Supabase → SQL Editor → Run. Den går att köra om
--  utan att förstöra något.
-- =============================================================================

-- En enda tabell för allt.
--
-- Appen läser aldrig data via SQL — den laddar hela loggen till minnet och
-- räknar fram statistik i webbläsaren. Servern behöver därför inte förstå
-- innehållet, bara lagra det och tala om vad som ändrats sedan sist.
--
-- Vinsten: nya fält i appen (som "antal set du brukar köra") kräver ingen
-- databasmigrering. Raden är bara JSON.
create table if not exists public.records (
  user_id    uuid   not null default auth.uid() references auth.users on delete cascade,
  -- 'gym' | 'machine' | 'session' | 'set' | 'profile'
  kind       text   not null,
  id         text   not null,
  data       jsonb  not null,
  -- Millisekunder sedan epoch. Vinner vid krock: senaste skrivningen gäller.
  updated_at bigint not null,
  -- Mjuk radering. En rad som tas bort måste finnas kvar som gravsten, annars
  -- skulle den andra enheten läsa tillbaka den vid nästa synk.
  deleted_at bigint,
  primary key (user_id, kind, id)
);

-- Synken frågar alltid "vad har ändrats sedan tidpunkt X för den här
-- användaren" — det här indexet är precis den frågan.
create index if not exists records_user_updated_idx
  on public.records (user_id, updated_at);

-- -----------------------------------------------------------------------------
--  Åtkomst
--
--  Utan detta skulle vem som helst med appens publika nyckel kunna läsa allas
--  träningsdata. Med det ser varje konto bara sina egna rader — nyckeln i
--  webbläsaren blir ofarlig, vilket är precis så Supabase är tänkt att användas.
-- -----------------------------------------------------------------------------
alter table public.records enable row level security;

drop policy if exists "egna rader" on public.records;
create policy "egna rader" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
--  Topplista
--
--  Egen tabell, inte en vy över records. Träningsloggen ovan är privat och ska
--  förbli det — här ligger bara det man aktivt valt att visa. Två tabeller med
--  olika regler är enklare att lita på än en tabell med filtrerade rättigheter.
-- =============================================================================
create table if not exists public.leaderboard (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text   not null,
  -- Sökväg i avatars-hinken. Tomt = appen ritar en cirkel med initialen.
  avatar_path  text,
  -- Övningarna man valt att visa: [{ exercise, weight, reps, at }]
  -- Uppdateras automatiskt vid varje synk, så listan följer med när man
  -- förbättrar sig utan att man behöver publicera om.
  lifts        jsonb  not null default '[]'::jsonb,
  updated_at   bigint not null
);

alter table public.leaderboard enable row level security;

-- Alla inloggade får läsa hela listan — det är själva poängen.
drop policy if exists "alla inloggade läser" on public.leaderboard;
create policy "alla inloggade läser" on public.leaderboard
  for select
  to authenticated
  using (true);

-- Men bara sin egen rad får man skriva.
drop policy if exists "skriv egen rad" on public.leaderboard;
create policy "skriv egen rad" on public.leaderboard
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
--  Profilbilder
--
--  Filer hamnar i en egen hink, inte i databasen. Bilder i databasen hade
--  följt med i varje synk och gjort den långsam, helt i onödan.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatarer är publika" on storage.objects;
create policy "avatarer är publika" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Filnamnet måste börja med användarens id, så ingen kan skriva över någon
-- annans bild.
drop policy if exists "ladda upp egen avatar" on storage.objects;
create policy "ladda upp egen avatar" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "byt egen avatar" on storage.objects;
create policy "byt egen avatar" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "radera egen avatar" on storage.objects;
create policy "radera egen avatar" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
--  Inbjudningskod
--
--  Koden ligger i en tabell i stället för i appens kod, så att den går att
--  byta utan att appen behöver byggas om.
--
--  Var medveten om vad den skyddar mot: den håller borta den som råkar hitta
--  adressen. Den som läser appens JavaScript kan få tag i koden. För en
--  kompisgrupp räcker det; ska det vara vattentätt krävs en serverfunktion.
-- =============================================================================
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

insert into public.app_config (key, value)
values ('invite_code', 'BYT-MIG')
on conflict (key) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "alla får läsa" on public.app_config;
create policy "alla får läsa" on public.app_config
  for select
  using (true);

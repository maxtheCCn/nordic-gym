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
--
--  En rad per lyft i stället för en klump per person: då kan listan sorteras
--  och grupperas av databasen, och ett enskilt lyft kan godkännas för sig.
-- =============================================================================
create table if not exists public.leaderboard_lifts (
  id           text   primary key,
  user_id      uuid   not null default auth.uid() references auth.users on delete cascade,
  display_name text   not null,
  -- Sökväg i avatars-hinken. Tomt = appen ritar en cirkel med initialen.
  avatar_path  text,
  category     text   not null,
  exercise     text   not null,
  weight       numeric not null,
  reps         int,
  -- Sätts bara av en administratör, se utlösaren längre ner.
  verified     boolean not null default false,
  updated_at   bigint not null
);

create index if not exists leaderboard_lifts_sort_idx
  on public.leaderboard_lifts (category, exercise, weight desc);

alter table public.leaderboard_lifts enable row level security;

-- Alla inloggade får läsa hela listan — det är själva poängen.
drop policy if exists "alla inloggade läser" on public.leaderboard_lifts;
create policy "alla inloggade läser" on public.leaderboard_lifts
  for select to authenticated using (true);

drop policy if exists "skriv egna lyft" on public.leaderboard_lifts;
create policy "skriv egna lyft" on public.leaderboard_lifts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
--  Administratörer
--
--  Lösenordet i appen låser bara upp knapparna. Vem som helst som läser appens
--  JavaScript hittar det, så det får inte vara det enda som skyddar. Den
--  riktiga kontrollen sitter här: bara den som står i tabellen kan sätta en
--  bock, oavsett vad som skrivs i rutan eller skickas direkt till API:et.
--
--  Lägg till dig själv när du vet ditt användar-id:
--    insert into public.admins (user_id) values ('<ditt-uuid>');
--  Id:t hittar du under Authentication → Users i Supabase.
-- =============================================================================
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

alter table public.admins enable row level security;

-- Alla inloggade får se vilka som är administratörer, så att appen kan visa
-- adminvyn för rätt person. Ingen kan skriva i tabellen via appen.
drop policy if exists "alla inloggade läser admins" on public.admins;
create policy "alla inloggade läser admins" on public.admins
  for select to authenticated using (true);

-- Administratörer får ändra andras lyft: godkänna dem och rätta namn.
drop policy if exists "admin ändrar alla lyft" on public.leaderboard_lifts;
create policy "admin ändrar alla lyft" on public.leaderboard_lifts
  for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

/*
 * Hindrar alla utom administratörer från att sätta bocken.
 *
 * Utan den här kunde vem som helst skicka verified = true direkt till API:et
 * och bocken vore meningslös. Utlösaren återställer värdet i stället för att
 * avvisa skrivningen, så ett vanligt sparande fortfarande går igenom.
 */
create or replace function public.enforce_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    new.verified := coalesce(old.verified, false);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_verified_ins on public.leaderboard_lifts;
create trigger enforce_verified_ins
  before insert on public.leaderboard_lifts
  for each row execute function public.enforce_verified();

drop trigger if exists enforce_verified_upd on public.leaderboard_lifts;
create trigger enforce_verified_upd
  before update on public.leaderboard_lifts
  for each row execute function public.enforce_verified();

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

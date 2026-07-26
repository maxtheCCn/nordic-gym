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

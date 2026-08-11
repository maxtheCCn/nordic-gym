# Synk mellan enheter — vad du behöver göra

Appen fungerar utan det här. Gör du inget fortsätter den precis som förut, med
all data i telefonen. Det här sätter på synk så att maskiner och träningslogg
följer med mellan telefon, surfplatta och dator.

Tre steg, cirka fem minuter. Jag kan inte göra dem åt dig — de kräver att du är
inloggad på ditt eget konto.

## 1. Skapa ett Supabase-projekt

Gå till [supabase.com](https://supabase.com) och skapa ett konto (gratis).

Skapa ett nytt projekt:

- **Name:** `nw-logg`
- **Database Password:** låt den generera en — du behöver aldrig använda den,
  men **spara den ändå** någonstans säkert
- **Region:** välj den närmaste, t.ex. Frankfurt eller Stockholm

Projektet tar ett par minuter att starta.

## 2. Skapa tabellerna

I projektet, gå till **SQL Editor** i vänstermenyn och tryck **New query**.

Öppna filen [`supabase/schema.sql`](supabase/schema.sql) i det här projektet,
kopiera **hela innehållet**, klistra in och tryck **Run**.

Det ska stå `Success. No rows returned`.

Det skapar allt på en gång: träningsloggen, topplistan, en hink för
profilbilder och en tabell för inbjudningskoden.

## 2b. Sätt din inbjudningskod

Koden börjar som `BYT-MIG`. Byt den till något eget — kör det här i SQL Editor,
med din egen kod i stället:

```sql
update public.app_config set value = 'DIN-EGNA-KOD' where key = 'invite_code';
```

Den som ska skapa konto behöver koden. Du kan byta den när som helst med samma
kommando, utan att appen behöver byggas om.

**Vad koden skyddar mot:** den håller borta den som råkar hitta adressen. Den
som läser appens JavaScript kan gräva fram den. För en kompisgrupp räcker det
— ska det vara vattentätt krävs en serverfunktion, och det är ett större jobb.

## 3. Stäng av mejlbekräftelse

Eftersom du vill logga in med bara användarnamn och lösenord får appen inte
kräva att en mejladress bekräftas.

Gå till **Authentication → Sign In / Providers → Email** och stäng av
**Confirm email**. Spara.

## 4. Skicka två värden till mig

Gå till **Project Settings → API** och kopiera:

- **Project URL** — ser ut som `https://abcdefghijk.supabase.co`
- **anon public** — en lång nyckel som börjar med `eyJ...`

Klistra in båda i chatten, så kopplar jag ihop appen och deployar.

### Är det säkert att visa nyckeln?

Ja. `anon`-nyckeln är gjord för att ligga öppet i webbläsaren — den hamnar ändå
i sidans JavaScript på en publik adress. Skyddet ligger i regeln vi la in i steg
2: varje konto kommer bara åt sina egna rader, oavsett vem som har nyckeln.

Skicka däremot **aldrig** `service_role`-nyckeln. Den går förbi alla regler.

## Bra att veta om inloggningen

Du väljer användarnamn och lösenord — ingen mejl behöver bekräftas.

Baksidan: **det finns ingen glömt lösenord-funktion.** Utan en riktig mejladress
finns det ingen väg tillbaka in i kontot. Två saker mildrar det:

- Din data ligger kvar i telefonen även om du blir utelåst — synken är en kopia,
  inte originalet
- **Inställningar → Din data → Exportera** ger dig en fil som alltid går att
  läsa in igen

Välj ett lösenord du kommer ihåg, och ta en export då och då.

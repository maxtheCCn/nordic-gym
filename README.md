# NW Logg — träningslogg för Nordic Wellness

Mobilanpassad webbapp för att logga gymträning på Nordic Wellness. Du skannar
QR-koden på maskinen, fyller i vikt och reps, trycker spara. Resten sköter
appen.

**Appen innehåller ingen AI.** Den samlar in och strukturerar träningsdata och
kan exportera allt som en färdig textrapport, som du klistrar in i valfri
extern AI för analys.

## Kom igång

```bash
npm install
npm run dev
```

Öppna http://localhost:3000.

För att testa QR-skanning på telefonen krävs https (webbläsare ger inte
kameraåtkomst över http från en annan enhet). Enklast är att deploya — se
nedan — eller köra `npx next dev --experimental-https`.

## Så fungerar den

**Första gången — din Nordic Wellness-runda.** Gå runt på gymmet och skanna
QR-koden på varje maskin du använder. För varje ny kod fyller du i gym,
maskinnamn, muskelgrupp, maskintyp och vilka värden som ska loggas. Det görs
bara en gång per maskin.

**Sedan.** Skanna koden → rätt träningssida öppnas direkt, förifylld med dina
senaste vikter. Ändra med +/- knapparna, tryck **Spara set**.

**Passet.** Ett träningspass startas automatiskt när du sparar ditt första set
och innehåller allt du gör tills du avslutar det. Setnummer och vila mellan
seten räknas ut åt dig.

**Rapporten.** Under Statistik eller Inställningar finns *Skapa
träningsrapport*. Välj period, kopiera texten, klistra in hos din AI.

## Var sparas datan?

Lokalt i webbläsarens IndexedDB. Inget konto, ingen server, ingen kostnad —
och appen fungerar utan täckning i gymmets källare.

Baksidan: rensar du webbläsardata försvinner loggen. Under **Inställningar →
Din data** finns export till JSON-fil och import tillbaka. Importen slår ihop
data i stället för att skriva över, så det går att flytta mellan telefoner.

## Deploya gratis

Appen byggs till statiska filer (`output: "export"`) och behöver ingen server.

```bash
npm run build      # skapar out/
```

Lägg upp `out/` var som helst — Vercel, Netlify, Cloudflare Pages och GitHub
Pages har alla gratisnivåer som räcker mer än väl. Efter deploy kan du lägga
till appen på hemskärmen; den har manifest och körs i helskärm som en vanlig
app.

## Kod

| Fil | Ansvar |
| --- | --- |
| `lib/types.ts` | Datamodellen — maskiner, pass, set, profil |
| `lib/db.ts` | IndexedDB, QR-normalisering, export/import |
| `lib/stats.ts` | Statistik, muskelbalans, viktutveckling, PB |
| `lib/report.ts` | Textrapporten till extern AI |
| `components/Scanner.tsx` | QR-skanning med ZXing |
| `app/machine/page.tsx` | Loggningssidan du använder vid maskinen |

### Om QR-koderna

Koden på maskinen läses som text och normaliseras (`normalizeQr` i
`lib/db.ts`): protokoll, avslutande snedstreck och spårningsparametrar
(`utm_*`) plockas bort. Kvar blir en stabil nyckel som mappas mot maskinen.
Fungerar oavsett vilket format Nordic Wellness använder — även koder som inte
är länkar. Skulle skanningen strula går det att klistra in länken manuellt.

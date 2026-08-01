/**
 * Stämplar bygget med en tidpunkt.
 *
 * Appen körs från hemskärmen på iPhone, där det inte finns någon
 * uppdateringsknapp och ingen dra-för-att-ladda-om. Utan ett versionsnummer
 * går det inte att avgöra om man kör den senaste koden eller en månad gammal
 * cachad version — och det finns inget sätt att göra något åt det.
 *
 * Filen läses av appen vid start och jämförs med versionen den byggdes med.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "public", "version.json");

const buildTime = new Date().toISOString();
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify({ buildTime }, null, 2) + "\n");

console.log(`Byggversion: ${buildTime}`);

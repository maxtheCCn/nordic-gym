/**
 * Bygger för GitHub Pages, där sidan ligger under /<repo> i stället för på
 * roten.
 *
 * Egen skriptfil i stället för `VAR=x next build` i package.json: den syntaxen
 * fungerar inte i PowerShell, och att dra in cross-env bara för en miljövariabel
 * är onödigt. Vanliga `npm run build` påverkas inte och fortsätter bygga för
 * rot-hosting (Vercel, Netlify, egen mapp).
 */
import { execSync } from "node:child_process";

const repo = process.env.PAGES_REPO ?? "nordic-gym";

execSync("next build", {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: `/${repo}` },
});

console.log(`\nByggd för https://<användare>.github.io/${repo}/`);

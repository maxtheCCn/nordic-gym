/**
 * Bygger och publicerar till GitHub Pages.
 *
 * `git subtree push --prefix out` fungerar inte här: out/ ligger i .gitignore
 * och är alltså inte incheckad, och subtree kräver att mappen finns i
 * historiken. I stället görs out/ till ett eget engångsrepo som tvingas upp
 * till gh-pages. Grenen innehåller bara det byggda resultatet — källkoden bor
 * kvar på main.
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "out");
const branch = "gh-pages";

const run = (cmd, cwd = root) =>
  execSync(cmd, { cwd, stdio: "inherit", env: process.env });
const capture = (cmd, cwd = root) =>
  execSync(cmd, { cwd, encoding: "utf8" }).trim();

// Hoppa över bygget med `npm run deploy -- --skip-build` när out/ redan är färsk.
if (!process.argv.includes("--skip-build")) {
  console.log("→ Bygger för GitHub Pages…");
  run("node scripts/build-pages.mjs");
}

if (!existsSync(join(out, "index.html"))) {
  console.error("out/index.html saknas — bygget verkar inte ha gått igenom.");
  process.exit(1);
}

if (!existsSync(join(out, ".nojekyll"))) {
  // Utan den kastar Pages bort hela _next-mappen och sidan blir vit.
  console.error("out/.nojekyll saknas — kontrollera att public/.nojekyll finns.");
  process.exit(1);
}

const remote = capture("git remote get-url origin");
const name = capture("git config user.name") || "NW Logg";
const email = capture("git config user.email") || "noreply@example.com";

console.log(`→ Publicerar out/ till ${branch} på ${remote}`);

// Ett gammalt .git härifrån skulle ta med förra deployens historik.
rmSync(join(out, ".git"), { recursive: true, force: true });

try {
  run(`git init -b ${branch}`, out);
  run(`git config user.name "${name}"`, out);
  run(`git config user.email "${email}"`, out);
  run("git add -A", out);
  run(`git commit -q -m "Publicera statiskt bygge for GitHub Pages"`, out);
  run(`git push -f -q "${remote}" ${branch}`, out);
} finally {
  rmSync(join(out, ".git"), { recursive: true, force: true });
}

const slug = remote.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, "");
const [user, repo] = slug.split("/");
console.log(`\n✓ Publicerat: https://${user.toLowerCase()}.github.io/${repo}/`);
console.log("  Pages tar ungefär en minut på sig att bygga om.");

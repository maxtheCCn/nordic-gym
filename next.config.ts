import type { NextConfig } from "next";

/**
 * På GitHub Pages ligger sidan under /<repo>, inte på roten. Då måste alla
 * länkar och tillgångar prefixas, annars laddas inget. Sätts av byggskriptet
 * (`npm run build:pages`) och lämnas tom vid lokal utveckling och på värdar
 * som serverar från roten, t.ex. Vercel och Netlify.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Statisk export -> kan hostas gratis på Vercel, Netlify, GitHub Pages
  // eller köras direkt från en mapp. Ingen server, ingen databas, ingen kostnad.
  output: "export",
  images: { unoptimized: true },
  basePath: basePath || undefined,
  // Pages serverar /nordic-gym/scan/ som mapp — utan detta blir det 404.
  trailingSlash: true,
};

export default nextConfig;

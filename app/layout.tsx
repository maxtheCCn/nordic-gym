import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { SplashIntro } from "@/components/SplashIntro";
import { UpdateBanner } from "@/components/UpdateBanner";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "NW Logg — träningslogg för Nordic Wellness",
  description:
    "Skanna maskinen, logga vikt och reps, exportera en färdig träningsrapport.",
  // Next prefixar inte metadata med basePath automatiskt.
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NW Logg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  width: "device-width",
  initialScale: 1,
  // Zoom tillåts fortfarande — men sidan startar aldrig inzoomad.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>
        {/* I layouten, så introt spelar vid appstart men inte vid flikbyte. */}
        <SplashIntro />
        <DemoBanner />
        <UpdateBanner />
        <main className="mx-auto min-h-screen w-full max-w-md px-4 pt-5">
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  );
}

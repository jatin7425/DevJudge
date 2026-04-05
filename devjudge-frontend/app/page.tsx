import { DM_Mono, Syne } from "next/font/google";

import { BetaAuthPage } from "@/components/auth/beta-auth-page";
import { OriginalAuthPage } from "@/components/auth/original-auth-page";
import { getAuthExperience } from "@/lib/feature-flags";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export default function Home() {
  const authExperience = getAuthExperience();
  const fontsClassName = `${syne.variable} ${dmMono.variable}`;

  console.log("AUTH_BACKEND_URL:", process.env?.AUTH_BACKEND_URL);
  console.log("NEXT_PUBLIC_AUTH_BACKEND_URL:", process.env?.NEXT_PUBLIC_AUTH_BACKEND_URL);
  return authExperience === "original" ? (
    <OriginalAuthPage fontsClassName={fontsClassName} />
  ) : (
    <BetaAuthPage fontsClassName={fontsClassName} />
  );
}

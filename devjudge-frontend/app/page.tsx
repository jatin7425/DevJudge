import { BetaAuthPage } from "@/components/auth/beta-auth-page";
import { OriginalAuthPage } from "@/components/auth/original-auth-page";
import { getAuthExperience } from "@/lib/feature-flags";

export default function Home() {
  const authExperience = getAuthExperience();

  console.log("AUTH_BACKEND_URL:", process.env?.AUTH_BACKEND_URL);
  console.log("NEXT_PUBLIC_AUTH_BACKEND_URL:", process.env?.NEXT_PUBLIC_AUTH_BACKEND_URL);
  return authExperience === "original" ? (
    <OriginalAuthPage />
  ) : (
    <BetaAuthPage />
  );
}

import { DM_Mono, Syne } from "next/font/google";

import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

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

export default function DashboardPage() {
  return (
    <div className={`${syne.variable} ${dmMono.variable}`}>
      <DashboardScreen />
    </div>
  );
}

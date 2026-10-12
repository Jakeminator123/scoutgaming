import { Header } from "@/components/header";

import { LobbyProvider } from "@/components/lobby-provider";
import { SelectionTicket } from "@/components/selection-ticket";
import { HeroSection } from "@/components/sections/hero-section";
import { OperatorsSection } from "@/components/sections/operators-section";
import { RoomsSection } from "@/components/sections/rooms-section";
import { DealersSection } from "@/components/sections/dealers-section";
import { HowItWorksSection } from "@/components/sections/how-it-works-section";
import { FooterSection } from "@/components/sections/footer-section";

export default function Home() {
  return (
    <LobbyProvider>

      <main className="min-h-screen bg-background">
        <Header />
        <HeroSection />
        <OperatorsSection />
        <RoomsSection />
        <DealersSection />
        <HowItWorksSection />
        <FooterSection />
      </main>
      <SelectionTicket />
    </LobbyProvider>
  );
}

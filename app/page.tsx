import { Header } from "@/components/marketing/header";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Modes } from "@/components/marketing/modes";
import { SampleSession } from "@/components/marketing/sample-session";
import { CTA } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-sm text-primary">
        Speech functionality is coming soon! Sessions will be full voice conversations. For now, sessions are text based.
      </div>
      <Hero />
      <Features />
      <HowItWorks />
      <Modes />
      <SampleSession />
      <CTA />
      <Footer />
    </main>
  );
}

import { Header } from "@/components/marketing/header";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Modes } from "@/components/marketing/modes";
import { SampleSession } from "@/components/marketing/sample-session";
import { ReflectSection } from "@/components/marketing/reflect-section";
import { CTA } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Modes />
      <SampleSession />
      <ReflectSection />
      <CTA />
      <Footer />
    </main>
  );
}

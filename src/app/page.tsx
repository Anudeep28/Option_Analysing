import { PricingForm } from "@/components/pricing-form";
import { Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-5" />
            <h1 className="text-lg font-bold tracking-tight">Option Pricing Simulator</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>European</span>
            <span className="text-border">|</span>
            <span>American</span>
            <span className="text-border">|</span>
            <span>Asian</span>
            <span className="text-border">|</span>
            <span>Barrier</span>
            <span className="text-border">|</span>
            <span>Lookback</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PricingForm />
      </main>

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Option Pricing Simulator &mdash; Educational Use</span>
          <span>NSE/BSE data integration ready</span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { PricingForm } from "@/components/pricing-form";
import { PortfolioManager } from "@/components/portfolio-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-context";
import { Activity, Calculator, BookOpen } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { isSignedIn, username, logout } = useSession();
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-5" />
            <h1 className="text-lg font-bold tracking-tight">Option Pricing Simulator</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/history" className="text-sm text-foreground hover:underline">History</Link>
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
            <div className="pl-2 border-l border-border flex items-center gap-2">
              {isSignedIn ? (
                <>
                  <span className="text-sm text-muted-foreground">{username}</span>
                  <Button variant="outline" size="sm" onClick={() => logout()}>
                    Sign out
                  </Button>
                </>
              ) : (
                <Link href="/sign-in" className="text-sm text-foreground hover:underline">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="pricer" className="space-y-5">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="pricer" className="gap-1.5">
              <Calculator className="size-3.5" />
              Option Pricer
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-1.5">
              <BookOpen className="size-3.5" />
              My Portfolio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pricer">
            <PricingForm />
          </TabsContent>

          <TabsContent value="portfolio">
            <PortfolioManager />
          </TabsContent>
        </Tabs>
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

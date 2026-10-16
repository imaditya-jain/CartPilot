import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Sparkles, MessageSquareText } from "lucide-react";

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight text-foreground">CartPilot AI</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted hover:text-foreground">
            Log in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Your Store&apos;s AI Sales Partner
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Connect your Shopify store, get AI-generated business insights, and give customers an
          intelligent assistant that helps them buy.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg">Connect your store</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">
              Log in
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {[
          {
            icon: ShoppingBag,
            title: "Store analytics",
            description: "Real sales metrics from your synchronized Shopify catalog and orders.",
          },
          {
            icon: Sparkles,
            title: "AI insights",
            description: "Plain-language summaries and suggested actions, grounded in your actual data.",
          },
          {
            icon: MessageSquareText,
            title: "Storefront chatbot",
            description: "An embeddable assistant that helps shoppers find and buy products.",
          },
        ].map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

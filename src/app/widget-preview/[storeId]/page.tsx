import Script from "next/script";

/**
 * A mock storefront page for merchants to test the actual embedded widget exactly as a shopper
 * would see it — loaded via the same public loader.js script a real theme.liquid would use, not
 * via any special test-only code path. Public by design (same trust boundary as /widget itself):
 * no merchant data beyond what the public chatbot config endpoint already exposes.
 */
export default function WidgetPreviewPage({ params }: { params: { storeId: string } }) {
  return (
    <div className="min-h-screen bg-white text-[#1a1917]">
      <header className="flex items-center justify-between border-b border-[#e4e3e0] px-6 py-4">
        <span className="text-lg font-semibold">Example Storefront</span>
        <nav className="flex gap-6 text-sm text-[#6e6d6a]">
          <span>Shop</span>
          <span>About</span>
          <span>Contact</span>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="mb-2 inline-block rounded-full border border-[#e4e3e0] px-3 py-1 text-xs text-[#6e6d6a]">
          Widget test harness
        </p>
        <h1 className="text-3xl font-semibold">This page simulates a real Shopify storefront</h1>
        <p className="mx-auto mt-3 max-w-xl text-[#6e6d6a]">
          The chat widget below is loaded exactly the way it will be on your actual store — via the
          installation snippet from Settings, not a special preview mode. Click the launcher in the
          corner to try it.
        </p>

        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[#e4e3e0] p-3 text-left">
              <div className="aspect-square rounded-md bg-[#f2f1ef]" />
              <p className="mt-2 text-sm font-medium">Sample product {i + 1}</p>
              <p className="text-xs text-[#6e6d6a]">$00.00</p>
            </div>
          ))}
        </div>
      </main>

      <Script src="/chatbot/loader.js" data-store-id={params.storeId} strategy="afterInteractive" />
    </div>
  );
}

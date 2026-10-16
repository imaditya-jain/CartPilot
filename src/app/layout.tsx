import type { Metadata } from "next";
import { StoreProvider } from "@/store/StoreProvider";
import { SessionBootstrap } from "@/components/layout/session-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "CartPilot AI — Your Store's AI Sales Partner",
  description:
    "CartPilot AI connects your Shopify store to an AI-powered sales assistant: analytics, insights, and a configurable storefront chatbot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <StoreProvider>
          <SessionBootstrap />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}

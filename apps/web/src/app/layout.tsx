import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModalProvider } from "@/contexts/ModalContext";
import { GlobalModals } from "@/components/GlobalModals";
import { ToastProvider } from "@x402jobs/ui/toast";
import { WalletProvider } from "@/components/WalletProvider";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import "./globals.css";

// Base font - Inter for body text
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

// Display font - Space Grotesk for titles and wordmarks
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "x402.jobs",
  description: "Chain X402 resources into automated workflows",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "x402.jobs",
  },
  openGraph: {
    title: "x402.jobs",
    description: "Chain X402 resources into automated workflows",
    url: "https://x402.jobs",
    siteName: "x402.jobs",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "x402.jobs - Chain X402 resources into automated workflows",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "x402.jobs",
    description: "Chain X402 resources into automated workflows",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        <MaintenanceGate>
          <AuthProvider>
            <ThemeProvider>
              <WalletProvider>
                <ToastProvider>
                  <ModalProvider>
                    {children}
                    <GlobalModals />
                  </ModalProvider>
                </ToastProvider>
              </WalletProvider>
            </ThemeProvider>
          </AuthProvider>
        </MaintenanceGate>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "ADPILOTIK — Your ads. Smarter. Faster. Automatic.",
  description: "Piattaforma SaaS per gestire ads, funnel, CAPI tracking, CRM e analytics in modo automatico",
};

// Inline script to prevent flash of wrong theme on load
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('sincro_theme');
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

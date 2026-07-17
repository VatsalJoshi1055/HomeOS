import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { PwaRegister } from "@/components/pwa-register"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "HomeOS",
  title: {
    default: "HomeOS — Family Shopping Companion",
    template: "%s · HomeOS",
  },
  description:
    "Real-time collaborative grocery lists for your household. Shop together and stay in sync.",
  keywords: [
    "grocery list",
    "family shopping",
    "household",
    "HomeOS",
    "shared list",
  ],
  authors: [{ name: "HomeOS" }],
  creator: "HomeOS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HomeOS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "HomeOS",
    title: "HomeOS — Family Shopping Companion",
    description:
      "Real-time collaborative grocery lists for your household.",
  },
  twitter: {
    card: "summary",
    title: "HomeOS",
    description: "Family grocery lists that stay in sync.",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f59e0b" },
    { media: "(prefers-color-scheme: dark)", color: "#f59e0b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-svh overflow-x-hidden antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-center" closeButton />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}

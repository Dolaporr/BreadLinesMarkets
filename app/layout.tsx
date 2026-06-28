import type { Metadata, Viewport } from 'next'
import { Montserrat, Raleway, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat"
});
const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway"
});
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

export const metadata: Metadata = {
  title: 'Breadlines | Solana Execution Receipts',
  description: 'Paste a Solana transaction. Understand what happened. Execution receipts with observed facts first, estimated pressure, and conceptual market-structure context.',
  generator: 'Breadlines',
  keywords: ['Solana', 'execution receipts', 'transaction analysis', 'observability', 'MCP', 'FCFS', 'blockchain'],
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${montserrat.variable} ${raleway.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

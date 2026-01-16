import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Search 2.0 - Test Chat UI',
  description: 'Simple chat interface for testing AI Search 2.0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


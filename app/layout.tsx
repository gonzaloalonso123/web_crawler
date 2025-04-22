import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GOLLUM - Web crawler',
  description: 'Web crawler for extracting text and images from websites',
  generator: 'gonzalo',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

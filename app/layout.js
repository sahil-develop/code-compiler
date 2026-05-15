import './globals.css';

const BASE = process.env.PUBLIC_URL || 'https://coderunner.vercel.app';

export const metadata = {
  metadataBase: new URL(BASE),
  title: 'CodeRunner — Online IDE for JavaScript, TypeScript & Python',
  description: 'Run JavaScript, TypeScript, and Python instantly in your browser. A fast, beautiful online code runner with Monaco editor, syntax highlighting, and snippet management.',
  keywords: 'online code runner, javascript playground, typescript playground, python online, code editor, online IDE, monaco editor, run code online, DSA practice, algorithms, coding environment',
  authors: [{ name: 'CodeRunner' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    title: 'CodeRunner — Online IDE for JavaScript, TypeScript & Python',
    description: 'Run JavaScript, TypeScript, and Python instantly in your browser. Beautiful Monaco editor, syntax highlighting, and snippet management.',
    siteName: 'CodeRunner',
    images: [{ url: '/logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeRunner — Online IDE for JavaScript, TypeScript & Python',
    description: 'Run JavaScript, TypeScript, and Python instantly in your browser.',
    images: ['/logo.png'],
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#15141b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'CodeRunner',
              description: 'Run JavaScript, TypeScript, and Python code instantly in your browser.',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              browserRequirements: 'Requires JavaScript',
              image: '/logo.png',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            }),
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3299592186926809"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

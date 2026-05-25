import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'SAM Gateway — Multi-Provider OAuth API Gateway',
  description: 'OpenAI-compatible API gateway with OAuth support for Google Gemini, Kiro, and more',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ margin: 0, padding: 0, background: '#0f0c29' }}>
        {children}
      </body>
    </html>
  );
}

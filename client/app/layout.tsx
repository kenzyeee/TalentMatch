import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TalentMatch — Find work that fits',
  description: 'A recruitment platform that connects candidates and employers through semantic resume matching.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

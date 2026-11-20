import { AuthProvider } from '../lib/auth';
import './globals.css';

export const metadata = { title: 'Rayat Bahra University', description: 'University learning portal' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>; }

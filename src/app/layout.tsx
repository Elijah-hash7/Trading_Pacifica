import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ClientProviders from "./ClientProvider";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pacificast",
  description: "Perpetual DEX ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white flex justify-center`}>
        <ClientProviders>
          <div className="w-full max-w-lg min-h-screen">
            {children}
          </div>
          <BottomNav />
        </ClientProviders>
      </body>
    </html>
  );
}

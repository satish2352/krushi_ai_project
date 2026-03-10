import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Krishi AI – Intelligent Farming Assistant",
  description: "Conversational farming decision support system powered by ML and LLM."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}


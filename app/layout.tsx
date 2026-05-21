import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Vibe Café - Cloud in your Coffee",
  description: "Generate AI coffee foam art with Gemini 3.1 Flash",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}

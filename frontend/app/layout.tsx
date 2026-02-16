import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "ExamGuide — Smart Exam Preparation",
  description:
    "AI-powered study guide generator from your syllabus, notes and past papers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
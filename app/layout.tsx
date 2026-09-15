import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "문서 보관함 | 시험 대비 요약 & 퀴즈",
  description: "강의자료를 업로드하여 시험 대비 요약과 퀴즈를 보관하고 학습하는 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-[#0c0d11] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const zedDisplay = localFont({
  src: [
    {
      path: "../../public/fonts/Zed Display Light.ttf",
      weight: "100 399",
      style: "normal",
    },
    {
      path: "../../public/fonts/Zed Display Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Zed Display Medium.ttf",
      weight: "500 900",
      style: "normal",
    },
  ],
  variable: "--font-zed",
  display: "swap",
});

const mobilo = localFont({
  src: [
    {
      path: "../../public/fonts/Mobilo-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Mobilo-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-mobilo",
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TormiSketch",
  description: "A playful browser-based drawing canvas by Tormius.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${zedDisplay.variable} ${mobilo.variable}`}>
      <body>{children}</body>
    </html>
  );
}

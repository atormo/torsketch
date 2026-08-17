import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceGrotesk = localFont({
  src: "../fonts/SpaceGrotesk-Variable.ttf",
  weight: "300 700",
  style: "normal",
  variable: "--font-interface",
  display: "swap",
});

const michroma = localFont({
  src: "../fonts/Michroma-Regular.ttf",
  weight: "400",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TormiSketch",
  description: "A mechanical two-dial drawing toy for the browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${michroma.variable}`}>
      <body>{children}</body>
    </html>
  );
}

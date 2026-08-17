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

const archivoBlack = localFont({
  src: "../fonts/ArchivoBlack-Regular.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://torsketch.tormo.at"),
  title: "TorSketch",
  description: "A mechanical two-dial drawing toy for the browser.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "TorSketch",
    description: "A mechanical two-dial drawing toy for the browser.",
    url: "/",
    siteName: "TorSketch",
    type: "website",
    images: ["/torsketch-hills.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "TorSketch",
    description: "A mechanical two-dial drawing toy for the browser.",
    images: ["/torsketch-hills.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${archivoBlack.variable}`}>
      <body>{children}</body>
    </html>
  );
}

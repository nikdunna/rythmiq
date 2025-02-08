import type { Metadata } from "next";
import { Monoton, Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-noto-sans",
});

const monoton = Monoton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-monoton",
});

export const metadata: Metadata = {
  title: "Rythmiq",
  description: "Your music companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${notoSans.className} antialiased`}
      >
        <header className="fixed top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-sm flex items-center px-6 z-50">
          {/* <h1
            className={`${monoton.className} text-2xl text-white`}
          >
            Rythmiq
          </h1> */}
        </header>
        <main className="">{children}</main>
        {/* <footer className=" bottom-0 left-0 right-0 h-16 bg-orange-web backdrop-blur-sm flex items-center justify-center px-6">
          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} Rythmiq
          </p>
        </footer> */}
      </body>
    </html>
  );
}

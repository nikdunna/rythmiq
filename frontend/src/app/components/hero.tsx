import "../globals.css";
import { Monoton, Noto_Sans } from "next/font/google";

const monoton = Monoton({
  weight: "400",
  subsets: ["latin"],
});

const notoSans = Noto_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-noto-sans",
});

export default function Hero() {
  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Retro gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-burgundy via-syracuse-red-orange to-orange-web opacity-20"></div>

      {/* Retro grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_1px,_transparent_1px),_linear-gradient(90deg,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]"></div>

      {/* Main content */}
      <div className="flex flex-col z-10">
        <div className="flex items-center justify-center">
          <h2
            className={`${notoSans.className} text-2xl md:text-3xl text-white`}
          >
            Your music companion
          </h2>
        </div>
        <div className="relative z-10 text-center">
          <h1
            className={`${monoton.className} text-8xl md:text-9xl text-white mb-6 tracking-wider animate-glow`}
          >
            rythmiq
          </h1>
          <div className="flex gap-4 justify-center">
            <div className="h-2 w-24 bg-jungle-green rounded-full animate-pulse"></div>
            <div className="h-2 w-24 bg-celadon rounded-full animate-pulse delay-75"></div>
            <div className="h-2 w-24 bg-orange-web rounded-full animate-pulse delay-150"></div>
          </div>
        </div>
      </div>

      {/* Retro shine effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
    </div>
  );
}

"use client";
import "../globals.css";
import { Monoton, Noto_Sans } from "next/font/google";

interface StudioProps {
  show: boolean;
}

export default function Studio({ show }: StudioProps) {
  if (!show) return null;

  return (
    <div className="fade-in relative h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Placeholder content for the studio */}
      <div className="text-white text-2xl">Studio Content Coming Soon...</div>
    </div>
  );
}

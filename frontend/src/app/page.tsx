"use client";
import Hero from "./components/hero";
import Studio from "./components/studio";
import { useState } from "react";
import dynamic from "next/dynamic";

const Generator = dynamic(() => import("./components/generator"), { ssr: false });

export default function Home() {
  const [showStudio, setShowStudio] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const handleEnterStudio = () => {
    setShowStudio(true);
  };

  const handleAudioComplete = (audioUrl: string) => {
    setRecordedAudioUrl(audioUrl);
    setShowStudio(false);
    setShowGenerator(true);
    console.log("Audio recording completed:", audioUrl);
  };

  return (
    <div className="bg-black h-screen">
      <Hero onEnterStudio={handleEnterStudio} />
      <Studio show={showStudio} onAudioComplete={handleAudioComplete} />
      <Generator audioURL={recordedAudioUrl} show={showGenerator} />
    </div>
  );
}

"use client";
// import Hero from "./components/hero";
// import Studio from "./components/studio";
import { useState, useEffect } from "react";
// import dynamic from "next/dynamic";
import Hero from "./components/hero";

import { Studio, Generator, Wrap } from "./components/gen";

const Generator = dynamic(() => import("./components/generator"), {
  ssr: false,
});

export default function Home() {
  const [showStudio, setShowStudio] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showWrap, setShowWrap] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [drumSequence, setDrumSequence] = useState<any | null>(null);
  const [inputSequence, setInputSequence] = useState<any | null>(null);

  const handleEnterStudio = () => {
    setShowStudio(true);
  };

  const handleAudioComplete = (audioUrl: string) => {
    setRecordedAudioUrl(audioUrl);
    setShowStudio(false);
    setShowGenerator(true);
  };

  const handleGeneratorClose = ({
    drumSequence,
    inputSequence,
  }: {
    drumSequence: any | null;
    inputSequence: any | null;
  }) => {
    // Store sequences
    setDrumSequence(drumSequence);
    setInputSequence(inputSequence);

    // Start transition
    setShowGenerator(false);

    // Wait for generator to fade out and unmount before showing wrap
    setTimeout(() => {
      setShowWrap(true);
    }, 500); // Match this with your fade-out animation duration
  };

  return (
    <div className="bg-black h-screen">
      <Hero onEnterStudio={handleEnterStudio} />
      <Studio show={showStudio} onAudioComplete={handleAudioComplete} />
      <Generator
        audioURL={recordedAudioUrl}
        show={showGenerator}
        onClose={handleGeneratorClose}
      />
      {showWrap && (
        <Wrap
          drumSequence={drumSequence}
          inputSequence={inputSequence}
          show={showWrap}
        />
      )}
    </div>
  );
}

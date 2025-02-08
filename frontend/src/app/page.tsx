"use client";
import Hero from "./components/hero";
import Studio from "./components/studio";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Wrap from "./components/wrap";

const Generator = dynamic(() => import("./components/generator"), {
  ssr: false,
});

export default function Home() {
  const [page, setPage] = useState<string>("hero");

  const [showStudio, setShowStudio] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showWrap, setShowWrap] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [drumSequence, setDrumSequence] = useState<any | null>(null);
  const [inputSequence, setInputSequence] = useState<any | null>(null);

  const handleEnterStudio = () => {
    setShowStudio(true);
    nextPage();
  };

  const nextPage = () => {
    const newPage =
      page === "hero"
        ? "studio"
        : page === "studio"
        ? "generator"
        : page === "generator"
        ? "wrap"
        : "hero";
    setPage(newPage);
    if (newPage === "hero") {
      setShowStudio(false);
      setShowGenerator(false);
      setShowWrap(false);
    }
    if (newPage === "studio") {
      setShowStudio(true);
      setShowGenerator(false);
      setShowWrap(false);
    }
    if (newPage === "generator") {
      setShowStudio(false);
      setShowGenerator(true);
      setShowWrap(false);
    }
    if (newPage === "wrap") {
      setShowStudio(false);
      setShowGenerator(false);
      setShowWrap(true);
    }
  };

  const backPage = () => {
    const newPage =
      page === "studio"
        ? "hero"
        : page === "generator"
        ? "studio"
        : page === "wrap"
        ? "generator"
        : "hero";
    setPage(newPage);
    if (newPage === "hero") {
      setShowStudio(false);
      setShowGenerator(false);
      setShowWrap(false);
    }
    if (newPage === "studio") {
      setShowStudio(true);
      setShowGenerator(false);
      setShowWrap(false);
    }
    if (newPage === "generator") {
      setShowStudio(false);
      setShowGenerator(true);
      setShowWrap(false);
    }
  };

  const handleAudioComplete = (audioUrl: string) => {
    setRecordedAudioUrl(audioUrl);
    nextPage();
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
    nextPage();

    // Wait for generator to fade out and unmount before showing wrap
    setTimeout(() => {
      nextPage();
    }, 500); // Match this with your fade-out animation duration
  };

  return (
    <div className="bg-black h-screen">
      {page === "hero" && (
        <Hero onEnterStudio={handleEnterStudio} show={page === "hero"} />
      )}
      {page === "studio" && (
        <Studio
          show={page === "studio"}
          onAudioComplete={handleAudioComplete}
          onBack={backPage}
          onNext={nextPage}
        />
      )}
      {page === "generator" && (
        <Generator
          audioURL={recordedAudioUrl}
          show={page === "generator"}
          onClose={handleGeneratorClose}
          onBack={backPage}
          onNext={nextPage}
        />
      )}
      {page === "wrap" && (
        <Wrap
          drumSequence={drumSequence}
          inputSequence={inputSequence}
          show={page === "wrap"}
          onBack={backPage}
        />
      )}
    </div>
  );
}

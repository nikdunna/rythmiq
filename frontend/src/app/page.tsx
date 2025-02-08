"use client";
import Hero from "./components/hero";
import Studio from "./components/studio";
import { useState } from "react";

export default function Home() {
  const [showStudio, setShowStudio] = useState(false);

  const handleEnterStudio = () => {
    setShowStudio(true);
  };

  return (
    <div className="bg-black h-screen">
      <Hero onEnterStudio={handleEnterStudio} />
      <Studio show={showStudio} />
    </div>
  );
}

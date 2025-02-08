"use client";
import Hero from "./components/hero";
import Studio from "./components/studio";
import { useState } from "react";
import { pinata } from "@/app/utils/config";
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

  const [file, setFile] = useState<File>();
	const [url, setUrl] = useState("");
	const [uploading, setUploading] = useState(false);

	const uploadFile = async () => {
		if (!file) {
			alert("No file selected");
			return;
		}

		try {
			setUploading(true);
			const keyRequest = await fetch("/api/key");
			const keyData = await keyRequest.json();
			const upload = await pinata.upload.file(file).key(keyData.JWT);
			const ipfsUrl = await pinata.gateways.convert(upload.IpfsHash)
			setUrl(ipfsUrl);
			setUploading(false);
		} catch (e) {
			console.log(e);
			setUploading(false);
			alert("Trouble uploading file");
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFile(e.target?.files?.[0]);
	};


  return (
    <div className="bg-black h-screen">
      <Hero onEnterStudio={handleEnterStudio} />
      <Studio show={showStudio} onAudioComplete={handleAudioComplete} />
      <Generator audioURL={recordedAudioUrl} show={showGenerator} />
      
      <input type="file" onChange={handleChange} />
			<button type="button" disabled={uploading} onClick={uploadFile}>
				{uploading ? "Uploading..." : "Upload"}
			</button>
			{url && <img src={url} alt="Image from Pinata" />}

    </div>
  );
}

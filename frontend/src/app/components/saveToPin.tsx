'use client'
import fs from "fs";
import axios from "axios";
import path from "path";
import formidable from "formidable";
import { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: { bodyParser: false }, // Disable default Next.js body parsing
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // Create a Formidable instance correctly
  const form = formidable({ 
    uploadDir: "/tmp", 
    filename: (name, ext, part) => `${Date.now()}_${part.originalFilename}`
  });

  try {
    const [fields, files] = await form.parse(req);

    // Ensure file exists
    if (!files.file || !files.file[0]?.filepath) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = files.file[0].filepath;
    const fileStream = fs.createReadStream(filePath);

    // Upload file to Pinata
    const pinataResponse = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      fileStream,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${process.env.PINATA_JWT}`, // Your Pinata API Key
        },
      }
    );

    const ipfsHash = pinataResponse.data.IpfsHash;
    console.log("IPFS Upload Success:", ipfsHash);

    // Cleanup temp file
    fs.unlinkSync(filePath);

    res.json({ success: true, ipfsHash });
  } catch (error) {
    // Explicitly cast `error` as `Error`
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("File Upload Error:", errMessage);

    res.status(500).json({ error: "IPFS Upload Failed", details: errMessage });
  }
}
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import axios from "axios";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false, // Handle file uploads manually
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = "/tmp"; // Temporary storage
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File Parsing Error" });

    try {
      const originalAudio = files.original[0].filepath;
      const bassAudio = files.bass[0].filepath;
      const drumsAudio = files.drums[0].filepath;
      const outputFilePath = path.join("/tmp", "final_mix.mp3");

      // Run FFmpeg to mix the three audio files
      const command = `ffmpeg -i ${originalAudio} -i ${bassAudio} -i ${drumsAudio} -filter_complex "[0:a][1:a][2:a]amix=inputs=3:duration=longest:dropout_transition=3" -c:a libmp3lame ${outputFilePath}`;

      exec(command, async (error, stdout, stderr) => {
        if (error) {
          console.error("FFmpeg error:", stderr);
          return res.status(500).json({ error: "Audio Mixing Failed" });
        }

        // Upload mixed audio to Pinata
        const fileStream = fs.createReadStream(outputFilePath);
        const pinataResponse = await axios.post(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          fileStream,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${process.env.PINATA_JWT}`,
            },
          }
        );

        // Cleanup local files
        fs.unlinkSync(originalAudio);
        fs.unlinkSync(bassAudio);
        fs.unlinkSync(drumsAudio);
        fs.unlinkSync(outputFilePath);

        res.json({ ipfsHash: pinataResponse.data.IpfsHash });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Mixing or Uploading Failed" });
    }
  });
}

const TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/;

function normalizeTimestamp(value, cueNumber) {
  const match = value.trim().match(TIMESTAMP);
  if (!match) throw new Error(`Invalid SRT timestamp near cue ${cueNumber}.`);
  const [, hours, minutes, seconds, millis] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) {
    throw new Error(`Invalid SRT timestamp near cue ${cueNumber}.`);
  }
  return `${hours.padStart(2, "0")}:${minutes}:${seconds}.${millis}`;
}

export function convertSrtToVtt(source) {
  const text = String(source || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!text) throw new Error("The subtitle file is empty.");
  const blocks = text.split(/\n{2,}/);
  const cues = blocks.map((block, index) => {
    const lines = block.split("\n");
    if (/^\d+$/.test(lines[0]?.trim())) lines.shift();
    const timing = lines.shift();
    const parts = timing?.split(/\s+-->\s+/);
    if (parts?.length !== 2 || !lines.join("").trim()) {
      throw new Error(`Invalid SRT cue ${index + 1}.`);
    }
    return `${normalizeTimestamp(parts[0], index + 1)} --> ${normalizeTimestamp(parts[1].split(/\s/)[0], index + 1)}\n${lines.join("\n")}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export async function subtitleFileToVtt(file) {
  const name = String(file?.name || "").toLowerCase();
  if (!name.endsWith(".srt") && !name.endsWith(".vtt")) {
    throw new Error("Select an SRT or VTT subtitle file.");
  }
  let text;
  try {
    text = await file.text();
  } catch {
    throw new Error("The subtitle encoding could not be read.");
  }
  if (!text.trim()) throw new Error("The subtitle file is empty.");
  if (name.endsWith(".srt")) text = convertSrtToVtt(text);
  if (!/^WEBVTT(?:\s|$)/.test(text.replace(/^\uFEFF/, ""))) {
    throw new Error("The VTT subtitle file is invalid.");
  }
  if (!/\d{1,2}:\d{2}(?::\d{2})?\.\d{3}\s+-->\s+\d{1,2}:\d{2}(?::\d{2})?\.\d{3}/.test(text)) {
    throw new Error("The subtitle file contains no valid timed cues.");
  }
  return { text, language: file.name.replace(/\.(srt|vtt)$/i, ""), fileName: file.name };
}

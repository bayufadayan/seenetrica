export function readVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationSeconds = Number(video.duration);
      cleanup();
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) reject(new Error(`${file.name} has invalid video metadata.`));
      else resolve({ durationSeconds, mimeType: file.type || "video/mp4" });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error(`${file.name} cannot be played by this browser.`));
    };
    video.src = url;
  });
}

import { SUPPORTED_LOCAL_VIDEO_EXTENSIONS } from "../constants/player.constants";
import { readVideoMetadata } from "../utils/media-duration.util";

const runtimeFiles = new Map();

function extension(name) {
  const lower = String(name).toLowerCase();
  return SUPPORTED_LOCAL_VIDEO_EXTENSIONS.find((value) => lower.endsWith(value));
}

function canTryVideo(file) {
  if (!extension(file.name)) return false;
  if (!file.type) return true;
  const video = document.createElement("video");
  return video.canPlayType(file.type) !== "";
}

async function fileMetadata(file, relativePath) {
  if (!canTryVideo(file)) throw new Error(`${file.name} uses an unsupported video format or codec.`);
  const metadata = await readVideoMetadata(file);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    relativePath: relativePath || file.webkitRelativePath || file.name,
    mimeType: metadata.mimeType,
    size: file.size,
    lastModified: file.lastModified,
    durationSeconds: metadata.durationSeconds,
  };
}

async function scanHandle(directoryHandle, prefix = "") {
  const files = [];
  const errors = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      const nested = await scanHandle(handle, path);
      files.push(...nested.files);
      errors.push(...nested.errors);
    } else if (extension(name)) {
      try {
        files.push(await fileMetadata(await handle.getFile(), path));
      } catch (error) {
        errors.push({ path, message: error.message });
      }
    }
  }
  return { files, errors };
}

function chooseFallbackFiles({ directory = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*,.mov,.m4v";
    input.multiple = directory;
    if (directory) input.setAttribute("webkitdirectory", "");
    input.onchange = () => resolve(Array.from(input.files || []));
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}

export const localMediaService = {
  supportsDirectoryPicker: typeof window !== "undefined" && "showDirectoryPicker" in window,
  supportsFilePicker: typeof window !== "undefined" && "showOpenFilePicker" in window,

  async connectAdsFolder() {
    if (!("showDirectoryPicker" in window)) return this.connectFallbackFolder();
    const directoryHandle = await window.showDirectoryPicker({ mode: "read" });
    const result = await scanHandle(directoryHandle);
    return {
      id: "local-ads",
      directoryName: directoryHandle.name,
      directoryHandle,
      permissionState: "granted",
      scannedAt: new Date().toISOString(),
      files: result.files,
      errors: result.errors,
      fallback: false,
    };
  },

  async connectFallbackFolder() {
    const selected = await chooseFallbackFiles({ directory: true });
    if (!selected.length) throw new Error("No advertisement folder was selected.");
    const files = [];
    const errors = [];
    for (const file of selected) {
      if (!extension(file.name)) continue;
      try {
        const metadata = await fileMetadata(file);
        files.push(metadata);
        runtimeFiles.set(`ad:${metadata.id}`, file);
      } catch (error) {
        errors.push({ path: file.webkitRelativePath || file.name, message: error.message });
      }
    }
    return {
      id: "local-ads",
      directoryName: selected[0]?.webkitRelativePath?.split("/")[0] || "Selected ads",
      directoryHandle: null,
      permissionState: "session-only",
      scannedAt: new Date().toISOString(),
      files,
      errors,
      fallback: true,
    };
  },

  async checkPermission(source) {
    if (!source?.directoryHandle?.queryPermission) return source?.fallback ? "session-only" : "prompt";
    return source.directoryHandle.queryPermission({ mode: "read" });
  },

  async reconnect(source) {
    if (!source?.directoryHandle?.requestPermission) return this.connectAdsFolder();
    const permissionState = await source.directoryHandle.requestPermission({ mode: "read" });
    if (permissionState !== "granted") throw new Error("Folder access was not granted.");
    return { ...source, permissionState };
  },

  async rescan(source) {
    if (!source?.directoryHandle) return this.connectFallbackFolder();
    const permission = await this.checkPermission(source);
    if (permission !== "granted") throw new Error("Reconnect the advertisements folder before scanning it.");
    const result = await scanHandle(source.directoryHandle);
    return {
      ...source,
      permissionState: permission,
      scannedAt: new Date().toISOString(),
      files: result.files,
      errors: result.errors,
    };
  },

  async resolveAdFile(source, item) {
    const sourceId = item.sourceId || String(item.id).replace(/^local:/, "");
    const runtime = runtimeFiles.get(`ad:${sourceId}`);
    if (runtime) return runtime;
    if (!source?.directoryHandle) throw new Error("Select the advertisement folder again.");
    let current = source.directoryHandle;
    const parts = item.relativePath.split("/");
    for (let index = 0; index < parts.length - 1; index += 1) current = await current.getDirectoryHandle(parts[index]);
    return (await current.getFileHandle(parts.at(-1))).getFile();
  },

  async selectMovieFile() {
    let file;
    let handle = null;
    if ("showOpenFilePicker" in window) {
      [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "Video files", accept: { "video/*": [".mp4", ".webm", ".ogg", ".mov", ".m4v"] } }],
      });
      file = await handle.getFile();
    } else {
      [file] = await chooseFallbackFiles();
    }
    if (!file) throw new Error("No movie file was selected.");
    const metadata = await fileMetadata(file, file.name);
    return { file, handle, metadata, recoverable: Boolean(handle) };
  },

  registerSessionFile(sessionId, file) {
    runtimeFiles.set(`movie:${sessionId}`, file);
  },

  forgetSessionFile(sessionId) {
    runtimeFiles.delete(`movie:${sessionId}`);
  },

  async getSessionFile(session) {
    const runtime = runtimeFiles.get(`movie:${session.id}`);
    if (runtime) return runtime;
    if (session.movieFileHandle?.queryPermission) {
      const permission = await session.movieFileHandle.queryPermission({ mode: "read" });
      if (permission === "granted") return session.movieFileHandle.getFile();
    }
    return null;
  },

  async reselectSessionFile(session) {
    const selected = await this.selectMovieFile();
    const file = selected.file;
    if (
      file.name !== session.movieFileName ||
      file.size !== session.movieFileSize ||
      file.lastModified !== session.movieFileLastModified
    ) {
      throw new Error("The selected file does not match the original session file.");
    }
    this.registerSessionFile(session.id, file);
    return file;
  },

  async recoverSessionFile(session) {
    if (session.movieFileHandle?.requestPermission) {
      const permission = await session.movieFileHandle.requestPermission({ mode: "read" });
      if (permission === "granted") {
        const file = await session.movieFileHandle.getFile();
        if (file.name !== session.movieFileName || file.size !== session.movieFileSize || file.lastModified !== session.movieFileLastModified) {
          throw new Error("The saved movie handle no longer matches this session.");
        }
        this.registerSessionFile(session.id, file);
        return file;
      }
    }
    return this.reselectSessionFile(session);
  },
};

(() => {
  const MAX_FILES = 10;
  const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
  const MAX_LONG_EDGE = 3200;
  const OUTPUT_QUALITY = 0.9;
  const IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  const VIDEO_TYPES = new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
  ]);

  const ACCEPTED_TYPES = new Set([
    ...IMAGE_TYPES,
    ...VIDEO_TYPES,
  ]);

  const MEMORY_TYPES = [
    ["photo", "Photo"],
    ["ticket", "Ticket"],
    ["poster", "Poster"],
    ["screenshot", "Screenshot"],
    ["other", "Other"],
  ];

  const {
    authenticatedPost,
    escapeHtml,
    writeData,
  } = window.Seenetrica;

  function createClientId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `memory-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function guessMemoryType(file) {
    const name = String(file?.name || "").toLowerCase();

    if (VIDEO_TYPES.has(file?.type)) {
      return "other";
    }

    if (/ticket|tiket|receipt|struk/.test(name)) {
      return "ticket";
    }

    if (/poster/.test(name)) {
      return "poster";
    }

    if (/screenshot|screen.?shot|capture/.test(name)) {
      return "screenshot";
    }

    return "photo";
  }

  function mediaResourceType(value) {
    const type = typeof value === "string"
      ? value
      : String(value?.type || value?.image_url || "");

    return VIDEO_TYPES.has(type) || /\/video\/upload\//i.test(type)
      ? "video"
      : "image";
  }

  function isVideoMemory(value) {
    return mediaResourceType(value) === "video";
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function cloudinaryImageUrl(url, options = {}) {
    const source = String(url || "");
    const marker = "/image/upload/";

    if (!source.includes(marker)) {
      return source;
    }

    const transformations = [
      "f_auto",
      options.quality || "q_auto:good",
    ];

    if (options.width) {
      transformations.push(`w_${Math.round(options.width)}`);
    }

    if (options.height) {
      transformations.push(`h_${Math.round(options.height)}`);
    }

    if (options.crop) {
      transformations.push(`c_${options.crop}`);
    } else if (options.width || options.height) {
      transformations.push("c_limit");
    }

    if (options.gravity) {
      transformations.push(`g_${options.gravity}`);
    }

    return source.replace(
      marker,
      `${marker}${transformations.join(",")}/`,
    );
  }

  function cloudinaryVideoPosterUrl(url, options = {}) {
    const source = String(url || "");
    const marker = "/video/upload/";

    if (!source.includes(marker)) {
      return "";
    }

    const transformations = [
      "so_0",
      "f_jpg",
      options.quality || "q_auto:good",
    ];

    if (options.width) {
      transformations.push(`w_${Math.round(options.width)}`);
    }

    if (options.height) {
      transformations.push(`h_${Math.round(options.height)}`);
    }

    if (options.crop) {
      transformations.push(`c_${options.crop}`);
    } else if (options.width || options.height) {
      transformations.push("c_limit");
    }

    if (options.gravity) {
      transformations.push(`g_${options.gravity}`);
    }

    const transformed = source.replace(
      marker,
      `${marker}${transformations.join(",")}/`,
    );

    const [path, query = ""] = transformed.split("?");
    const posterPath = path.replace(/\.[^/.]+$/, ".jpg");

    return query ? `${posterPath}?${query}` : posterPath;
  }

  async function loadImageSource(file) {
    if (window.createImageBitmap) {
      try {
        const bitmap = await window.createImageBitmap(file, {
          imageOrientation: "from-image",
        });

        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          dispose: () => bitmap.close(),
        };
      } catch {
        const bitmap = await window.createImageBitmap(file);

        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          dispose: () => bitmap.close(),
        };
      }
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The selected image could not be opened."));
        image.src = objectUrl;
      });

      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(objectUrl),
      };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("The browser could not prepare this image."));
          }
        },
        type,
        quality,
      );
    });
  }

  async function prepareImageFile(file) {
    if (!IMAGE_TYPES.has(file.type)) {
      throw new Error("Use a JPEG, PNG, or WebP image.");
    }

    if (file.size > MAX_SOURCE_BYTES) {
      throw new Error("Each source image must be 15 MB or smaller.");
    }

    const loaded = await loadImageSource(file);

    try {
      const scale = Math.min(
        1,
        MAX_LONG_EDGE / Math.max(loaded.width, loaded.height),
      );

      const width = Math.max(1, Math.round(loaded.width * scale));
      const height = Math.max(1, Math.round(loaded.height * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", {
        alpha: false,
      });

      if (!context) {
        throw new Error("Image processing is not available in this browser.");
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(loaded.source, 0, 0, width, height);

      let blob;
      let extension;

      try {
        blob = await canvasToBlob(canvas, "image/webp", OUTPUT_QUALITY);
        extension = "webp";
      } catch {
        blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
        extension = "jpg";
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "memory";

      return new File(
        [blob],
        `${baseName}.${extension}`,
        {
          type: blob.type,
          lastModified: Date.now(),
        },
      );
    } finally {
      loaded.dispose();
    }
  }

  async function requestUploadSignature(movieId, pin, resourceType) {
    return authenticatedPost(
      "/api/memories/sign-upload",
      {
        movie_id: movieId,
        resource_type: resourceType,
      },
      pin,
    );
  }

  async function uploadToCloudinary(file, signedUpload) {
    const form = new FormData();

    form.append("file", file);
    form.append("api_key", signedUpload.api_key);
    form.append("timestamp", String(signedUpload.timestamp));
    form.append("signature", signedUpload.signature);
    if (signedUpload.folder) {
      form.append("folder", signedUpload.folder);
    }

    form.append("public_id", signedUpload.public_id);
    form.append("overwrite", signedUpload.overwrite);

    const response = await fetch(signedUpload.upload_url, {
      method: "POST",
      body: form,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.secure_url || !result.public_id) {
      throw new Error(
        result.error?.message || "Cloudinary could not upload the media.",
      );
    }

    return result;
  }

  async function cleanupUploadedAsset(publicId, resourceType, pin) {
    return authenticatedPost(
      "/api/memories/cleanup",
      {
        public_id: publicId,
        resource_type: resourceType,
      },
      pin,
    );
  }

  async function prepareMediaFile(file) {
    return IMAGE_TYPES.has(file.type)
      ? prepareImageFile(file)
      : file;
  }

  async function uploadMemoryDraft(draft, movieId, pin, sortOrder = 0) {
    const resourceType = mediaResourceType(draft.file);
    const preparedFile = await prepareMediaFile(draft.file);
    const signedUpload = await requestUploadSignature(
      movieId,
      pin,
      resourceType,
    );
    const upload = await uploadToCloudinary(preparedFile, signedUpload);

    try {
      const saved = await writeData(
        "createMemory",
        {
          memory: {
            movie_id: movieId,
            public_id: upload.public_id,
            image_url: upload.secure_url,
            caption: draft.caption || null,
            memory_type: draft.memory_type || "photo",
            memory_date: draft.memory_date || null,
            width: upload.width || null,
            height: upload.height || null,
            bytes: upload.bytes || preparedFile.size,
            sort_order: sortOrder,
          },
        },
        pin,
      );

      return saved.memory;
    } catch (error) {
      await cleanupUploadedAsset(upload.public_id, resourceType, pin).catch((cleanupError) => {
        console.error("Could not clean up an unlinked Cloudinary asset:", cleanupError);
      });

      throw error;
    }
  }

  class MemoryComposer {
    constructor({ input, list, status, maxFiles = MAX_FILES }) {
      this.input = input;
      this.list = list;
      this.status = status;
      this.maxFiles = maxFiles;
      this.drafts = [];
      this.disabled = false;

      this.input?.addEventListener("change", () => {
        this.addFiles(this.input.files);
        this.input.value = "";
      });

      this.list?.addEventListener("input", (event) => {
        const field = event.target.closest("[data-memory-field]");
        const card = event.target.closest("[data-memory-draft-id]");

        if (!field || !card) {
          return;
        }

        const draft = this.drafts.find(
          (item) => item.client_id === card.dataset.memoryDraftId,
        );

        if (draft) {
          draft[field.dataset.memoryField] = field.value;
        }
      });

      this.list?.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove-memory-draft]");

        if (!removeButton || this.disabled) {
          return;
        }

        this.removeDraft(removeButton.dataset.removeMemoryDraft);
      });

      this.render();
    }

    addFiles(fileList) {
      const files = Array.from(fileList || []);

      if (!files.length) {
        return;
      }

      const available = Math.max(0, this.maxFiles - this.drafts.length);
      const accepted = [];
      const errors = [];

      files.slice(0, available).forEach((file) => {
        if (!ACCEPTED_TYPES.has(file.type)) {
          errors.push(`${file.name}: use JPEG, PNG, WebP, MP4, WebM, MOV, or M4V.`);
          return;
        }

        if (file.size > MAX_SOURCE_BYTES) {
          errors.push(`${file.name}: larger than 15 MB.`);
          return;
        }

        accepted.push({
          client_id: createClientId(),
          file,
          preview_url: URL.createObjectURL(file),
          caption: "",
          memory_type: guessMemoryType(file),
          memory_date: "",
          status: "idle",
          status_message: isVideoMemory(file) ? "Video ready" : "Photo ready",
        });
      });

      if (files.length > available) {
        errors.push(`Only ${this.maxFiles} memories can be prepared at once.`);
      }

      this.drafts.push(...accepted);
      this.render();

      if (errors.length && this.status) {
        this.status.textContent = errors.join(" ");
        this.status.classList.add("is-error");
      }
    }

    removeDraft(clientId) {
      const draft = this.drafts.find((item) => item.client_id === clientId);

      if (draft) {
        URL.revokeObjectURL(draft.preview_url);
      }

      this.drafts = this.drafts.filter((item) => item.client_id !== clientId);
      this.render();
    }

    removeDrafts(clientIds) {
      const ids = new Set(clientIds);

      this.drafts.forEach((draft) => {
        if (ids.has(draft.client_id)) {
          URL.revokeObjectURL(draft.preview_url);
        }
      });

      this.drafts = this.drafts.filter((draft) => !ids.has(draft.client_id));
      this.render();
    }

    clear() {
      this.drafts.forEach((draft) => URL.revokeObjectURL(draft.preview_url));
      this.drafts = [];
      this.render();
    }

    hasItems() {
      return this.drafts.length > 0;
    }

    setDisabled(disabled) {
      this.disabled = Boolean(disabled);

      if (this.input) {
        this.input.disabled = this.disabled;
      }

      this.render();
    }

    setDraftStatus(clientId, status, message) {
      const draft = this.drafts.find((item) => item.client_id === clientId);

      if (!draft) {
        return;
      }

      draft.status = status;
      draft.status_message = message;
      this.render();
    }

    async uploadAll(movieId, pin, options = {}) {
      const saved = [];
      const failures = [];
      const successfulIds = [];
      const drafts = [...this.drafts];

      this.setDisabled(true);

      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];

        try {
          this.setDraftStatus(
            draft.client_id,
            "preparing",
            isVideoMemory(draft.file)
              ? "Preparing video…"
              : "Preparing HD image…",
          );
          options.onProgress?.({
            index,
            total: drafts.length,
            draft,
            stage: "preparing",
          });

          this.setDraftStatus(draft.client_id, "uploading", "Uploading to Cloudinary…");

          const memory = await uploadMemoryDraft(
            draft,
            movieId,
            pin,
            Number(options.sortOffset || 0) + index,
          );

          saved.push(memory);
          successfulIds.push(draft.client_id);
          this.setDraftStatus(draft.client_id, "done", "Saved");

          options.onProgress?.({
            index,
            total: drafts.length,
            draft,
            stage: "done",
          });
        } catch (error) {
          console.error(error);
          failures.push({
            client_id: draft.client_id,
            file_name: draft.file.name,
            message: error.message,
          });

          this.setDraftStatus(draft.client_id, "error", error.message);

          options.onProgress?.({
            index,
            total: drafts.length,
            draft,
            stage: "error",
            error,
          });
        }
      }

      this.setDisabled(false);

      return {
        saved,
        failures,
        successfulIds,
      };
    }

    render() {
      if (!this.list) {
        return;
      }

      if (!this.drafts.length) {
        this.list.innerHTML = `
          <div class="memory-drafts-empty">
            <i data-lucide="images" aria-hidden="true"></i>
            <p>Add up to ${this.maxFiles} photos or short videos from this experience.</p>
          </div>
        `;

        if (this.status) {
          this.status.textContent =
            "Photos stay HD up to 3200 px. Videos are uploaded in their original quality.";
          this.status.classList.remove("is-error");
        }

        window.Seenetrica.refreshIcons();
        return;
      }

      this.list.innerHTML = this.drafts
        .map((draft) => {
          const typeOptions = MEMORY_TYPES.map(
            ([value, label]) => `
              <option value="${value}" ${draft.memory_type === value ? "selected" : ""}>
                ${label}
              </option>
            `,
          ).join("");

          return `
            <article
              class="memory-draft-card is-${escapeHtml(draft.status)}"
              data-memory-draft-id="${escapeHtml(draft.client_id)}"
            >
              <div class="memory-draft-preview">
                ${
                  isVideoMemory(draft.file)
                    ? `
                      <video
                        src="${escapeHtml(draft.preview_url)}"
                        aria-label="Preview of ${escapeHtml(draft.file.name)}"
                        muted
                        playsinline
                        preload="metadata"
                      ></video>

                      <span class="memory-video-indicator" aria-hidden="true">
                        <i data-lucide="play" aria-hidden="true"></i>
                      </span>
                    `
                    : `
                      <img
                        src="${escapeHtml(draft.preview_url)}"
                        alt="Preview of ${escapeHtml(draft.file.name)}"
                      />
                    `
                }

                <span class="memory-draft-state">
                  ${escapeHtml(draft.status_message)}
                </span>
              </div>

              <div class="memory-draft-fields">
                <div class="memory-draft-heading">
                  <div>
                    <strong>${escapeHtml(draft.file.name)}</strong>
                    <span>${formatBytes(draft.file.size)}</span>
                  </div>

                  <button
                    class="memory-remove-button"
                    type="button"
                    data-remove-memory-draft="${escapeHtml(draft.client_id)}"
                    aria-label="Remove ${escapeHtml(draft.file.name)}"
                    ${this.disabled ? "disabled" : ""}
                  >
                    <i data-lucide="x" aria-hidden="true"></i>
                  </button>
                </div>

                <div class="memory-draft-grid">
                  <label class="form-field">
                    <span>Type</span>
                    <select
                      data-memory-field="memory_type"
                      ${this.disabled ? "disabled" : ""}
                    >
                      ${typeOptions}
                    </select>
                  </label>

                  <label class="form-field">
                    <span>Date (optional)</span>
                    <input
                      type="date"
                      value="${escapeHtml(draft.memory_date)}"
                      data-memory-field="memory_date"
                      ${this.disabled ? "disabled" : ""}
                    />
                  </label>

                  <label class="form-field is-full">
                    <span>Caption (optional)</span>
                    <input
                      type="text"
                      maxlength="1000"
                      value="${escapeHtml(draft.caption)}"
                      placeholder="What does this memory hold?"
                      data-memory-field="caption"
                      ${this.disabled ? "disabled" : ""}
                    />
                  </label>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      if (this.status) {
        this.status.textContent = `${this.drafts.length} of ${this.maxFiles} media memories prepared.`;
        this.status.classList.remove("is-error");
      }

      window.Seenetrica.refreshIcons();
    }
  }

  window.SeenetricaMemories = {
    MemoryComposer,
    cloudinaryImageUrl,
    cloudinaryVideoPosterUrl,
    formatBytes,
    isVideoMemory,
    mediaResourceType,
    uploadMemoryDraft,
  };
})();


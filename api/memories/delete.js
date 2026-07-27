const {
  destroyCloudinaryAsset,
  missingEnvironmentVariables,
  parseJsonBody,
  readAppsScriptData,
  safeCompare,
  writeAppsScriptData,
} = require("../../lib/server-utils");

const REQUIRED_ENVIRONMENT = [
  "APPS_SCRIPT_URL",
  "APPS_SCRIPT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "SEENETRICA_WRITE_PIN",
];

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  const missing = missingEnvironmentVariables(REQUIRED_ENVIRONMENT);

  if (missing.length) {
    return response.status(500).json({
      success: false,
      message: `Missing server configuration: ${missing.join(", ")}.`,
    });
  }

  try {
    const body = parseJsonBody(request);

    if (!safeCompare(body.pin, process.env.SEENETRICA_WRITE_PIN)) {
      return response.status(401).json({
        success: false,
        message: "Incorrect PIN.",
      });
    }

    const memoryId = String(body.memory_id || "").trim();

    if (!/^MEM-[A-Z0-9-]{6,80}$/i.test(memoryId)) {
      return response.status(400).json({
        success: false,
        message: "A valid memory ID is required.",
      });
    }

    const archive = await readAppsScriptData();

    if (!archive.success) {
      throw new Error(archive.message || "The archive could not be loaded.");
    }

    const memories = Array.isArray(archive.data?.movie_memories)
      ? archive.data.movie_memories
      : [];

    const memory = memories.find(
      (item) => String(item.id) === memoryId,
    );

    if (!memory) {
      return response.status(404).json({
        success: false,
        message: "Memory was not found.",
      });
    }

    const publicId = String(memory.public_id || "").trim();

    if (!publicId.startsWith("seenetrica/memories/")) {
      throw new Error("The stored Cloudinary asset ID is invalid.");
    }

    const resourceType = /\/video\/upload\//i.test(
      String(memory.image_url || ""),
    )
      ? "video"
      : "image";

    await destroyCloudinaryAsset(publicId, resourceType);

    const result = await writeAppsScriptData("deleteMemory", {
      id: memoryId,
    });

    if (!result.success) {
      throw new Error(result.message || "The memory metadata could not be deleted.");
    }

    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({
      success: true,
      data: {
        memory: result.data?.memory || memory,
      },
    });
  } catch (error) {
    console.error("Memory delete error:", error);

    return response.status(502).json({
      success: false,
      message: error.message || "Could not delete the memory.",
    });
  }
};


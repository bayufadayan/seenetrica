const {
  destroyCloudinaryAsset,
  missingEnvironmentVariables,
  parseJsonBody,
  safeCompare,
} = require("../../lib/server-utils");

const REQUIRED_ENVIRONMENT = [
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

    const publicId = String(body.public_id || "").trim();
    const resourceType = String(body.resource_type || "image").trim();

    if (!["image", "video"].includes(resourceType)) {
      return response.status(400).json({
        success: false,
        message: "Memory resource type must be image or video.",
      });
    }

    if (!/^seenetrica\/memories\/MOV-[A-Z0-9-]+\/memory-[A-Z0-9-]+$/i.test(publicId)) {
      return response.status(400).json({
        success: false,
        message: "Invalid memory asset ID.",
      });
    }

    await destroyCloudinaryAsset(publicId, resourceType);

    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({
      success: true,
      data: { public_id: publicId, resource_type: resourceType },
    });
  } catch (error) {
    console.error("Memory cleanup error:", error);

    return response.status(502).json({
      success: false,
      message: error.message || "Could not clean up the uploaded media.",
    });
  }
};


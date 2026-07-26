const crypto = require("crypto");
const {
  createCloudinarySignature,
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

function isValidMovieId(value) {
  return /^MOV-[A-Z0-9-]{6,80}$/i.test(String(value || ""));
}

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

    const movieId = String(body.movie_id || "").trim();

    if (!isValidMovieId(movieId)) {
      return response.status(400).json({
        success: false,
        message: "A valid movie ID is required.",
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId =
      `seenetrica/memories/${movieId}/memory-${timestamp}-${crypto
        .randomBytes(5)
        .toString("hex")}`;

    const parameters = {
      overwrite: "false",
      public_id: publicId,
      timestamp,
    };

    const signature = createCloudinarySignature(
      parameters,
      process.env.CLOUDINARY_API_SECRET,
    );

    response.setHeader("Cache-Control", "no-store");

    return response.status(200).json({
      success: true,
      data: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        upload_url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(
          process.env.CLOUDINARY_CLOUD_NAME,
        )}/image/upload`,
        timestamp,
        signature,
        public_id: publicId,
        overwrite: "false",
      },
    });
  } catch (error) {
    console.error("Memory upload signature error:", error);

    return response.status(500).json({
      success: false,
      message: "Could not prepare the memory upload.",
    });
  }
};

const crypto = require("crypto");

const ALLOWED_WRITE_ACTIONS = new Set([
    "createMovie",
    "updateMovie",
    "addViewing",
    "createMemory",
    "updateMemory",
    "syncCategorizedLibrary",
    "recordCategorizedViewing",
    "prepareCategoryIconUpload",
    "deleteCategoryIcon",
]);

const ALLOWED_READ_SCOPES = new Set([
    "categorized",
]);

function safeCompare(firstValue, secondValue) {
    const first = Buffer.from(
        String(firstValue || ""),
    );

    const second = Buffer.from(
        String(secondValue || ""),
    );

    if (first.length !== second.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        first,
        second,
    );
}

function getMissingConfiguration(
    includeWritePin = false,
) {
    const missing = [];

    if (!process.env.APPS_SCRIPT_URL) {
        missing.push("APPS_SCRIPT_URL");
    }

    if (!process.env.APPS_SCRIPT_SECRET) {
        missing.push("APPS_SCRIPT_SECRET");
    }

    if (
        includeWritePin &&
        !process.env.SEENETRICA_WRITE_PIN
    ) {
        missing.push(
            "SEENETRICA_WRITE_PIN",
        );
    }

    return missing;
}

async function parseAppsScriptResponse(
    appsScriptResponse,
) {
    const text =
        await appsScriptResponse.text();

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            "Apps Script returned an invalid response.",
        );
    }
}

async function readAppsScriptData(scope = null) {
    const url = new URL(
        process.env.APPS_SCRIPT_URL,
    );

    url.searchParams.set(
        "secret",
        process.env.APPS_SCRIPT_SECRET,
    );

    if (scope) {
        url.searchParams.set(
            "scope",
            scope,
        );
    }

    const appsScriptResponse = await fetch(
        url,
        {
            method: "GET",
            redirect: "follow",
            headers: {
                Accept: "application/json",
            },
        },
    );

    if (!appsScriptResponse.ok) {
        throw new Error(
            `Apps Script responded with HTTP ${appsScriptResponse.status}.`,
        );
    }

    return parseAppsScriptResponse(
        appsScriptResponse,
    );
}

async function writeAppsScriptData(
    action,
    data,
) {
    const appsScriptResponse = await fetch(
        process.env.APPS_SCRIPT_URL,
        {
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type":
                    "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                secret:
                    process.env
                        .APPS_SCRIPT_SECRET,
                action,
                data,
            }),
        },
    );

    if (!appsScriptResponse.ok) {
        throw new Error(
            `Apps Script responded with HTTP ${appsScriptResponse.status}.`,
        );
    }

    return parseAppsScriptResponse(
        appsScriptResponse,
    );
}

module.exports = async function handler(
    request,
    response,
) {
    const isWrite =
        request.method === "POST";

    if (
        request.method !== "GET" &&
        request.method !== "POST"
    ) {
        response.setHeader(
            "Allow",
            "GET, POST",
        );

        return response.status(405).json({
            success: false,
            message: "Method not allowed.",
        });
    }

    response.setHeader(
        "Cache-Control",
        "no-store",
    );

    const missing =
        getMissingConfiguration(isWrite);

    if (missing.length) {
        return response.status(500).json({
            success: false,
            message:
                `Missing server configuration: ${missing.join(", ")}.`,
        });
    }

    try {
        if (request.method === "GET") {
            const requestedScope =
                request.query?.scope
                || new URL(
                    request.url || "/api/data",
                    "http://localhost",
                ).searchParams.get("scope");
            const scope = requestedScope
                ? String(requestedScope)
                : null;

            if (
                scope &&
                !ALLOWED_READ_SCOPES.has(scope)
            ) {
                return response.status(400).json({
                    success: false,
                    message: "Invalid data scope.",
                });
            }

            const result =
                await readAppsScriptData(scope);

            if (!result.success) {
                return response
                    .status(502)
                    .json(result);
            }

            return response
                .status(200)
                .json(result);
        }

        const body =
            typeof request.body === "string"
                ? JSON.parse(request.body)
                : request.body || {};

        if (
            !safeCompare(
                body.pin,
                process.env
                    .SEENETRICA_WRITE_PIN,
            )
        ) {
            return response.status(401).json({
                success: false,
                message: "Incorrect PIN.",
            });
        }

        const action = String(
            body.action || "",
        );

        if (
            !ALLOWED_WRITE_ACTIONS.has(action)
        ) {
            return response.status(400).json({
                success: false,
                message: "Invalid write action.",
            });
        }

        const result =
            await writeAppsScriptData(
                action,
                body.data || {},
            );

        if (!result.success) {
            const status =
                result.message === "Unauthorized"
                    ? 502
                    : 400;

            return response
                .status(status)
                .json(result);
        }

        return response
            .status(200)
            .json(result);
    } catch (error) {
        console.error(
            "Seenetrica API error:",
            error,
        );

        return response.status(502).json({
            success: false,
            message:
                "Could not connect to the Seenetrica data service.",
        });
    }
};

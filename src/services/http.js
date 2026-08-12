export async function parseJson(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(
      result.message || result.error || "The request could not be completed.",
    );
    error.status = response.status;
    error.response = result;
    throw error;
  }
  return result;
}

export async function authenticatedPost(url, payload, pin) {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...payload, pin }),
  });
  const result = await parseJson(response);
  return result.data;
}

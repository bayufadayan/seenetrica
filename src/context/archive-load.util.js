export async function loadArchiveLocalFirst({ readCache, fetchFresh, onCache, onFresh }) {
  let cached = null;
  try {
    cached = await readCache();
  } catch {
    // A blocked/corrupt cache must not prevent the live archive request.
  }
  if (cached) onCache(cached);
  const fresh = await fetchFresh();
  onFresh(fresh);
  return { cached, fresh };
}

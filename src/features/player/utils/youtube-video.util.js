export function isLikelyYouTubeShort(video) {
  const duration = Number(video?.durationSeconds);
  const metadata = [video?.title, video?.description, ...(video?.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasShortsMarker = /(^|[\s#_-])(shorts?|ytshorts|youtubeshorts)(?=$|[\s#_-])/.test(metadata);
  return (Number.isFinite(duration) && duration <= 60) || hasShortsMarker;
}

export function isEligibleYouTubeTrailer(video) {
  const duration = Number(video?.durationSeconds);
  return Number.isFinite(duration)
    && duration > 60
    && duration <= 240
    && !isLikelyYouTubeShort(video);
}

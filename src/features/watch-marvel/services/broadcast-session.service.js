import { TEST_TIMELINE } from "../constants/watch-marvel.constants";
import { calculateScheduledStart } from "../utils/broadcast-time.util";
import { buildCommercialBreakpoints } from "../utils/breakpoint.util";
import { buildCommercialPlan, buildPreShowPlan } from "../utils/commercial-plan.util";
import { createSeededRandom } from "../utils/seeded-random.util";
import { isEligibleYouTubeTrailer } from "../utils/youtube-video.util";
import { localMediaService } from "./local-media.service";
import { watchMarvelDb } from "./watch-marvel-db.service";

function mediaPool(settings, localSource, channels, phase = "preShow") {
  const config = phase === "preShow" ? settings.preShow : settings.midRoll;
  const local = config.useLocalAds
    ? (localSource?.files || []).map((file) => ({ ...file, sourceId: file.id, kind: "local", id: `local:${file.id}` }))
    : [];
  const youtube = config.useYouTubeTrailers
    ? channels
        .filter((channel) => channel.enabled)
        .flatMap((channel) => channel.latestVideos || [])
        .filter(isEligibleYouTubeTrailer)
        .map((video) => ({ ...video, kind: "youtube", id: `youtube:${video.videoId}` }))
    : [];
  return [...local, ...youtube];
}

export async function createBroadcastSession({ mode = "watch", title = null, settings, localSource, channels }) {
  const selected = await localMediaService.selectMovieFile();
  const sessionId = crypto.randomUUID();
  const current = new Date();
  const scheduledStart =
    mode === "test"
      ? new Date(current.getTime() + TEST_TIMELINE.preShowSeconds * 1000)
      : calculateScheduledStart(current, settings.preShow.minMinutes, settings.preShow.maxMinutes);
  const preShowSeconds = Math.max(1, Math.ceil((scheduledStart.getTime() - current.getTime()) / 1000));
  const random = createSeededRandom(sessionId);
  const preShowPlan = buildPreShowPlan({
    media: mediaPool(settings, localSource, channels, "preShow"),
    targetDurationSeconds: preShowSeconds,
    random,
  }).items;
  let commercialBreaks;
  if (mode === "test") {
    const atMovieSecond = Math.min(TEST_TIMELINE.firstMovieSeconds, Math.max(5, Math.floor(selected.metadata.durationSeconds / 2)));
    commercialBreaks = selected.metadata.durationSeconds > 12
      ? [{ id: `test-break-${sessionId}`, atMovieSecond, targetDurationSeconds: TEST_TIMELINE.breakSeconds, status: "pending", items: [] }]
      : [];
  } else {
    commercialBreaks = buildCommercialBreakpoints({
      movieDurationSeconds: selected.metadata.durationSeconds,
      settings,
      seed: sessionId,
    });
  }
  let usedIds = [];
  commercialBreaks = commercialBreaks.map((breakpoint) => {
    const plan = buildCommercialPlan({
      media: mediaPool(settings, localSource, channels, "midRoll"),
      targetDurationSeconds: breakpoint.targetDurationSeconds,
      usedIds: settings.midRoll.preventRepeatInSession ? usedIds : [],
      random,
    });
    usedIds = plan.usedIds;
    return { ...breakpoint, items: plan.items };
  });
  const session = await watchMarvelDb.createSession({
    id: sessionId,
    mode,
    titleId: title?.id || null,
    movieFileName: selected.file.name,
    movieFileSize: selected.file.size,
    movieFileLastModified: selected.file.lastModified,
    movieFileHandle: selected.handle,
    movieDurationSeconds: selected.metadata.durationSeconds,
    scheduledStartAt: scheduledStart.toISOString(),
    status: "pre_show",
    phase: "pre_show",
    currentMovieTime: 0,
    currentBreakIndex: -1,
    preShowPlan,
    commercialBreaks,
    fileRecoverable: selected.recoverable,
    playerVolume: settings.player.defaultVolume,
  });
  localMediaService.registerSessionFile(session.id, selected.file);
  return session;
}

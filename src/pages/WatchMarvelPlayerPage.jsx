import { Captions, Expand, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BroadcastCountdown } from "../features/watch-marvel/components/BroadcastCountdown";
import { BroadcastMedia } from "../features/watch-marvel/components/BroadcastMedia";
import { PlayerGuide } from "../features/watch-marvel/components/PlayerGuide";
import { SubtitleSelector } from "../features/watch-marvel/components/SubtitleSelector";
import { PLAYER_STATES } from "../features/watch-marvel/constants/watch-marvel.constants";
import { useBroadcastSession } from "../features/watch-marvel/hooks/useBroadcastSession";
import { useKeyboardPlayerControls } from "../features/watch-marvel/hooks/useKeyboardPlayerControls";
import { localMediaService } from "../features/watch-marvel/services/local-media.service";
import { watchMarvelDb } from "../features/watch-marvel/services/watch-marvel-db.service";

function errorMessage(error) { return error?.message || "The feature could not be played."; }

export default function WatchMarvelPlayerPage() {
  const { sessionId } = useParams();
  const player = useBroadcastSession(sessionId);
  const { machine, dispatch, session, movieFile, persist, complete, nextBreakpoint, testingFinished } = player;
  const containerRef = useRef(null); const movieRef = useRef(null); const internalAction = useRef(false); const lastValidTime = useRef(0);
  const [movieUrl, setMovieUrl] = useState(null); const [localSource, setLocalSource] = useState(null);
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false); const [showGuide, setShowGuide] = useState(true);
  const [embeddedTracks, setEmbeddedTracks] = useState([]); const [subtitleSelection, setSubtitleSelection] = useState("off");
  const [externalSubtitle, setExternalSubtitle] = useState(null); const [externalUrl, setExternalUrl] = useState(null);
  const initializedSession = useRef(null);
  const breakEndTargets = useRef(new Map());
  const toggleFullscreen = useKeyboardPlayerControls({ volume, setVolume, muted, setMuted, containerRef });

  useEffect(() => { watchMarvelDb.getLocalSource().then(setLocalSource).catch(() => setLocalSource(null)); }, []);
  useEffect(() => { if (session && initializedSession.current !== session.id) { initializedSession.current = session.id; setVolume(session.playerVolume ?? 0.8); const storedSubtitle = session.activeSubtitle?.value; setSubtitleSelection(storedSubtitle === "external" ? "off" : storedSubtitle || "off"); } }, [session]);
  useEffect(() => { if (!movieFile) return undefined; const url = URL.createObjectURL(movieFile); setMovieUrl(url); return () => { URL.revokeObjectURL(url); setMovieUrl(null); localMediaService.forgetSessionFile(sessionId); }; }, [movieFile, sessionId]);
  useEffect(() => { if (!externalSubtitle) return undefined; const url = URL.createObjectURL(new Blob([externalSubtitle.text], { type: "text/vtt" })); setExternalUrl(url); return () => { URL.revokeObjectURL(url); setExternalUrl(null); }; }, [externalSubtitle]);
  useEffect(() => { const timeout = window.setTimeout(() => setShowGuide(false), 8000); return () => window.clearTimeout(timeout); }, []);
  useEffect(() => { if (movieRef.current) { movieRef.current.volume = volume; movieRef.current.muted = muted; } }, [muted, volume]);

  const filmVisible = [PLAYER_STATES.STARTING_MOVIE, PLAYER_STATES.PLAYING_MOVIE, PLAYER_STATES.RESUMING_MOVIE].includes(machine.status);
  useEffect(() => {
    const video = movieRef.current; if (!video) return;
    [...video.textTracks].forEach((track) => { track.mode = "disabled"; });
    if (!filmVisible || subtitleSelection === "off") return;
    const index = subtitleSelection.startsWith("embedded:") ? Number(subtitleSelection.split(":")[1]) : subtitleSelection === "external" ? video.textTracks.length - 1 : -1;
    if (video.textTracks[index]) video.textTracks[index].mode = "showing";
  }, [externalUrl, filmVisible, subtitleSelection]);

  useEffect(() => {
    if (machine.status !== PLAYER_STATES.PRE_SHOW || !session) return undefined;
    const check = () => { if (Date.now() >= new Date(session.scheduledStartAt).getTime()) dispatch({ type: "SCHEDULE_REACHED" }); };
    check(); const id = window.setInterval(check, 250); return () => window.clearInterval(id);
  }, [dispatch, machine.status, session]);
  useEffect(() => {
    if (machine.status !== PLAYER_STATES.STARTING_MOVIE || !movieRef.current) return;
    const video = movieRef.current; internalAction.current = true; video.currentTime = Math.max(0, session.currentMovieTime || 0); video.playbackRate = 1;
    video.play().then(() => dispatch({ type: "MOVIE_STARTED" })).catch((error) => dispatch({ type: "PLAYBACK_ERROR", error: new Error(`Playback could not start: ${error.message}`) })).finally(() => { internalAction.current = false; });
  }, [dispatch, machine.status, session]);
  useEffect(() => {
    if (machine.status !== PLAYER_STATES.STARTING_BREAK || !movieRef.current) return;
    internalAction.current = true; movieRef.current.pause();
    persist({ currentMovieTime: movieRef.current.currentTime, currentBreakIndex: machine.breakIndex, phase: "commercial_break", status: "playing" }, true).finally(() => { internalAction.current = false; dispatch({ type: "BREAK_STARTED" }); });
  }, [dispatch, machine.breakIndex, machine.status, persist]);
  useEffect(() => {
    if (machine.status !== PLAYER_STATES.RESUMING_MOVIE || !movieRef.current) return;
    const video = movieRef.current; internalAction.current = true; video.currentTime = lastValidTime.current; video.playbackRate = 1;
    video.play().then(async () => { const breaks = session.commercialBreaks.map((item, index) => index === machine.breakIndex ? { ...item, status: "completed" } : item); await persist({ commercialBreaks: breaks, currentMovieTime: video.currentTime, phase: "movie", status: "playing" }, true); dispatch({ type: "MOVIE_RESUMED" }); }).catch((error) => dispatch({ type: "PLAYBACK_ERROR", error })).finally(() => { internalAction.current = false; });
  }, [dispatch, machine.breakIndex, machine.status, persist, session]);
  useEffect(() => { const save = () => { if (movieRef.current && session) persist({ currentMovieTime: movieRef.current.currentTime, playerVolume: volume, activeSubtitle: { value: subtitleSelection, language: externalSubtitle?.language || null } }, true); }; window.addEventListener("beforeunload", save); return () => { window.removeEventListener("beforeunload", save); save(); }; }, [externalSubtitle?.language, persist, session, subtitleSelection, volume]);
  useEffect(() => { if (machine.status === PLAYER_STATES.COMPLETED) { if (movieUrl) { URL.revokeObjectURL(movieUrl); setMovieUrl(null); } if (externalUrl) { URL.revokeObjectURL(externalUrl); setExternalUrl(null); } localMediaService.forgetSessionFile(sessionId); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } }, [externalUrl, machine.status, movieUrl, sessionId]);

  function loadedMetadata() {
    const tracks = [...movieRef.current.textTracks].map((track, index) => ({ index, label: track.label, language: track.language, kind: track.kind }));
    setEmbeddedTracks(tracks.filter((track) => ["subtitles", "captions"].includes(track.kind)));
    movieRef.current.playbackRate = 1;
  }
  function movieTimeUpdate() {
    const video = movieRef.current; if (!video || machine.status !== PLAYER_STATES.PLAYING_MOVIE) return;
    lastValidTime.current = video.currentTime; persist({ currentMovieTime: video.currentTime, phase: "movie", status: "playing" });
    if (testingFinished(video.currentTime)) { internalAction.current = true; video.pause(); complete().catch((error) => dispatch({ type: "PLAYBACK_ERROR", error })); return; }
    const index = nextBreakpoint(video.currentTime); if (index >= 0) dispatch({ type: "BREAKPOINT_REACHED", index });
  }
  function moviePaused() { if (machine.status === PLAYER_STATES.PLAYING_MOVIE && !internalAction.current && !movieRef.current.ended) movieRef.current.play().catch((error) => dispatch({ type: "PLAYBACK_ERROR", error })); }
  function movieSeeking() { if (machine.status === PLAYER_STATES.PLAYING_MOVIE && !internalAction.current) movieRef.current.currentTime = lastValidTime.current; }
  async function movieEnded() { if (machine.status !== PLAYER_STATES.PLAYING_MOVIE) return; try { await complete(); } catch (error) { dispatch({ type: "PLAYBACK_ERROR", error }); } }
  function selectSubtitle(value) { if (value === "external" && !externalSubtitle) return; setSubtitleSelection(value); persist({ activeSubtitle: { value, language: value.startsWith("embedded:") ? embeddedTracks.find((track) => track.index === Number(value.split(":")[1]))?.language : externalSubtitle?.language || null } }, true); }
  function addExternal(subtitle) { setExternalSubtitle(subtitle); setSubtitleSelection("external"); persist({ activeSubtitle: { value: "external", language: subtitle.language, fileName: subtitle.fileName } }, true); }

  if (player.loadingError || machine.status === PLAYER_STATES.ERROR) return <main className="wm-player-error"><p className="section-kicker">Broadcast interrupted</p><h1>Unable to continue</h1><p>{errorMessage(player.loadingError || machine.error)}</p><Link className="secondary-button" to="/watch-marvel">Return to Watch Marvel</Link></main>;
  if (!session) return <main className="wm-player-loading">Opening broadcast session…</main>;
  if (player.needsFile) return <main className="wm-player-error"><p className="section-kicker">File recovery</p><h1>Select the feature again</h1><p>Choose the same local file. Its name, size and modified date will be verified.</p>{player.recoveryError && <p role="alert">{player.recoveryError.message}</p>}<button className="primary-button" type="button" onClick={player.recover}>Select movie file</button><Link className="text-button" to="/watch-marvel">Cancel</Link></main>;
  const currentBreak = session.commercialBreaks[machine.breakIndex]; const breakItem = currentBreak?.items[machine.breakMediaIndex];
  if (currentBreak && !breakEndTargets.current.has(currentBreak.id)) breakEndTargets.current.set(currentBreak.id, Date.now() + currentBreak.items.reduce((total, item) => total + Number(item.durationSeconds || 0), 0) * 1000);
  function breakMediaEnded() { if (machine.breakMediaIndex + 1 >= (currentBreak?.items.length || 0)) dispatch({ type: "BREAK_COMPLETED" }); else dispatch({ type: "BREAK_MEDIA_ENDED" }); }
  const preItem = session.preShowPlan[machine.preShowIndex] || { kind: "countdown", durationSeconds: Math.max(1, Math.ceil((new Date(session.scheduledStartAt).getTime() - Date.now()) / 1000)) };
  return <main className="wm-player" ref={containerRef}>
    <video ref={movieRef} className={`wm-movie-video ${filmVisible ? "is-visible" : ""}`} src={movieUrl || undefined} playsInline preload="auto" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" onLoadedMetadata={loadedMetadata} onTimeUpdate={movieTimeUpdate} onPause={moviePaused} onSeeking={movieSeeking} onRateChange={() => { if (movieRef.current.playbackRate !== 1) movieRef.current.playbackRate = 1; }} onEnded={movieEnded} onError={() => movieUrl && dispatch({ type: "PLAYBACK_ERROR", error: new Error("The selected movie could not be played by this browser.") })}>{externalUrl && <track kind="subtitles" src={externalUrl} srcLang={externalSubtitle?.language || "und"} label={externalSubtitle?.language || "External subtitle"} />}</video>
    {machine.status === PLAYER_STATES.PRE_SHOW && <div className="wm-broadcast-layer"><BroadcastMedia key={`pre-${machine.preShowIndex}`} item={preItem} source={localSource} volume={volume} muted={muted} onEnded={() => dispatch({ type: "PRE_SHOW_MEDIA_ENDED" })} /><BroadcastCountdown target={session.scheduledStartAt} /><div className="wm-feature-time">FEATURE BEGINS AT {new Date(session.scheduledStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div><SubtitleSelector embeddedTracks={embeddedTracks} selection={subtitleSelection} onSelection={selectSubtitle} onExternal={addExternal} unavailable={!embeddedTracks.length} />{showGuide && <PlayerGuide />}</div>}
    {[PLAYER_STATES.STARTING_BREAK, PLAYER_STATES.PLAYING_BREAK].includes(machine.status) && <div className="wm-broadcast-layer"><BroadcastMedia key={`break-${machine.breakIndex}-${machine.breakMediaIndex}`} item={breakItem || { kind: "countdown", durationSeconds: 1 }} source={localSource} volume={volume} muted={muted} onEnded={breakMediaEnded} /><BroadcastCountdown target={breakEndTargets.current.get(currentBreak?.id)} label="FEATURE RESUMES IN" /><div className="wm-break-label">COMMERCIAL BREAK<span>Feature resumes after this break</span></div></div>}
    {machine.status === PLAYER_STATES.COMPLETED && <div className="wm-ending"><p className="section-kicker">Broadcast complete</p><h1>{session.mode === "test" ? "Testing finished." : "Feature presentation concluded."}</h1><p>{session.mode === "test" ? "Watched status was not changed." : "This title is now marked as watched."}</p><Link className="primary-button" to="/watch-marvel">Return to Watch Marvel</Link></div>}
    {!([PLAYER_STATES.COMPLETED, PLAYER_STATES.ERROR].includes(machine.status)) && <div className="wm-player-controls"><button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX /> : <Volume2 />}</button><input type="range" min="0" max="1" step="0.05" value={volume} aria-label="Volume" onChange={(e) => setVolume(Number(e.target.value))} /><button type="button" aria-label="Toggle fullscreen" onClick={toggleFullscreen}><Expand /></button><span title="Subtitles selected"><Captions /> {subtitleSelection === "off" ? "Off" : "On"}</span></div>}
  </main>;
}

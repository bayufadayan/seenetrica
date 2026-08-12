import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { categoryLibraryDb } from "../../categories/services/category-library-db.service";
import { categorySyncService } from "../../categories/services/category-sync.service";
import { PLAYER_STATES, TEST_TIMELINE } from "../constants/player.constants";
import { localMediaService } from "../services/local-media.service";
import { playerDb } from "../services/player-db.service";

const initial = { status: PLAYER_STATES.INITIALIZING, preShowIndex: 0, breakIndex: -1, breakMediaIndex: 0, error: null };
function reducer(state, event) {
  switch (event.type) {
    case "INITIALIZED": return { ...state, status: PLAYER_STATES.PRE_SHOW };
    case "PRE_SHOW_MEDIA_ENDED": return { ...state, preShowIndex: state.preShowIndex + 1 };
    case "SCHEDULE_REACHED": return { ...state, status: PLAYER_STATES.STARTING_MOVIE };
    case "MOVIE_STARTED": return { ...state, status: PLAYER_STATES.PLAYING_MOVIE };
    case "BREAKPOINT_REACHED": return { ...state, status: PLAYER_STATES.STARTING_BREAK, breakIndex: event.index, breakMediaIndex: 0 };
    case "BREAK_STARTED": return { ...state, status: PLAYER_STATES.PLAYING_BREAK };
    case "BREAK_MEDIA_ENDED": return { ...state, breakMediaIndex: state.breakMediaIndex + 1 };
    case "BREAK_COMPLETED": return { ...state, status: PLAYER_STATES.RESUMING_MOVIE };
    case "MOVIE_RESUMED": return { ...state, status: PLAYER_STATES.PLAYING_MOVIE };
    case "MOVIE_ENDED": return { ...state, status: PLAYER_STATES.COMPLETED };
    case "PLAYBACK_ERROR": return { ...state, status: PLAYER_STATES.ERROR, error: event.error };
    default: return state;
  }
}

function localDate() {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
}

export function shouldRecordCategorizedViewing(session) {
  const categoryTitleId = session?.categoryTitleId || session?.titleId;
  return Boolean(
    session?.mode === "watch"
    && categoryTitleId
    && (session.sourceKind === "category" || !session.sourceKind),
  );
}

export function useBroadcastSession(sessionId) {
  const [machine, dispatch] = useReducer(reducer, initial);
  const [session, setSession] = useState(null);
  const [movieFile, setMovieFile] = useState(null);
  const [needsFile, setNeedsFile] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [recoveryError, setRecoveryError] = useState(null);
  const lastPersisted = useRef(0);
  const sessionRef = useRef(null);
  sessionRef.current = session;

  useEffect(() => {
    let active = true;
    playerDb.getSession(sessionId).then(async (record) => {
      if (!record) throw new Error("Player session was not found.");
      if (record.status === "completed") {
        if (active) { setSession(record); setNeedsFile(false); dispatch({ type: "MOVIE_ENDED" }); }
        return;
      }
      const file = await localMediaService.getSessionFile(record);
      if (!active) return;
      setSession(record); setMovieFile(file); setNeedsFile(!file);
      if (file) dispatch({ type: "INITIALIZED" });
    }).catch((error) => active && setLoadingError(error));
    return () => { active = false; };
  }, [sessionId]);

  const recover = useCallback(async () => {
    setRecoveryError(null);
    try { const file = await localMediaService.recoverSessionFile(sessionRef.current); setMovieFile(file); setNeedsFile(false); dispatch({ type: "INITIALIZED" }); } catch (error) { setRecoveryError(error); }
  }, []);
  const persist = useCallback(async (patch = {}, force = false) => {
    const current = sessionRef.current;
    if (!current) return;
    const timestamp = Date.now();
    if (!force && timestamp - lastPersisted.current < 5000) return;
    lastPersisted.current = timestamp;
    const updated = await playerDb.updateSession(current.id, patch);
    sessionRef.current = updated;
    setSession(updated);
  }, []);
  const complete = useCallback(async () => {
    const current = sessionRef.current;
    const categoryTitleId = current.categoryTitleId || current.titleId;
    if (shouldRecordCategorizedViewing(current)) {
      await categoryLibraryDb.recordCompletedViewing({ sessionId: current.id, categoryTitleId, watchedAt: localDate() });
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("seenetrica:categories-changed"));
      categorySyncService.syncInBackground().catch(() => { /* The outbox keeps this retryable. */ });
    }
    const completed = await playerDb.completeSession(current.id);
    sessionRef.current = completed;
    setSession(completed);
    dispatch({ type: "MOVIE_ENDED" });
  }, []);
  const nextBreakpoint = useCallback((currentTime) => {
    const current = sessionRef.current;
    if (!current) return -1;
    return current.commercialBreaks.findIndex((item, index) => index > current.currentBreakIndex && item.status !== "completed" && currentTime >= item.atMovieSecond);
  }, []);
  const testingFinished = useCallback((currentTime) => sessionRef.current?.mode === "test" && currentTime >= TEST_TIMELINE.firstMovieSeconds + TEST_TIMELINE.secondMovieSeconds, []);
  return { machine, dispatch, session, movieFile, needsFile, loadingError, recoveryError, recover, persist, complete, nextBreakpoint, testingFinished };
}

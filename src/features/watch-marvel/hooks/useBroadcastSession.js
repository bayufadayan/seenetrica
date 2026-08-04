import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { PLAYER_STATES, TEST_TIMELINE } from "../constants/watch-marvel.constants";
import { localMediaService } from "../services/local-media.service";
import { watchMarvelDb } from "../services/watch-marvel-db.service";

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
    watchMarvelDb.getSession(sessionId).then(async (record) => {
      if (!record) throw new Error("Watch Marvel session was not found.");
      if (record.status === "completed") {
        if (!active) return;
        setSession(record); setNeedsFile(false); dispatch({ type: "MOVIE_ENDED" });
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
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const now = Date.now(); if (!force && now - lastPersisted.current < 5000) return;
    lastPersisted.current = now;
    const updated = await watchMarvelDb.updateSession(currentSession.id, patch);
    sessionRef.current = updated; setSession(updated);
  }, []);
  const complete = useCallback(async () => {
    const completed = await watchMarvelDb.completeSession(sessionRef.current.id);
    if (completed.mode === "watch" && completed.titleId) await watchMarvelDb.setTitleWatched(completed.titleId, true);
    sessionRef.current = completed; setSession(completed); dispatch({ type: "MOVIE_ENDED" });
  }, []);
  const nextBreakpoint = useCallback((currentTime) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return -1;
    return currentSession.commercialBreaks.findIndex((item, index) => index > currentSession.currentBreakIndex && item.status !== "completed" && currentTime >= item.atMovieSecond);
  }, []);
  const testingFinished = useCallback((currentTime) => sessionRef.current?.mode === "test" && currentTime >= TEST_TIMELINE.firstMovieSeconds + TEST_TIMELINE.secondMovieSeconds, []);
  return { machine, dispatch, session, movieFile, needsFile, loadingError, recoveryError, recover, persist, complete, nextBreakpoint, testingFinished };
}

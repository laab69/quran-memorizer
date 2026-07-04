import { createContext, useContext, useRef, useState } from 'react';
import { 
  getAllSurahs, 
  getAllVerseIndex, 
  getMemorizedVerseIds, 
  resetMemorizedVerses,
  getActiveSession,
  saveActiveSession,
  updateActiveSessionProgress,
  clearActiveSession
} from '../db/queries';

const AppStore = createContext(null);

export function AppStoreProvider({ children }) {
  const store = useRef({
    // Chapters
    chapters: [],          // all 114 surahs

    // Verse index (id + chapter_id only, all 6236)
    verseIndex: [],

    // Pre-computed surah ranges
    // { [surahId]: { first: N, last: N, count: N } }
    surahRanges: {},

    // Memorized IDs as a Set for O(1) lookup
    memorizedSet: new Set(),

    // Whether the store has been initialized
    ready: false,
  });

  const [ready, setReady] = useState(false);
  const [activeSession, setActiveSession] = useState(null);

  async function initStore() {
    const s = store.current;
    if (s.ready) return;

    // Run all bulk queries in parallel
    const [chapters, verseIndex, memorizedIds, session] = await Promise.all([
      getAllSurahs(),
      getAllVerseIndex(),
      getMemorizedVerseIds(),
      getActiveSession(),
    ]);

    s.chapters = chapters;
    s.verseIndex = verseIndex;
    s.memorizedSet = new Set(memorizedIds.map(r => typeof r === 'object' ? (r.verse_id || r.id) : r));
    setActiveSession(session);

    // Pre-compute surah ranges from verse index
    const ranges = {};
    for (const v of verseIndex) {
      if (!ranges[v.chapter_id]) {
        ranges[v.chapter_id] = { first: v.id, last: v.id, count: 0 };
      }
      if (v.id < ranges[v.chapter_id].first) ranges[v.chapter_id].first = v.id;
      if (v.id > ranges[v.chapter_id].last) ranges[v.chapter_id].last = v.id;
      ranges[v.chapter_id].count++;
    }
    s.surahRanges = ranges;

    s.ready = true;
    setReady(true);
  }

  async function resetStore() {
    await resetMemorizedVerses();
    store.current.memorizedSet = new Set();
    setReady(r => !r); // force re-render
  }

  async function saveSession(start, end, levels) {
    await saveActiveSession(start, end, levels);
    const session = await getActiveSession();
    setActiveSession(session);
  }

  async function updateSessionProgress(currentIndex, completedIndices) {
    await updateActiveSessionProgress(currentIndex, completedIndices);
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        current_level_index: currentIndex,
        completed_level_indices: completedIndices
      };
    });
  }

  async function clearSession() {
    await clearActiveSession();
    setActiveSession(null);
  }

  return (
    <AppStore.Provider value={{ 
      store: store.current, 
      initStore, 
      resetStore, 
      ready, 
      activeSession, 
      saveSession, 
      updateSessionProgress, 
      clearSession 
    }}>
      {children}
    </AppStore.Provider>
  );
}

export const useAppStore = () => useContext(AppStore);

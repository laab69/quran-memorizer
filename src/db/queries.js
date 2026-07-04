// import * as SQLite from 'expo-sqlite';
// import * as FileSystem from 'expo-file-system/legacy';
// import { Asset } from 'expo-asset';

// // ─── Database Handles ───
// let quranDb;
// let similarDb;
// let progressDb;
// let metadataDb;
// export let hizbsDb;
// export let rubusDb;

// /**
//  * Ensures databases are copied from assets to the local filesystem
//  * and initializes the database handles.
//  */
// export async function setupDatabases() {
//   const dbs = [
//     { asset: require('../../assets/db/quran.db'), name: 'quran.db' },
//     { asset: require('../../assets/db/similar.db'), name: 'similar.db' },
//     { asset: require('../../assets/db/metadata.db'), name: 'metadata.db' },
//     { asset: require('../../assets/db/hizbs.db'), name: 'hizbs.db' },
//     { asset: require('../../assets/db/rubus.db'), name: 'rubus.db' },
//   ];

//   const dbFolder = `${FileSystem.documentDirectory}SQLite/`;
//   const folderInfo = await FileSystem.getInfoAsync(dbFolder);
//   if (!folderInfo.exists) {
//     await FileSystem.makeDirectoryAsync(dbFolder, { recursive: true });
//   }

//   for (const db of dbs) {
//     const dbPath = `${dbFolder}${db.name}`;
//     const info = await FileSystem.getInfoAsync(dbPath);

//     // If the file exists but is very small (e.g. an empty SQLite shell is usually ~4KB-8KB),
//     // it means it was accidentally created empty before. We should overwrite it.
//     let shouldCopy = !info.exists;
//     if (info.exists && info.size < 12000) {
//       console.log(`${db.name} appears to be an empty shell. Forcing recopy.`);
//       await FileSystem.deleteAsync(dbPath, { idempotent: true });
//       shouldCopy = true;
//     }

//     if (shouldCopy) {
//       console.log(`Setting up ${db.name}...`);
//       const asset = await Asset.fromModule(db.asset).downloadAsync();
//       await FileSystem.copyAsync({
//         from: asset.localUri,
//         to: dbPath,
//       });
//       console.log(`Copied ${db.name} to ${dbPath}`);
//     }
//   }

//   function applyPragmas(db) {
//     db.execSync('PRAGMA journal_mode=WAL;');
//     db.execSync('PRAGMA cache_size=10000;');
//     db.execSync('PRAGMA synchronous=NORMAL;');
//     db.execSync('PRAGMA temp_store=MEMORY;');
//   }

//   // Initialize handles
//   quranDb = SQLite.openDatabaseSync('quran.db');
//   applyPragmas(quranDb);
//   similarDb = SQLite.openDatabaseSync('similar.db');
//   applyPragmas(similarDb);
//   metadataDb = SQLite.openDatabaseSync('metadata.db');
//   applyPragmas(metadataDb);
//   progressDb = SQLite.openDatabaseSync('progress.db');
//   applyPragmas(progressDb);
//   hizbsDb = SQLite.openDatabaseSync('hizbs.db');
//   rubusDb = SQLite.openDatabaseSync('rubus.db');

//   // Build verses table with absolute sequential IDs (1 to 6236)
//   try {
//     const versesExist = quranDb.getFirstSync("SELECT name FROM sqlite_master WHERE type='table' AND name='verses'");
//     // Always force rebuild once to fix the synthetic ID bug from the previous version
//     const forceRebuild = true; 
    
//     if (!versesExist || forceRebuild) {
//       console.log("Building correct verses table with sequential IDs...");
//       quranDb.execSync(`DROP TABLE IF EXISTS verses`);
      
//       quranDb.execSync(`
//         CREATE TABLE verses (
//           id INTEGER PRIMARY KEY AUTOINCREMENT,
//           chapter_id INTEGER,
//           verse_number INTEGER,
//           verse_key TEXT,
//           text_uthmani TEXT
//         )
//       `);

//       quranDb.execSync(`
//         INSERT INTO verses (chapter_id, verse_number, verse_key, text_uthmani)
//         SELECT 
//           surah as chapter_id, 
//           ayah as verse_number, 
//           (surah || ':' || ayah) as verse_key, 
//           GROUP_CONCAT(text, ' ') as text_uthmani 
//         FROM (SELECT * FROM words ORDER BY surah, ayah, word) 
//         GROUP BY surah, ayah
//         ORDER BY surah, ayah
//       `);
      
//       quranDb.execSync(`CREATE INDEX IF NOT EXISTS idx_verses_chapter ON verses(chapter_id)`);
//       quranDb.execSync(`CREATE INDEX IF NOT EXISTS idx_verses_key ON verses(verse_key)`);
//       console.log("Verses table rebuilt successfully with 1-6236 indexing.");
//     }
//   } catch (e) {
//     console.warn("Failed to build verses table:", e);
//   }

//   // Initialize progress table
//   try {
//     progressDb.execSync(`
//       CREATE TABLE IF NOT EXISTS memorized_verses (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         verse_id INTEGER UNIQUE,
//         verse_key TEXT,
//         memorized_at TEXT,
//         review_count INTEGER DEFAULT 0,
//         last_reviewed TEXT
//       );
//     `);
    
//     // Clear invalid progress data from previous synthetic IDs if needed
//     progressDb.execSync(`DELETE FROM memorized_verses WHERE verse_id > 6236`);
//   } catch (e) {
//     console.warn('Progress DB init error:', e);
//   }
// }

// // ═══════════════════════════════════════
// //  PROGRESS QUERIES (progress.db)
// // ═══════════════════════════════════════

// export const getMemorizedVerseIds = async () => {
//   try {
//     const rows = await progressDb.getAllAsync('SELECT verse_id FROM memorized_verses');
//     return rows.map(r => r.verse_id);
//   } catch (e) {
//     console.warn('getMemorizedVerseIds error:', e);
//     return [];
//   }
// };

// export const isMemorized = async (verseId) => {
//   try {
//     const row = await progressDb.getFirstAsync(
//       'SELECT id FROM memorized_verses WHERE verse_id = ?',
//       [verseId]
//     );
//     return !!row;
//   } catch (e) {
//     console.warn('isMemorized error:', e);
//     return false;
//   }
// };

// export const markAsMemorized = async (verseId, verseKey) => {
//   try {
//     await progressDb.runAsync(
//       `INSERT OR IGNORE INTO memorized_verses (verse_id, verse_key, memorized_at, review_count)
//        VALUES (?, ?, datetime('now'), 0)`,
//       [verseId, verseKey]
//     );
//   } catch (e) {
//     console.warn('markAsMemorized error:', e);
//   }
// };

// export const markAsNotMemorized = async (verseId) => {
//   try {
//     await progressDb.runAsync(
//       'DELETE FROM memorized_verses WHERE verse_id = ?',
//       [verseId]
//     );
//   } catch (e) {
//     console.warn('markAsNotMemorized error:', e);
//   }
// };

// export const incrementReviewCount = async (verseId) => {
//   try {
//     await progressDb.runAsync(
//       `UPDATE memorized_verses SET review_count = review_count + 1, last_reviewed = datetime('now') WHERE verse_id = ?`,
//       [verseId]
//     );
//   } catch (e) {
//     console.warn('incrementReviewCount error:', e);
//   }
// };

// export const getReviewCount = async (verseId) => {
//   try {
//     const row = await progressDb.getFirstAsync(
//       'SELECT review_count FROM memorized_verses WHERE verse_id = ?',
//       [verseId]
//     );
//     return row ? row.review_count : 0;
//   } catch (e) {
//     console.warn('getReviewCount error:', e);
//     return 0;
//   }
// };

// // ═══════════════════════════════════════
// //  QURAN QUERIES (quran.db & metadata.db)
// // ═══════════════════════════════════════

// // Helper to attach chapter info
// const attachChapterInfo = async (verse) => {
//   if (!verse) return null;
//   try {
//     const chapter = await metadataDb.getFirstAsync(
//       'SELECT name_arabic as surah_name_arabic, name_simple as surah_name, id as surah_number, verses_count FROM chapters WHERE id = ?',
//       [verse.chapter_id]
//     );
//     return { ...verse, ...chapter, translation: '' };
//   } catch (e) {
//     return { ...verse, translation: '' };
//   }
// };

// export const getAllVerseIndex = async () => {
//   try {
//     return await quranDb.getAllAsync('SELECT id, chapter_id FROM verses');
//   } catch (e) {
//     console.warn("getAllVerseIndex error:", e);
//     return [];
//   }
// };

// export const getAllSurahs = async () => {
//   try {
//     const chapters = await metadataDb.getAllAsync(
//       'SELECT id, name_arabic, name_simple, verses_count FROM chapters ORDER BY id'
//     );
//     return chapters;
//   } catch (e) {
//     console.warn("getAllSurahs error:", e);
//     return [];
//   }
// };

// export const getVersesForSurah = async (surahId) => {
//   try {
//     const verses = await quranDb.getAllAsync(
//       `SELECT id, verse_number, verse_key, text_uthmani, chapter_id 
//        FROM verses 
//        WHERE chapter_id = ? 
//        ORDER BY verse_number`,
//       [surahId]
//     );
//     // Return them formatted (translation is empty since no db provided)
//     return verses.map(v => ({ ...v, translation: '' }));
//   } catch (e) {
//     console.warn("getVersesForSurah error:", e);
//     return [];
//   }
// };

// export const getRandomAyahFromRange = async (verseIds, ranges = []) => {
//   if ((!verseIds || verseIds.length === 0) && (!ranges || ranges.length === 0)) return null;
//   try {
//     let whereClauses = [];
//     let params = [];

//     if (verseIds && verseIds.length > 0) {
//       whereClauses.push(`id IN (${verseIds.map(() => '?').join(',')})`);
//       params.push(...verseIds);
//     }

//     if (ranges && ranges.length > 0) {
//       ranges.forEach(r => {
//         whereClauses.push(`(id BETWEEN ? AND ?)`);
//         params.push(r.start, r.end);
//       });
//     }

//     const whereString = whereClauses.join(' OR ');

//     const verse = await quranDb.getFirstAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id 
//        FROM verses WHERE ${whereString} ORDER BY RANDOM() LIMIT 1`,
//       params
//     );
//     return attachChapterInfo(verse);
//   } catch (e) {
//     console.warn("getRandomAyahFromRange error:", e);
//     return null;
//   }
// };

// export const getAyahById = async (verseId) => {
//   try {
//     const verse = await quranDb.getFirstAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE id = ?`,
//       [verseId]
//     );
//     return attachChapterInfo(verse);
//   } catch (e) {
//     console.warn("getAyahById error:", e);
//     return null;
//   }
// };

// export const getVerseByKey = async (verseKey) => {
//   try {
//     const verse = await quranDb.getFirstAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE verse_key = ?`,
//       [verseKey]
//     );
//     return verse; // Used by mutashabihat parser, no chapter info needed
//   } catch (e) {
//     console.warn("getVerseByKey error:", e);
//     return null;
//   }
// };

// export const getFullAyahsByKeys = async (verseKeys) => {
//   if (!verseKeys || verseKeys.length === 0) return [];
//   try {
//     const placeholders = verseKeys.map(() => '?').join(',');
//     const verses = await quranDb.getAllAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id 
//        FROM verses WHERE verse_key IN (${placeholders})`,
//       verseKeys
//     );
//     // Maintain the order of the input keys if possible, or just let DB decide
//     return Promise.all(verses.map(v => attachChapterInfo(v)));
//   } catch (e) {
//     console.warn("getFullAyahsByKeys error:", e);
//     return [];
//   }
// };

// export const getNextAyah = async (surahNumber, verseNumber) => {
//   try {
//     const verse = await quranDb.getFirstAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE chapter_id = ? AND verse_number = ?`,
//       [surahNumber, verseNumber + 1]
//     );
//     return attachChapterInfo(verse);
//   } catch (e) {
//     console.warn("getNextAyah error:", e);
//     return null;
//   }
// };

// export const getPrevAyah = async (surahNumber, verseNumber) => {
//   try {
//     const verse = await quranDb.getFirstAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE chapter_id = ? AND verse_number = ?`,
//       [surahNumber, verseNumber - 1]
//     );
//     return attachChapterInfo(verse);
//   } catch (e) {
//     console.warn("getPrevAyah error:", e);
//     return null;
//   }
// };

// export const getAllHizbs = async () => {
//   try {
//     const data = await hizbsDb.getAllAsync('SELECT hizb_number as id, first_verse_key, last_verse_key FROM hizbs ORDER BY hizb_number');
//     const keysSet = [...new Set(data.flatMap(h => [h.first_verse_key, h.last_verse_key]))];
//     const placeholders = keysSet.map(() => '?').join(',');
//     const verses = await quranDb.getAllAsync(`SELECT id, verse_key FROM verses WHERE verse_key IN (${placeholders})`, keysSet);
//     const keyMap = {};
//     verses.forEach(v => { keyMap[v.verse_key] = v.id; });
    
//     return data.map(h => ({
//       ...h,
//       first_verse_id: keyMap[h.first_verse_key],
//       last_verse_id: keyMap[h.last_verse_key]
//     }));
//   } catch (e) {
//     console.warn("getAllHizbs error:", e);
//     return [];
//   }
// };

// export const getRubusForHizb = async (hizbId) => {
//   try {
//     const startId = (hizbId * 4) - 3;
//     const endId = hizbId * 4;
//     const data = await rubusDb.getAllAsync(
//       'SELECT rub_number as id, first_verse_key, last_verse_key FROM rub WHERE rub_number >= ? AND rub_number <= ? ORDER BY rub_number',
//       [startId, endId]
//     );
//     const keysSet = [...new Set(data.flatMap(r => [r.first_verse_key, r.last_verse_key]))];
//     const placeholders = keysSet.map(() => '?').join(',');
//     const verses = await quranDb.getAllAsync(`SELECT id, verse_key FROM verses WHERE verse_key IN (${placeholders})`, keysSet);
//     const keyMap = {};
//     verses.forEach(v => { keyMap[v.verse_key] = v.id; });
    
//     return data.map(r => ({
//       ...r,
//       first_verse_id: keyMap[r.first_verse_key],
//       last_verse_id: keyMap[r.last_verse_key]
//     }));
//   } catch (e) {
//     console.warn("getRubusForHizb error:", e);
//     return [];
//   }
// };

// export const searchVersesByPhrase = async (phrase, excludeVerseKey) => {
//   if (!phrase || phrase.trim().length === 0) return [];
//   try {
//     const verses = await quranDb.getAllAsync(
//       `SELECT id, verse_key, text_uthmani, chapter_id 
//        FROM verses 
//        WHERE text_uthmani LIKE '%' || ? || '%' 
//        AND verse_key != ? LIMIT 20`,
//       [phrase, excludeVerseKey || '']
//     );
    
//     return Promise.all(verses.map(v => attachChapterInfo(v)));
//   } catch (e) {
//     console.warn('searchVersesByPhrase error:', e);
//     return [];
//   }
// };

// export const getMemorizationStatsForSurah = async (surahId, memorizedIds) => {
//   try {
//     const verses = await quranDb.getAllAsync(
//       'SELECT id FROM verses WHERE chapter_id = ?',
//       [surahId]
//     );
//     const total = verses.length;
//     const verseIds = verses.map(v => v.id);
//     const memorized = verseIds.filter(id => memorizedIds.includes(id)).length;
//     return { total, memorized, verseIds };
//   } catch (e) {
//     console.warn('getMemorizationStatsForSurah error:', e);
//     return { total: 0, memorized: 0, verseIds: [] };
//   }
// };

// export const getSimilarAyahs = async (verseKey) => {
//   try {
//     // similar_ayahs table columns: verse_key, matched_ayah_key
//     const similarKeys = await similarDb.getAllAsync('SELECT matched_ayah_key FROM similar_ayahs WHERE verse_key = ?', [verseKey]);
//     if (!similarKeys || similarKeys.length === 0) return [];

//     const keys = similarKeys.map(k => k.matched_ayah_key).filter(Boolean);
//     if (keys.length === 0) return [];

//     const placeholders = keys.map(() => '?').join(',');
//     const verses = await quranDb.getAllAsync(
//       `SELECT id, verse_key, verse_number, text_uthmani, chapter_id 
//        FROM verses WHERE verse_key IN (${placeholders})`,
//       keys
//     );
    
//     return Promise.all(verses.map(v => attachChapterInfo(v)));
//   } catch (e) {
//     console.warn("getSimilarAyahs error:", e);
//     return [];
//   }
// };
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

// ─── Database Handles ───
let quranDb;
let similarDb;
let progressDb;
let metadataDb;
export let hizbsDb;
export let rubusDb;

/**
 * Ensures databases are copied from assets to the local filesystem
 * and initializes the database handles.
 */
export async function setupDatabases() {
  const dbs = [
    { asset: require('../../assets/db/quran.db'), name: 'quran.db' },
    { asset: require('../../assets/db/similar.db'), name: 'similar.db' },
    { asset: require('../../assets/db/metadata.db'), name: 'metadata.db' },
    { asset: require('../../assets/db/hizbs.db'), name: 'hizbs.db' },
    { asset: require('../../assets/db/rubus.db'), name: 'rubus.db' },
  ];

  const dbFolder = `${FileSystem.documentDirectory}SQLite/`;
  const folderInfo = await FileSystem.getInfoAsync(dbFolder);
  if (!folderInfo.exists) {
    await FileSystem.makeDirectoryAsync(dbFolder, { recursive: true });
  }

  for (const db of dbs) {
    const dbPath = `${dbFolder}${db.name}`;
    const info = await FileSystem.getInfoAsync(dbPath);

    // If the file exists but is very small, it was accidentally created empty.
    // A genuine empty SQLite shell is exactly 4096 bytes (one page).
    // We keep the threshold just above that so small-but-valid DBs (e.g. hizbs.db at 8KB)
    // are NOT mistakenly re-copied on every launch.
    let shouldCopy = !info.exists;
    if (info.exists && info.size < 5000) {
      console.log(`${db.name} appears to be an empty shell. Forcing recopy.`);
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      shouldCopy = true;
    }

    if (shouldCopy) {
      console.log(`Setting up ${db.name}...`);
      const asset = await Asset.fromModule(db.asset).downloadAsync();
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: dbPath,
      });
      console.log(`Copied ${db.name} to ${dbPath}`);
    }
  }

  function applyPragmas(db) {
    db.execSync('PRAGMA journal_mode=WAL;');
    db.execSync('PRAGMA cache_size=10000;');
    db.execSync('PRAGMA synchronous=NORMAL;');
    db.execSync('PRAGMA temp_store=MEMORY;');
  }

  // Initialize handles
  quranDb = SQLite.openDatabaseSync('quran.db');
  applyPragmas(quranDb);
  similarDb = SQLite.openDatabaseSync('similar.db');
  applyPragmas(similarDb);
  metadataDb = SQLite.openDatabaseSync('metadata.db');
  applyPragmas(metadataDb);
  progressDb = SQLite.openDatabaseSync('progress.db');
  applyPragmas(progressDb);
  hizbsDb = SQLite.openDatabaseSync('hizbs.db');
  rubusDb = SQLite.openDatabaseSync('rubus.db');

  // Build verses table with absolute sequential IDs (1 to 6236)
  try {
    const versesExist = quranDb.getFirstSync("SELECT name FROM sqlite_master WHERE type='table' AND name='verses'");
    // Always force rebuild once to fix the synthetic ID bug from the previous version
    const forceRebuild = true; 
    
    if (!versesExist || forceRebuild) {
      console.log("Building correct verses table with sequential IDs...");
      quranDb.execSync(`DROP TABLE IF EXISTS verses`);
      
      quranDb.execSync(`
        CREATE TABLE verses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapter_id INTEGER,
          verse_number INTEGER,
          verse_key TEXT,
          text_uthmani TEXT
        )
      `);

      quranDb.execSync(`
        INSERT INTO verses (chapter_id, verse_number, verse_key, text_uthmani)
        SELECT 
          surah as chapter_id, 
          ayah as verse_number, 
          (surah || ':' || ayah) as verse_key, 
          GROUP_CONCAT(text, ' ') as text_uthmani 
        FROM (SELECT * FROM words ORDER BY surah, ayah, word) 
        GROUP BY surah, ayah
        ORDER BY surah, ayah
      `);
      
      quranDb.execSync(`CREATE INDEX IF NOT EXISTS idx_verses_chapter ON verses(chapter_id)`);
      quranDb.execSync(`CREATE INDEX IF NOT EXISTS idx_verses_key ON verses(verse_key)`);
      console.log("Verses table rebuilt successfully with 1-6236 indexing.");
    }
  } catch (e) {
    console.warn("Failed to build verses table:", e);
  }

  // Initialize progress table
  try {
    progressDb.execSync(`
      CREATE TABLE IF NOT EXISTS memorized_verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verse_id INTEGER UNIQUE,
        verse_key TEXT,
        memorized_at TEXT,
        review_count INTEGER DEFAULT 0,
        last_reviewed TEXT
      );
    `);
    
    // Clear invalid progress data from previous synthetic IDs if needed
    progressDb.execSync(`DELETE FROM memorized_verses WHERE verse_id > 6236`);

    // Create table for persistent random levels session
    progressDb.execSync(`
      CREATE TABLE IF NOT EXISTS active_session (
        id INTEGER PRIMARY KEY DEFAULT 1,
        start_verse_id INTEGER,
        end_verse_id INTEGER,
        levels_data TEXT,
        current_level_index INTEGER DEFAULT 0,
        completed_level_indices TEXT
      );
    `);
  } catch (e) {
    console.warn('Progress DB init error:', e);
  }
}

// ═══════════════════════════════════════
//  PROGRESS QUERIES (progress.db)
// ═══════════════════════════════════════
export const resetMemorizedVerses = async () => {
  try {
    await progressDb.runAsync('DELETE FROM memorized_verses');
    return true;
  } catch (e) {
    console.warn('resetMemorizedVerses error:', e);
    return false;
  }
};
export const getMemorizedVerseIds = async () => {
  try {
    const rows = await progressDb.getAllAsync('SELECT verse_id FROM memorized_verses');
    return rows.map(r => r.verse_id);
  } catch (e) {
    console.warn('getMemorizedVerseIds error:', e);
    return [];
  }
};

export const isMemorized = async (verseId) => {
  try {
    const row = await progressDb.getFirstAsync(
      'SELECT id FROM memorized_verses WHERE verse_id = ?',
      [verseId]
    );
    return !!row;
  } catch (e) {
    console.warn('isMemorized error:', e);
    return false;
  }
};

export const markAsMemorized = async (verseId, verseKey) => {
  try {
    await progressDb.runAsync(
      `INSERT OR IGNORE INTO memorized_verses (verse_id, verse_key, memorized_at, review_count)
       VALUES (?, ?, datetime('now'), 0)`,
      [verseId, verseKey]
    );
  } catch (e) {
    console.warn('markAsMemorized error:', e);
  }
};

export const markAsNotMemorized = async (verseId) => {
  try {
    await progressDb.runAsync(
      'DELETE FROM memorized_verses WHERE verse_id = ?',
      [verseId]
    );
  } catch (e) {
    console.warn('markAsNotMemorized error:', e);
  }
};

export const incrementReviewCount = async (verseId) => {
  try {
    await progressDb.runAsync(
      `UPDATE memorized_verses SET review_count = review_count + 1, last_reviewed = datetime('now') WHERE verse_id = ?`,
      [verseId]
    );
  } catch (e) {
    console.warn('incrementReviewCount error:', e);
  }
};

export const getReviewCount = async (verseId) => {
  try {
    const row = await progressDb.getFirstAsync(
      'SELECT review_count FROM memorized_verses WHERE verse_id = ?',
      [verseId]
    );
    return row ? row.review_count : 0;
  } catch (e) {
    console.warn('getReviewCount error:', e);
    return 0;
  }
};

// ═══════════════════════════════════════
//  QURAN QUERIES (quran.db & metadata.db)
// ═══════════════════════════════════════

// Helper to attach chapter info
const attachChapterInfo = async (verse) => {
  if (!verse) return null;
  try {
    const chapter = await metadataDb.getFirstAsync(
      'SELECT name_arabic as surah_name_arabic, name_simple as surah_name, id as surah_number, verses_count FROM chapters WHERE id = ?',
      [verse.chapter_id]
    );
    return { ...verse, ...chapter, translation: '' };
  } catch (e) {
    return { ...verse, translation: '' };
  }
};

export const getAllVerseIndex = async () => {
  try {
    return await quranDb.getAllAsync('SELECT id, chapter_id FROM verses');
  } catch (e) {
    console.warn("getAllVerseIndex error:", e);
    return [];
  }
};

export const getAllSurahs = async () => {
  try {
    const chapters = await metadataDb.getAllAsync(
      'SELECT id, name_arabic, name_simple, verses_count FROM chapters ORDER BY id'
    );
    return chapters;
  } catch (e) {
    console.warn("getAllSurahs error:", e);
    return [];
  }
};

export const getRandomAyahFromRange = async (verseIds, ranges = []) => {
  if ((!verseIds || verseIds.length === 0) && (!ranges || ranges.length === 0)) return null;
  try {
    let whereClauses = [];
    let params = [];

    if (verseIds && verseIds.length > 0) {
      whereClauses.push(`id IN (${verseIds.map(() => '?').join(',')})`);
      params.push(...verseIds);
    }

    if (ranges && ranges.length > 0) {
      ranges.forEach(r => {
        whereClauses.push(`(id BETWEEN ? AND ?)`);
        params.push(r.start, r.end);
      });
    }

    const whereString = whereClauses.join(' OR ');

    const verse = await quranDb.getFirstAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id 
       FROM verses WHERE ${whereString} ORDER BY RANDOM() LIMIT 1`,
      params
    );
    return attachChapterInfo(verse);
  } catch (e) {
    console.warn("getRandomAyahFromRange error:", e);
    return null;
  }
};

export const getAyahById = async (verseId) => {
  try {
    const verse = await quranDb.getFirstAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE id = ?`,
      [verseId]
    );
    return attachChapterInfo(verse);
  } catch (e) {
    console.warn("getAyahById error:", e);
    return null;
  }
};

export const getVerseByKey = async (verseKey) => {
  try {
    const verse = await quranDb.getFirstAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE verse_key = ?`,
      [verseKey]
    );
    return verse; // Used by mutashabihat parser, no chapter info needed
  } catch (e) {
    console.warn("getVerseByKey error:", e);
    return null;
  }
};

export const getFullAyahsByKeys = async (verseKeys) => {
  if (!verseKeys || verseKeys.length === 0) return [];
  try {
    const placeholders = verseKeys.map(() => '?').join(',');
    const verses = await quranDb.getAllAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id 
       FROM verses WHERE verse_key IN (${placeholders})`,
      verseKeys
    );
    // Maintain the order of the input keys if possible, or just let DB decide
    return Promise.all(verses.map(v => attachChapterInfo(v)));
  } catch (e) {
    console.warn("getFullAyahsByKeys error:", e);
    return [];
  }
};

export const getNextAyah = async (surahNumber, verseNumber) => {
  try {
    const verse = await quranDb.getFirstAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE chapter_id = ? AND verse_number = ?`,
      [surahNumber, verseNumber + 1]
    );
    return attachChapterInfo(verse);
  } catch (e) {
    console.warn("getNextAyah error:", e);
    return null;
  }
};

export const getPrevAyah = async (surahNumber, verseNumber) => {
  try {
    const verse = await quranDb.getFirstAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id FROM verses WHERE chapter_id = ? AND verse_number = ?`,
      [surahNumber, verseNumber - 1]
    );
    return attachChapterInfo(verse);
  } catch (e) {
    console.warn("getPrevAyah error:", e);
    return null;
  }
};

export const getAllHizbs = async () => {
  if (!hizbsDb || !quranDb) return [];
  try {
    const data = await hizbsDb.getAllAsync('SELECT hizb_number as id, first_verse_key, last_verse_key FROM hizbs ORDER BY hizb_number');
    const keysSet = [...new Set(data.flatMap(h => [h.first_verse_key, h.last_verse_key]))];
    const placeholders = keysSet.map(() => '?').join(',');
    const verses = await quranDb.getAllAsync(`SELECT id, verse_key FROM verses WHERE verse_key IN (${placeholders})`, keysSet);
    const keyMap = {};
    verses.forEach(v => { keyMap[v.verse_key] = v.id; });
    
    return data.map(h => ({
      ...h,
      first_verse_id: keyMap[h.first_verse_key],
      last_verse_id: keyMap[h.last_verse_key]
    }));
  } catch (e) {
    console.warn("getAllHizbs error:", e);
    return [];
  }
};

export const getRubusForHizb = async (hizbId) => {
  if (!rubusDb || !quranDb) return [];
  try {
    const startId = (hizbId * 4) - 3;
    const endId = hizbId * 4;
    const data = await rubusDb.getAllAsync(
      'SELECT rub_number as id, first_verse_key, last_verse_key FROM rub WHERE rub_number >= ? AND rub_number <= ? ORDER BY rub_number',
      [startId, endId]
    );
    const keysSet = [...new Set(data.flatMap(r => [r.first_verse_key, r.last_verse_key]))];
    const placeholders = keysSet.map(() => '?').join(',');
    const verses = await quranDb.getAllAsync(`SELECT id, verse_key, verse_number, text_uthmani FROM verses WHERE verse_key IN (${placeholders})`, keysSet);
    const keyMap = {};
    verses.forEach(v => { keyMap[v.verse_key] = v.id; keyMap[v.verse_key + '_text'] = v.text_uthmani; });
    
    return data.map(r => ({
      ...r,
      first_verse_id: keyMap[r.first_verse_key],
      last_verse_id: keyMap[r.last_verse_key],
      text_uthmani: keyMap[r.first_verse_key + '_text']
    }));
  } catch (e) {
    console.warn("getRubusForHizb error:", e);
    return [];
  }
};

export const searchVersesByPhrase = async (phrase, excludeVerseKey) => {
  if (!phrase || phrase.trim().length === 0) return [];
  try {
    const verses = await quranDb.getAllAsync(
      `SELECT id, verse_number, verse_key, text_uthmani, chapter_id 
       FROM verses 
       WHERE text_uthmani LIKE '%' || ? || '%' 
       AND verse_key != ? LIMIT 20`,
      [phrase, excludeVerseKey || '']
    );
    
    return Promise.all(verses.map(v => attachChapterInfo(v)));
  } catch (e) {
    console.warn('searchVersesByPhrase error:', e);
    return [];
  }
};

export const getSimilarAyahs = async (verseKey) => {
  try {
    // similar_ayahs table columns: verse_key, matched_ayah_key
    const similarKeys = await similarDb.getAllAsync('SELECT matched_ayah_key FROM similar_ayahs WHERE verse_key = ?', [verseKey]);
    if (!similarKeys || similarKeys.length === 0) return [];

    const keys = similarKeys.map(k => k.matched_ayah_key).filter(Boolean);
    if (keys.length === 0) return [];

    const placeholders = keys.map(() => '?').join(',');
    const verses = await quranDb.getAllAsync(
      `SELECT id, verse_key, verse_number, text_uthmani, chapter_id 
       FROM verses WHERE verse_key IN (${placeholders})`,
      keys
    );
    
    return Promise.all(verses.map(v => attachChapterInfo(v)));
  } catch (e) {
    console.warn("getSimilarAyahs error:", e);
    return [];
  }
};

export const getVersesForSurah = async (surahId) => {
  if (!quranDb) return [];
  try {
    const verses = await quranDb.getAllAsync(
      `SELECT id, verse_number, verse_key, text_uthmani, chapter_id 
       FROM verses 
       WHERE chapter_id = ? 
       ORDER BY verse_number`,
      [surahId]
    );
    return verses;
  } catch (e) {
    console.warn("getVersesForSurah error:", e);
    return [];
  }
};

export const getAllRubus = async () => {
  if (!rubusDb || !quranDb) return [];
  try {
    const data = await rubusDb.getAllAsync(
      'SELECT rub_number as id, first_verse_key, last_verse_key FROM rub ORDER BY rub_number'
    );
    const keysSet = [...new Set(data.flatMap(r => [r.first_verse_key, r.last_verse_key]))];
    const placeholders = keysSet.map(() => '?').join(',');
    const verses = await quranDb.getAllAsync(
      `SELECT id, verse_key, text_uthmani FROM verses WHERE verse_key IN (${placeholders})`, 
      keysSet
    );
    const keyMap = {};
    verses.forEach(v => { 
      keyMap[v.verse_key] = v.id; 
      keyMap[v.verse_key + '_text'] = v.text_uthmani; 
    });
    
    return data.map(r => ({
      rub_number: r.id,
      first_verse_key: r.first_verse_key,
      last_verse_key: r.last_verse_key,
      first_verse_id: keyMap[r.first_verse_key],
      last_verse_id: keyMap[r.last_verse_key],
      text_uthmani: keyMap[r.first_verse_key + '_text']
    }));
  } catch (e) {
    console.warn("getAllRubus error:", e);
    return [];
  }
};

export const getRubuChunks = async (startVerseId, endVerseId) => {
  try {
    const allRubus = await getAllRubus();
    // Filter rubus that overlap with the range [startVerseId, endVerseId]
    const overlapping = allRubus.filter(r => 
      r.first_verse_id <= endVerseId && r.last_verse_id >= startVerseId
    );
    
    return overlapping.map(r => {
      const verseIds = [];
      for (let id = r.first_verse_id; id <= r.last_verse_id; id++) {
        verseIds.push(id);
      }
      return {
        rub_number: r.rub_number,
        first_verse_key: r.first_verse_key,
        last_verse_key: r.last_verse_key,
        first_verse_id: r.first_verse_id,
        last_verse_id: r.last_verse_id,
        text_uthmani: r.text_uthmani,
        verseIds,
      };
    });
  } catch (e) {
    console.warn("getRubuChunks error:", e);
    return [];
  }
};

export const saveActiveSession = async (startVerseId, endVerseId, levelsData) => {
  try {
    await progressDb.runAsync(
      `INSERT OR REPLACE INTO active_session (id, start_verse_id, end_verse_id, levels_data, current_level_index, completed_level_indices)
       VALUES (1, ?, ?, ?, 0, '[]')`,
      [startVerseId, endVerseId, JSON.stringify(levelsData)]
    );
  } catch (e) {
    console.warn('saveActiveSession error:', e);
  }
};

export const getActiveSession = async () => {
  try {
    const row = await progressDb.getFirstAsync('SELECT * FROM active_session WHERE id = 1');
    if (!row) return null;
    return {
      start_verse_id: row.start_verse_id,
      end_verse_id: row.end_verse_id,
      levels_data: JSON.parse(row.levels_data),
      current_level_index: row.current_level_index,
      completed_level_indices: JSON.parse(row.completed_level_indices),
    };
  } catch (e) {
    console.warn('getActiveSession error:', e);
    return null;
  }
};

export const updateActiveSessionProgress = async (currentLevelIndex, completedIndices) => {
  try {
    await progressDb.runAsync(
      `UPDATE active_session SET current_level_index = ?, completed_level_indices = ? WHERE id = 1`,
      [currentLevelIndex, JSON.stringify(completedIndices)]
    );
  } catch (e) {
    console.warn('updateActiveSessionProgress error:', e);
  }
};

export const clearActiveSession = async () => {
  try {
    await progressDb.runAsync('DELETE FROM active_session WHERE id = 1');
  } catch (e) {
    console.warn('clearActiveSession error:', e);
  }
};
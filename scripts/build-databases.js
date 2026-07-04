/**
 * Build Quran SQLite databases from quran.com public API
 * 
 * Creates:
 *   assets/db/quran.db       — chapters, verses, translations
 *   assets/db/similar.db     — similar ayahs (mutashabihat)
 *   assets/db/metadata.db    — chapter metadata
 *
 * Usage: node scripts/build-databases.js
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('Please install better-sqlite3 first: npm install --save-dev better-sqlite3');
  process.exit(1);
}

const DB_DIR = path.join(__dirname, '..', 'assets', 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. BUILD quran.db
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildQuranDb() {
  const dbPath = path.join(DB_DIR, 'quran.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE chapters (
      id INTEGER PRIMARY KEY,
      name_arabic TEXT,
      name_simple TEXT,
      name_complex TEXT,
      verses_count INTEGER,
      revelation_place TEXT
    );
    CREATE TABLE verses (
      id INTEGER PRIMARY KEY,
      verse_key TEXT,
      verse_number INTEGER,
      chapter_id INTEGER,
      text_uthmani TEXT,
      juz_number INTEGER,
      hizb_number INTEGER,
      page_number INTEGER
    );
    CREATE TABLE translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verse_id INTEGER,
      resource_id INTEGER DEFAULT 131,
      text TEXT
    );
    CREATE INDEX idx_verses_chapter ON verses(chapter_id);
    CREATE INDEX idx_verses_key ON verses(verse_key);
    CREATE INDEX idx_translations_verse ON translations(verse_id);
  `);

  // Fetch chapters
  console.log('Fetching chapters...');
  const chaptersData = await fetch('https://api.quran.com/api/v4/chapters?language=ar');
  const insertChapter = db.prepare(
    'INSERT INTO chapters (id, name_arabic, name_simple, name_complex, verses_count, revelation_place) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const ch of chaptersData.chapters) {
    insertChapter.run(ch.id, ch.name_arabic, ch.name_simple, ch.name_complex, ch.verses_count, ch.revelation_place);
  }
  console.log(`  ✓ ${chaptersData.chapters.length} chapters inserted`);

  // Fetch verses and translations for each chapter
  const insertVerse = db.prepare(
    'INSERT INTO verses (id, verse_key, verse_number, chapter_id, text_uthmani, juz_number, hizb_number, page_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertTranslation = db.prepare(
    'INSERT INTO translations (verse_id, resource_id, text) VALUES (?, 131, ?)'
  );

  let verseId = 0;
  for (const ch of chaptersData.chapters) {
    // Fetch uthmani text
    const versesUrl = `https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${ch.id}`;
    const versesData = await fetch(versesUrl);

    // Fetch translations (resource 131 = Sahih International)
    const transUrl = `https://api.quran.com/api/v4/quran/translations/131?chapter_number=${ch.id}`;
    const transData = await fetch(transUrl);

    const transMap = {};
    if (transData.translations) {
      for (const t of transData.translations) {
        transMap[t.verse_key] = t.text;
      }
    }

    const insertMany = db.transaction(() => {
      for (const v of versesData.verses) {
        verseId++;
        const parts = v.verse_key.split(':');
        const verseNum = parseInt(parts[1]);
        insertVerse.run(verseId, v.verse_key, verseNum, ch.id, v.text_uthmani, null, null, null);

        const transText = transMap[v.verse_key] || '';
        // Strip HTML tags from translation
        const cleanText = transText.replace(/<[^>]*>/g, '');
        insertTranslation.run(verseId, 131, cleanText);
      }
    });
    insertMany();

    process.stdout.write(`  ✓ Chapter ${ch.id}/114 — ${ch.name_simple} (${versesData.verses.length} verses)\n`);
    await sleep(200); // Rate limiting
  }

  // Now update juz/hizb/page info
  console.log('Fetching juz metadata...');
  for (let juz = 1; juz <= 30; juz++) {
    try {
      const juzData = await fetch(`https://api.quran.com/api/v4/verses/by_juz/${juz}?per_page=400&fields=verse_key,juz_number,hizb_number,page_number`);
      if (juzData.verses) {
        const updateVerse = db.prepare('UPDATE verses SET juz_number = ?, hizb_number = ?, page_number = ? WHERE verse_key = ?');
        const updateMany = db.transaction(() => {
          for (const v of juzData.verses) {
            updateVerse.run(v.juz_number, v.hizb_number, v.page_number, v.verse_key);
          }
        });
        updateMany();
      }
      process.stdout.write(`  ✓ Juz ${juz}/30\n`);
      await sleep(200);
    } catch (e) {
      console.warn(`  ⚠ Juz ${juz} fetch failed: ${e.message}`);
    }
  }

  db.close();
  console.log(`✅ quran.db created at ${dbPath} (${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. BUILD metadata.db
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildMetadataDb() {
  const dbPath = path.join(DB_DIR, 'metadata.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE chapters (
      id INTEGER PRIMARY KEY,
      name_arabic TEXT,
      name_simple TEXT,
      name_complex TEXT,
      verses_count INTEGER,
      revelation_place TEXT
    );
  `);

  const chaptersData = await fetch('https://api.quran.com/api/v4/chapters?language=ar');
  const insert = db.prepare(
    'INSERT INTO chapters (id, name_arabic, name_simple, name_complex, verses_count, revelation_place) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const ch of chaptersData.chapters) {
    insert.run(ch.id, ch.name_arabic, ch.name_simple, ch.name_complex, ch.verses_count, ch.revelation_place);
  }

  db.close();
  console.log(`✅ metadata.db created at ${dbPath}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. BUILD similar.db
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildSimilarDb() {
  const dbPath = path.join(DB_DIR, 'similar.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE similar_ayahs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verse_key TEXT,
      similar_verse_key TEXT,
      similarity_type TEXT DEFAULT 'text'
    );
    CREATE INDEX idx_similar_verse_key ON similar_ayahs(verse_key);
  `);

  // Build text similarity by scanning quran.db for shared phrases
  const quranPath = path.join(DB_DIR, 'quran.db');
  if (!fs.existsSync(quranPath)) {
    console.warn('⚠ quran.db not found, building similar.db with empty data');
    db.close();
    return;
  }

  console.log('Building similarity index from verse text...');
  const quranDb = new Database(quranPath, { readonly: true });
  const allVerses = quranDb.prepare('SELECT id, verse_key, text_uthmani FROM verses').all();

  // Build n-gram index (3-word phrases)
  const phraseMap = new Map(); // phrase -> [verse_key, ...]
  for (const v of allVerses) {
    if (!v.text_uthmani) continue;
    const words = v.text_uthmani.split(/\s+/);
    for (let i = 0; i <= words.length - 3; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (!phraseMap.has(phrase)) phraseMap.set(phrase, []);
      phraseMap.get(phrase).push(v.verse_key);
    }
  }

  // Find pairs that share 3+ word phrases
  const pairSet = new Set();
  const insert = db.prepare('INSERT INTO similar_ayahs (verse_key, similar_verse_key, similarity_type) VALUES (?, ?, ?)');
  const insertMany = db.transaction((pairs) => {
    for (const [vk1, vk2] of pairs) {
      insert.run(vk1, vk2, 'text');
    }
  });

  const pairs = [];
  for (const [phrase, keys] of phraseMap) {
    if (keys.length < 2 || keys.length > 20) continue; // Skip too common or unique
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pairKey = `${keys[i]}|${keys[j]}`;
        if (!pairSet.has(pairKey)) {
          pairSet.add(pairKey);
          pairs.push([keys[i], keys[j]]);
        }
      }
    }
  }

  insertMany(pairs);
  quranDb.close();
  db.close();
  console.log(`✅ similar.db created with ${pairs.length} pairs at ${dbPath}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RUN ALL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Building Quran databases');
  console.log('═══════════════════════════════════════\n');

  try {
    await buildQuranDb();
    console.log('');
    await buildMetadataDb();
    console.log('');
    await buildSimilarDb();
    console.log('\n═══════════════════════════════════════');
    console.log('  All databases built successfully!');
    console.log('═══════════════════════════════════════');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

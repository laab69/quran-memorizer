const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'assets', 'db', 'quran.db');

try {
  // Use a writable in-memory copy for testing or just read
  const db = new Database(dbPath, { readonly: false });
  
  db.exec(`
    DROP TABLE IF EXISTS test_verses;
    CREATE TABLE test_verses AS 
    SELECT 
      (surah * 1000 + ayah) as id, 
      surah as chapter_id, 
      ayah as verse_number, 
      (surah || ':' || ayah) as verse_key, 
      GROUP_CONCAT(text, ' ') as text_uthmani 
    FROM (SELECT * FROM words ORDER BY surah, ayah, word) 
    GROUP BY surah, ayah;
  `);

  const sample = db.prepare("SELECT * FROM test_verses WHERE verse_key = '1:1'").get();
  console.log('1:1 ->', sample.text_uthmani);
  
  const sample2 = db.prepare("SELECT * FROM test_verses WHERE verse_key = '1:2'").get();
  console.log('1:2 ->', sample2.text_uthmani);

  // Drop it to not pollute user's asset
  db.exec(`DROP TABLE test_verses;`);
  db.close();
} catch (err) {
  console.error(err);
}

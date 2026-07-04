const db = require('better-sqlite3')('assets/db/quran.db');
const row = db.prepare("SELECT text_uthmani FROM verses WHERE verse_key='2:23'").get();
console.log(row.text_uthmani.split(' ').slice(15-1, 17).join(' '));

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'assets', 'db', 'quran.db');
console.log(`Inspecting ${dbPath}...`);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\n--- TABLES ---');
  tables.forEach(t => console.log(t.name));

  for (const table of tables) {
    console.log(`\n--- SCHEMA FOR ${table.name} ---`);
    const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
    console.log(schema.map(c => `${c.name} (${c.type})`).join(', '));
    
    // Get row count
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`Row count: ${count.count}`);

    // Get 1 row sample
    const sample = db.prepare(`SELECT * FROM ${table.name} LIMIT 1`).get();
    console.log('Sample row:', sample);
  }

  db.close();
} catch (err) {
  console.error("Error reading database:", err);
}

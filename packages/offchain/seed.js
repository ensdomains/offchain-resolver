import Database from 'better-sqlite3';

const db = new Database('ensnames.db', { verbose: console.log });

const createTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS ensnames (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )
`);
createTable.run();

const seedData = () => {
  const insertItem = db.prepare('INSERT INTO ensnames (id, name) VALUES (?, ?)');

  const data = [
    { id: "0x747935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Soot' },
    { id: "0x647935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Bob' },
    { id: "0x547935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Felix' },
    { id: "0x447935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Tabby' },
    { id: "0x347935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Smithers' },
    { id: "0x247935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Ruby' },
    { id: "0x147935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Frankel' },
    { id: "0x047935C1bfA643D27AFe0F32A5357975b56B771d", name: 'Oscar' }
  ];

  data.forEach((ensnames) => {
    insertItem.run(ensnames.id, ensnames.name);
  });

  console.log('Seed data inserted successfully');
};

seedData();

db.close();
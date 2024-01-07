import fastify from 'fastify';

import Database from 'better-sqlite3';

const app = fastify();

// SQLite database
const db = new Database('ensnames.db', { verbose: console.log });

const createTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS ensnames (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )
`);
createTable.run();

app.get('/', async () => {
  return 'health ok';
});

// all names in db
app.get('/offchain-names', async (request, reply) => {
  const ensnames = db.prepare('SELECT * FROM ensnames').all();
  return ensnames;
});

// select name in db (id is tokenbound account)
app.get('/offchain-name/:id', async (request, reply) => {
  const { id } = request.params;
  const ensname = db.prepare('SELECT * FROM ensnames WHERE id = ?').get(id);
  if (!ensname) {
    return reply.code(404).send({ error: 'ENS Name not found' });
  }
  return ensname;
});

app.put('/offchain-name', async (request, reply) => {
  const { id, name } = request.body;
  if (!name || !id) return reply.code(400).send({ error: 'Id and name are required' });
  let insertNameRecord;
  insertNameRecord = db.prepare('INSERT INTO ensnames (id, name) VALUES (?, ?)');
  const result = insertItem.run(id, name);
  return { id: id || result.lastInsertRowid.toString(16), name };
});

const start = async () => {
  try {
    await app.listen({ port: 3000 });
    app.log.info(`Server is listening on ${app.server.address().port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
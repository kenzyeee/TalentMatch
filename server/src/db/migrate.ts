import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './pool.js';
const here=dirname(fileURLToPath(import.meta.url));
try { const sql=await readFile(resolve(here,'../../db/schema.sql'),'utf8'); await pool.query(sql); console.log('Database schema is up to date.'); }
finally { await pool.end(); }

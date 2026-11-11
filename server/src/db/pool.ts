import pg from 'pg';
import 'dotenv/config';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/recruitment_db', max: 15, idleTimeoutMillis: 30000 });

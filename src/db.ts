import postgres from 'postgres';

const DB_HOST = process.env.DB_HOST || 'db';
const DB_USER = process.env.POSTGRES_USER || 'admin';
const DB_PASS = process.env.POSTGRES_PASSWORD || '123';
const DB_NAME = process.env.POSTGRES_DB || 'zb-bank';

export const sql = postgres({
  host: DB_HOST,
  port: 5432,
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASS,
  max: 20,
  idle_timeout: 10,
  connect_timeout: 5,
  prepare: false,
});
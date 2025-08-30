// db.js
const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Make sure .env contains:
 * DATABASE_URL=postgresql://postgres:<PASSWORD>@<PROJECT>.supabase.co:5432/postgres
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Supabase
  },
});

pool.on('connect', () => {
  console.log('✅ Connected to Supabase PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle Supabase client', err);
  process.exit(-1);
});

module.exports = pool;

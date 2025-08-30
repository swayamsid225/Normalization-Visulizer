// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.DATABASE_URL,
  process.env.SUPABASE_ANON_KEY // Use anon key on server for JWT validation
);

module.exports = supabase;

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase URL or Anon Key in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  try {
    // A simple query to check if the connection to Supabase succeeds without altering data.
    // We try to select from a non-existent table just to see if the API responds properly.
    const { data, error } = await supabase.from('_non_existent_table').select('*').limit(1);
    
    // We expect a specific error about the table not existing, meaning the connection itself worked!
    if (error && error.code === '42P01') {
      console.log('✅ Successfully connected to Supabase project!');
      console.log('   (The API responded properly to our test query)');
    } else if (error) {
       console.log('⚠️ Connected, but received an unexpected error:', error.message);
    } else {
       console.log('✅ Successfully connected to Supabase project!');
    }
  } catch (err) {
    console.error('❌ Connection test failed. Make sure your URL and Key are correct.');
    console.error(err);
  }
}

testConnection();

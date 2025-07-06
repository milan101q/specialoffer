// Apply site_settings table migration
import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to the database');

    // Create site_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created site_settings table if it did not exist');

    // Create initial settings
    await client.query(`
      INSERT INTO site_settings (key, value, description)
      VALUES ('showListDealershipButton', 'true', 'Controls visibility of the "List Your Dealership" button on the home page')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('Added initial settings');

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await client.end();
    console.log('Disconnected from the database');
  }
}

main();
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from '.';
import config from '../../drizzle.config';

const main = async () => {
  try {
    await migrate(db, { migrationsFolder: config.out });

    console.log('Migration completed');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
};

main();

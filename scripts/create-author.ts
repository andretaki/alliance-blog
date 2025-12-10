import 'dotenv/config';
import { db } from '../src/lib/db/client';
import { authors } from '../src/lib/db/schema';

async function createAuthor() {
  const [author] = await db.insert(authors).values({
    name: 'Alliance Chemical',
    role: 'Industry Expert',
    credentials: 'Leading chemical supplier with decades of industry experience',
    bio: 'Alliance Chemical provides high-quality chemicals and expertise to businesses worldwide.'
  }).returning();
  console.log('Created author:', author.id);
  process.exit(0);
}

createAuthor().catch((e) => {
  console.error(e);
  process.exit(1);
});

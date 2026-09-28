import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { explorePlans } from '../src/db/schema';
import { VERIFIED_EXPLORE_TEMPLATES } from '../src/types/explore';
import { DEFAULT_DATABASE_URL } from '../src/db/client';

async function seedExplorePlans() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  console.log('Connecting to database...');
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
    fetch_types: false,
  });
  const db = drizzle(client, { schema: { explorePlans } });

  console.log(`Seeding ${VERIFIED_EXPLORE_TEMPLATES.length} clinical explore plans...`);

  for (const tpl of VERIFIED_EXPLORE_TEMPLATES) {
    console.log(`- Upserting plan: [${tpl.id}] "${tpl.title}" (${tpl.frequencyDays} days) by ${tpl.author.name}`);

    await db
      .insert(explorePlans)
      .values({
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        split: tpl.split,
        frequencyDays: tpl.frequencyDays,
        experienceLevel: tpl.experienceLevel,
        equipmentJson: JSON.stringify(tpl.equipment),
        jointTagsJson: JSON.stringify(tpl.jointTags),
        targetPersonasJson: JSON.stringify(tpl.targetPersonas),
        totalWeeklySets: tpl.totalWeeklySets,
        authorName: tpl.author.name,
        authorRole: tpl.author.role,
        authorVerified: tpl.author.verified,
        cloneCount: tpl.cloneCount,
        rating: tpl.rating,
        reviewsCount: tpl.reviewsCount,
        isVerified: tpl.isVerified,
        summary: tpl.summary,
        safetyNotesJson: JSON.stringify(tpl.safetyNotes ?? []),
        progressionJson: tpl.progression ? JSON.stringify(tpl.progression) : null,
        daysJson: JSON.stringify(tpl.days),
        createdAt: tpl.createdAt,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: explorePlans.id,
        set: {
          title: tpl.title,
          description: tpl.description,
          split: tpl.split,
          frequencyDays: tpl.frequencyDays,
          experienceLevel: tpl.experienceLevel,
          equipmentJson: JSON.stringify(tpl.equipment),
          jointTagsJson: JSON.stringify(tpl.jointTags),
          targetPersonasJson: JSON.stringify(tpl.targetPersonas),
          totalWeeklySets: tpl.totalWeeklySets,
          authorName: tpl.author.name,
          authorRole: tpl.author.role,
          authorVerified: tpl.author.verified,
          isVerified: tpl.isVerified,
          summary: tpl.summary,
          safetyNotesJson: JSON.stringify(tpl.safetyNotes ?? []),
          progressionJson: tpl.progression ? JSON.stringify(tpl.progression) : null,
          daysJson: JSON.stringify(tpl.days),
          updatedAt: new Date().toISOString(),
        },
      });
  }

  const count = await db.select().from(explorePlans);
  console.log(`Success! Total explore plans in database: ${count.length}`);
  await client.end();
}

seedExplorePlans().catch((err) => {
  console.error('Failed to seed explore plans:', err);
  process.exit(1);
});

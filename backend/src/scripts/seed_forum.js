import { dbConnect, query } from '../config/database.js';

const SAMPLE_TOPICS = [
  {
    title: "Air Quality Monitoring in Downtown District - Need Community Input",
    content: `I've been tracking air quality data in the downtown area and noticed concerning patterns during rush hours. Looking for community insights and experiences.

Key observations:
1. PM2.5 levels spike between 8-10 AM
2. NO2 concentration higher than usual
3. Several reports of respiratory issues

Has anyone else noticed similar patterns? What measures can we take as a community?`,
    category: "air_quality",
    tags: ["air-quality", "downtown", "monitoring", "health"],
    author_id: 1
  },
  {
    title: "Successful Community Garden Project - Lessons Learned",
    content: `Our neighborhood successfully established a community garden that improved local air quality and brought residents together. Here's what we learned:

1. Location selection is crucial
2. Start with easy-to-grow plants
3. Involve schools and local businesses
4. Regular maintenance schedule
5. Measure and track impact

Happy to share more details and help other neighborhoods start similar initiatives!`,
    category: "green_spaces",
    tags: ["community-garden", "green-spaces", "success-story"],
    author_id: 2
  },
  {
    title: "Water Quality Testing Results - River Park Area",
    content: `Recent water quality tests in River Park show improvement, but there are still concerns about industrial runoff affecting aquatic life.

Test Results:
- pH levels: 7.2 (normal)
- Dissolved oxygen: 8.5 mg/L (good)
- Turbidity: Higher than recommended
- Presence of industrial chemicals detected

We need to:
1. Identify sources of contamination
2. Work with local industries
3. Regular monitoring
4. Community awareness

Attaching detailed report in comments.`,
    category: "water_quality",
    tags: ["water-quality", "river-park", "testing", "industrial"],
    author_id: 3
  },
  {
    title: "New Environmental Policy Proposal - Public Comment Period",
    content: `The city is proposing new environmental regulations for industrial emissions. Key points:

1. Stricter PM2.5 limits
2. Real-time monitoring requirements
3. Increased penalties for violations
4. Green technology incentives

Public comment period: Nov 1 - Dec 15
Submit feedback at: [city portal]

What are your thoughts on these changes?`,
    category: "policy",
    tags: ["policy", "emissions", "public-comment", "regulations"],
    author_id: 1
  }
];

async function seed() {
  try {
    await dbConnect();
    console.log('Connected to database. Starting forum seeding...');

    // Ensure we have some test users
    for (let i = 1; i <= 3; i++) {
      await query(
        `INSERT INTO users (full_name, phone_number, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (phone_number) DO NOTHING`,
        [`Test User ${i}`, `+1234567890${i}`, `test${i}@example.com`]
      );
    }

    // Clear existing test data but keep real user data
    await query('DELETE FROM forum_votes WHERE topic_id IN (SELECT id FROM forum_topics WHERE title LIKE \'%Test%\')');
    await query('DELETE FROM forum_topic_tags WHERE topic_id IN (SELECT id FROM forum_topics WHERE title LIKE \'%Test%\')');
    await query('DELETE FROM forum_replies WHERE topic_id IN (SELECT id FROM forum_topics WHERE title LIKE \'%Test%\')');
    await query('DELETE FROM forum_topics WHERE title LIKE \'%Test%\'');

    // Insert sample topics
    for (const topic of SAMPLE_TOPICS) {
      const result = await query(
        `INSERT INTO forum_topics (title, content, category, author_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [topic.title, topic.content, topic.category, topic.author_id]
      );

      const topicId = result.rows[0].id;

      // Add tags
      for (const tag of topic.tags) {
        await query(
          `INSERT INTO forum_topic_tags (topic_id, tag_name)
           VALUES ($1, $2)`,
          [topicId, tag]
        );
      }

      // Add some test replies
      const replyCount = Math.floor(Math.random() * 5) + 2; // 2-6 replies
      for (let i = 0; i < replyCount; i++) {
        await query(
          `INSERT INTO forum_replies (topic_id, author_id, content)
           VALUES ($1, $2, $3)`,
          [topicId, Math.floor(Math.random() * 3) + 1, `Test reply ${i + 1} to topic ${topicId}`]
        );
      }

      // Add some random votes
      const upvotes = Math.floor(Math.random() * 20) + 5; // 5-25 upvotes
      const downvotes = Math.floor(Math.random() * 5); // 0-5 downvotes

      for (let i = 0; i < upvotes; i++) {
        await query(
          `INSERT INTO forum_votes (topic_id, user_id, vote_type)
           VALUES ($1, $2, 'up')
           ON CONFLICT (topic_id, user_id) DO NOTHING`,
          [topicId, Math.floor(Math.random() * 3) + 1]
        );
      }

      for (let i = 0; i < downvotes; i++) {
        await query(
          `INSERT INTO forum_votes (topic_id, user_id, vote_type)
           VALUES ($1, $2, 'down')
           ON CONFLICT (topic_id, user_id) DO NOTHING`,
          [topicId, Math.floor(Math.random() * 3) + 1]
        );
      }
    }

    console.log('✅ Forum seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding forum:', error);
    process.exit(1);
  }
}

seed();
import { dbConnect, query } from '../config/database.js';

// Simple synthetic data generator for air quality and weather
// Inserts hourly samples for the past N days for location_id = 1

const DAYS = parseInt(process.env.SEED_DAYS || '14', 10);
const LOCATION_ID = parseInt(process.env.SEED_LOCATION || '1', 10);

function randRange(min, max, decimals = 2) {
  const v = Math.random() * (max - min) + min;
  return parseFloat(v.toFixed(decimals));
}

function generatePoint(baseDate, hourOffset) {
  const timestamp = new Date(baseDate.getTime() - hourOffset * 60 * 60 * 1000);

  // Create seasonal-ish variations using sin
  const t = timestamp.getTime() / (1000 * 60 * 60);
  const basePM25 = 40 + 20 * Math.sin(t / 24 / 2);
  const pm25 = Math.max(5, randRange(basePM25 - 15, basePM25 + 30));
  const pm10 = Math.max(10, randRange(pm25 * 1.2, pm25 * 1.8));
  const no2 = randRange(10, 80);
  const so2 = randRange(5, 40);
  const o3 = randRange(10, 120);
  const co = randRange(0.2, 3.5);
  const aqi = Math.round(pm25);

  const temperature = randRange(18, 35);
  const humidity = randRange(30, 90);
  const wind_speed = randRange(0.5, 8.0);
  const pressure = randRange(980, 1025);

  return {
    air: { pm25, pm10, no2, so2, o3, co, aqi, timestamp },
    weather: { temperature, humidity, wind_speed, pressure, timestamp }
  };
}

async function seed() {
  try {
    await dbConnect();

    console.log(`Seeding last ${DAYS} days of hourly samples for location ${LOCATION_ID}...`);

    // Optionally clear existing recent data for the location (last DAYS+1 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (DAYS + 1));

  // Clear recent generated data for the target location
  await query('DELETE FROM air_quality_metrics WHERE location_id = $1 AND timestamp >= $2', [LOCATION_ID, cutoff.toISOString()]);
  await query('DELETE FROM weather_metrics WHERE location_id = $1 AND timestamp >= $2', [LOCATION_ID, cutoff.toISOString()]);

    const totalHours = DAYS * 24;
    const baseDate = new Date();

    let lastAirId = null;
    let lastWeatherId = null;

    for (let i = 0; i < totalHours; i++) {
      const point = generatePoint(baseDate, i);

      // Insert air_quality
      const airRes = await query(
        `INSERT INTO air_quality_metrics (location_id, aqi, pm25, pm10, no2, so2, o3, co, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [LOCATION_ID, point.air.aqi, point.air.pm25, point.air.pm10, point.air.no2, point.air.so2, point.air.o3, point.air.co, point.air.timestamp.toISOString()]
      );

      // Insert weather
      const weatherRes = await query(
        `INSERT INTO weather_metrics (location_id, temperature, humidity, wind_speed, pressure, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [LOCATION_ID, point.weather.temperature, point.weather.humidity, point.weather.wind_speed, point.weather.pressure, point.weather.timestamp.toISOString()]
      );

      // Keep track of the latest inserted IDs to populate real_time_metrics once
      lastAirId = airRes.rows[0].id;
      lastWeatherId = weatherRes.rows[0].id;

      if (i > 0 && i % 200 === 0) {
        console.log(`Inserted ${i} / ${totalHours} records...`);
      }
    }

    // Update real_time_metrics to point to the most recent sample
    if (lastAirId && lastWeatherId) {
      // Remove any existing row and insert a fresh mapping (schema doesn't enforce unique constraint)
      await query('DELETE FROM real_time_metrics WHERE location_id = $1', [LOCATION_ID]);
      await query(
        `INSERT INTO real_time_metrics (location_id, air_quality_id, weather_id, last_updated)
         VALUES ($1, $2, $3, $4)`,
        [LOCATION_ID, lastAirId, lastWeatherId, new Date().toISOString()]
      );
    }

    console.log('Seeding complete.');

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();

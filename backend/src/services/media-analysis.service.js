import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import exifParser from 'exif-parser';
import fetch from 'node-fetch';
import { query } from '../config/database.js';

const UPLOAD_DIR = path.resolve('./uploads');
const PYTHON_ML_SERVICE_URL = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:8001/analyze-image';

// Ensure uploads dir exists (caller may rely on it)
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

// Compute SHA256 of a buffer
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Simple average hash (aHash) implementation: resize to 8x8 grayscale
async function computeAHash(buffer) {
  const img = sharp(buffer).resize(8, 8).grayscale().raw();
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const pixels = Array.from(data); // 8*8 = 64 values
  const avg = pixels.reduce((s, v) => s + v, 0) / pixels.length;
  let bits = '';
  for (const p of pixels) bits += p > avg ? '1' : '0';
  // convert bits to hex
  const hex = parseInt(bits, 2).toString(16).padStart(16, '0');
  return hex;
}

// Compute simple entropy of grayscale image (resize small to speed up)
async function computeEntropy(buffer) {
  const img = sharp(buffer).resize(64, 64).grayscale().raw();
  const { data } = await img.toBuffer({ resolveWithObject: true });
  const pixels = Array.from(data);
  const hist = new Array(256).fill(0);
  for (const p of pixels) hist[p]++;
  const total = pixels.length;
  let entropy = 0;
  for (const h of hist) {
    if (h === 0) continue;
    const p = h / total;
    entropy -= p * Math.log2(p);
  }
  return entropy; // higher means more information
}

// Hamming distance for hex representation of hash (assumes equal length)
function hammingDistanceHex(a, b) {
  // convert hex strings to binary and compare
  const aBin = BigInt('0x' + a).toString(2).padStart(a.length * 4, '0');
  const bBin = BigInt('0x' + b).toString(2).padStart(b.length * 4, '0');
  let dist = 0;
  for (let i = 0; i < aBin.length; i++) if (aBin[i] !== bBin[i]) dist++;
  return dist;
}

// Basic scoring rules (tunable)
function scoreFromFeatures({ isDuplicate, phashDistance, width, height, entropy }) {
  let score = 0;
  if (isDuplicate) score += 80;
  if (phashDistance != null) {
    if (phashDistance <= 5) score += 60;
    else if (phashDistance <= 12) score += 30;
  }
  if (Math.min(width || 0, height || 0) < 400) score += 10;
  if (entropy < 4.0) score += 15; // low entropy (likely low-detail / spam)
  return Math.min(100, Math.round(score));
}

async function callPythonImageAnalyzer({ buffer, mime }) {
  if (!PYTHON_ML_SERVICE_URL) {
    return null;
  }

  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(PYTHON_ML_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_base64: buffer.toString('base64'),
        mime_type: mime
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      console.warn('Python ML service returned non-OK response', response.status, text);
      return null;
    }

    const payload = await response.json();
    return payload;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('Python ML service call failed:', error?.message || error);
    return null;
  }
}

export async function analyzeAndStoreImage({ base64Data, filename, userId = null }) {
  await ensureUploadDir();

  // Accept data URLs like 'data:image/jpeg;base64,...' or raw base64
  let matches = null;
  if (base64Data.startsWith('data:')) {
    matches = base64Data.match(/^data:(.+);base64,(.+)$/);
  }
  let rawBase64 = base64Data;
  let mime = 'application/octet-stream';
  if (matches) {
    mime = matches[1];
    rawBase64 = matches[2];
  }

  const buffer = Buffer.from(rawBase64, 'base64');

  const sha = sha256(buffer);
  const phash = await computeAHash(buffer).catch(() => null);
  const entropy = await computeEntropy(buffer).catch(() => null);

  // Run lightweight ML vetting via Python service
  let aiAnalysis = await callPythonImageAnalyzer({ buffer, mime }).catch(() => null);
  if (aiAnalysis && aiAnalysis.error) {
    console.warn('Python ML service returned error payload:', aiAnalysis.error);
    aiAnalysis = null;
  }

  let status = 'ok';
  let environmentScore = null;
  let aiSuspect = null;
  if (aiAnalysis) {
    environmentScore = typeof aiAnalysis.environment_score === 'number'
      ? Number(aiAnalysis.environment_score)
      : null;
    aiSuspect = typeof aiAnalysis.is_ai_generated === 'boolean' ? aiAnalysis.is_ai_generated : null;

    const decision = aiAnalysis.decision || aiAnalysis.label || 'accept';
    // Use short status tokens to fit the DB schema (status VARCHAR(20)).
    // Map verbose decisions to compact status values.
    if (decision === 'reject_non_environment') {
      status = 'rejected_non_env';
    } else if (decision === 'reject_ai_generated') {
      status = 'rejected_ai';
    } else if (decision === 'needs_review') {
      status = 'needs_review';
    }

    if (aiSuspect && status === 'ok') {
      status = 'needs_review';
    }
  }

  // Parse EXIF metadata (GPS, DateTime, etc.) when available
  let exifData = null;
  try {
    const parser = exifParser.create(buffer);
    const parsed = parser.parse();
    // Keep parsed.tags which has GPSLatitude/GPSLongitude when present
    exifData = parsed?.tags || null;
  } catch (e) {
    // Non-fatal: some images have no EXIF or parsing fails
    exifData = null;
  }

  // dimensions
  let info = {};
  try {
    info = await sharp(buffer).metadata();
  } catch (e) {
    console.warn('sharp metadata failed', e?.message || e);
  }

  const width = info.width || null;
  const height = info.height || null;
  const size = buffer.length;

  // Save file to uploads with sha prefix to avoid collisions
  const safeName = `${Date.now()}_${sha.slice(0,8)}_${filename || 'upload'}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(UPLOAD_DIR, safeName);
  await fs.writeFile(filePath, buffer).catch((e) => { console.warn('Failed to write upload file:', e?.message || e); });

  // Check duplicates by sha or phash similarity
  let isDuplicate = false;
  let duplicate_of_asset_id = null;
  try {
    const resSha = await query('SELECT asset_id FROM media_features WHERE sha256 = $1 LIMIT 1', [sha]);
    if (resSha.rows.length > 0) {
      isDuplicate = true;
      duplicate_of_asset_id = resSha.rows[0].asset_id;
    }
  } catch (e) {
    console.warn('Duplicate SHA check failed', e?.message || e);
  }

  let phashDistance = null;
  if (!isDuplicate && phash) {
    try {
      const resPhash = await query('SELECT asset_id, phash FROM media_features WHERE phash IS NOT NULL');
      for (const r of resPhash.rows) {
        const other = r.phash;
        if (!other) continue;
        const dist = hammingDistanceHex(phash, other);
        if (dist <= 10) {
          isDuplicate = true;
          duplicate_of_asset_id = r.asset_id;
          phashDistance = dist;
          break;
        }
        // record best distance if not duplicate
        if (phashDistance == null || dist < phashDistance) phashDistance = dist;
      }
    } catch (e) {
      console.warn('Phash comparison failed', e?.message || e);
    }
  }

  const spam_score = scoreFromFeatures({ isDuplicate, phashDistance, width, height, entropy });

  // If image entropy is extremely low (e.g., fully black or near-constant), treat as non-environmental spam
  if (entropy != null && entropy < 0.5) {
    console.log('[media-analysis] very low entropy detected, marking as non-environmental');
    spam_score = 100; // override to max spam
    status = 'rejected_non_env';
  }

  // Ensure status fits DB column (VARCHAR(20)). Truncate defensively and log if truncation occurs.
  try {
    if (typeof status === 'string' && status.length > 20) {
      console.warn(`[media-analysis] truncating status from length ${status.length} to 20 chars`);
      status = status.slice(0, 20);
    }
  } catch (sErr) {
    console.warn('[media-analysis] failed to normalize status before insert', sErr?.message || sErr);
  }

  // Insert into DB
  const assetId = `asset_${Date.now()}_${sha.slice(0,8)}`;
  try {
    const insert = await query(
      `INSERT INTO media_features (
         asset_id, user_id, filename, url, sha256, phash, width, height, size,
         exif, blur_score, entropy, duplicate_of_asset_id, spam_score,
         status, analysis, environment_score, ai_suspect, last_checked_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        assetId,
        userId,
        filename || safeName,
        filePath,
        sha,
        phash,
        width,
        height,
        size,
        exifData ? JSON.stringify(exifData) : null,
        null,
        entropy,
        duplicate_of_asset_id,
        spam_score,
        status,
        aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        environmentScore,
        aiSuspect,
        new Date()
      ]
    );
    return { success: true, asset: insert.rows[0] };
  } catch (e) {
    console.error('Failed to insert media_features row', e?.message || e);
    return { success: false, error: e?.message || String(e) };
  }
}

export default {
  analyzeAndStoreImage
};

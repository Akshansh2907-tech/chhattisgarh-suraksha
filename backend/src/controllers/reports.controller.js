// Lazy import blockchain service to avoid startup failures when optional deps (like ethers) are missing
let blockchain;
import UserActivityService from '../services/user-activity.service.js';
import { query } from '../config/database.js';
import Gamification from '../models/gamification.js';

export async function submitReport(req, res) {
  try {
    // Debug: log a short summary of incoming submit requests to help trace submission failures.
    try {
      const bodyKeys = req.body ? Object.keys(req.body) : [];
      console.log('[submitReport] incoming request summary:', {
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
        bodyKeys,
        // Print a small sample of the body (avoid extremely large dumps)
        bodySample: req.body ? JSON.stringify(req.body).slice(0, 1000) : null
      });
    } catch (logErr) {
      console.warn('[submitReport] failed to log request summary', logErr?.message || logErr);
    }
    const { issueType, description, severity, keywords, location, photoHash, additionalData } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to submit reports' });
    }
    if (!issueType || !description || !location || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure all required tables exist
    await Gamification.createTables();
    await UserActivityService.createTables();
    
    // Ensure reports table exists (lightweight migration)
    await query(`
      CREATE TABLE IF NOT EXISTS reports (
        id BIGSERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id),
        issue_type TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        keywords TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        address TEXT,
        photo_hash JSONB,
        additional_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'reported'
      )
    `);
      // Ensure status column exists for older DBs
      await query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'reported'`);

    // Start a database transaction
    await query('BEGIN');

    try {
      // Parse and validate location
      const latRaw = location?.latitude ?? location?.lat ?? null;
      const lonRaw = location?.longitude ?? location?.lng ?? null;
      const lat = latRaw != null ? Number(latRaw) : null;
      const lon = lonRaw != null ? Number(lonRaw) : null;
      const addr = location?.address ?? location?.display_name ?? null;

      // Validate coordinates
      if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
        throw new Error('Invalid location coordinates');
      }

      // Validate coordinates are within Chhattisgarh bounds
      if (lat < 17.46 || lat > 24.45 || lon < 80.15 || lon > 84.24) {
        throw new Error('Location outside Chhattisgarh region');
      }

    // Safely parse potentially-string JSON fields. Don't throw on malformed input.
    let parsedPhotoHash = null;
    if (photoHash) {
      try {
        parsedPhotoHash = typeof photoHash === 'string' ? JSON.parse(photoHash) : photoHash;
      } catch (e) {
        console.warn('Warning: failed to parse photoHash JSON, storing raw value as text', e?.message || e);
        parsedPhotoHash = photoHash;
      }
    }

    let parsedAdditionalData = null;
    if (additionalData) {
      try {
        parsedAdditionalData = typeof additionalData === 'string' ? JSON.parse(additionalData) : additionalData;
      } catch (e) {
        console.warn('Warning: failed to parse additionalData JSON, storing raw value as text', e?.message || e);
        parsedAdditionalData = additionalData;
      }
    }

    // Ensure JSONB parameters are valid JSON strings or null to avoid "invalid input syntax for type json" errors.
    const dbPhotoHash = parsedPhotoHash == null ? null : (typeof parsedPhotoHash === 'string' ? parsedPhotoHash : JSON.stringify(parsedPhotoHash));
    const dbAdditionalData = parsedAdditionalData == null ? null : (typeof parsedAdditionalData === 'string' ? parsedAdditionalData : JSON.stringify(parsedAdditionalData));

    console.log('[submitReport] inserting report with:', {
      userId,
      issueType,
      severity,
      keywordsPreview: (keywords || '').slice(0, 200),
      lat,
      lon,
      addrPreview: String(addr).slice(0, 200),
      photoHashType: typeof dbPhotoHash,
      additionalDataType: typeof dbAdditionalData
    });

    const insertRes = await query(
      `INSERT INTO reports (reporter_id, issue_type, description, severity, keywords, latitude, longitude, address, photo_hash, additional_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [userId, issueType, description, severity, keywords || null, lat, lon, addr, dbPhotoHash, dbAdditionalData]
    );

    const reportId = insertRes.rows[0].id;

    // If any associated media assets were uploaded, validate their status before continuing.
    const assetIds = Array.isArray(parsedPhotoHash) ? parsedPhotoHash : (parsedPhotoHash ? [parsedPhotoHash] : []);
    let unverifiedMedia = false;
    if (assetIds.length > 0) {
      try {
        // Also fetch environment_score and spam_score so we can make an immediate decision
        const mediaRes = await query(
          `SELECT asset_id, status, ai_suspect, environment_score, spam_score
             FROM media_features
            WHERE asset_id = ANY($1::text[])`,
          [assetIds]
        );

        // If some asset IDs referenced by the client don't exist in media_features, treat them as unverified.
        if (mediaRes.rows.length !== assetIds.length) {
          console.log('[submitReport] some assetIds were not found in media_features — treating as unverified_media');
          unverifiedMedia = true;
          // mark the report for moderation but don't immediately reject it; points will be withheld below
          await query(`UPDATE reports SET status = 'unverified_media' WHERE id = $1`, [reportId]);
        }

  // Immediate high-confidence AI detection: if any media row has ai_suspect flag set,
  // treat as rejected and apply penalty immediately.
  console.log('[submitReport] media features rows for assets:', mediaRes.rows);
  const aiDetected = mediaRes.rows.find(row => row.ai_suspect === true);
        const rejectedMedia = mediaRes.rows.find(row => row.status && row.status.startsWith('rejected'));

        // Also treat very low environment_score as a non-environment image (defensive)
        const nonEnvDetected = mediaRes.rows.find(row => row.environment_score != null && Number(row.environment_score) < 0.2);

        if (aiDetected || rejectedMedia || nonEnvDetected) {
          const offender = aiDetected || rejectedMedia || nonEnvDetected;
          const penaltyPoints = 20;
          // Determine whether this is an AI-based rejection using ai_suspect or status tokens
          const isAi = (aiDetected != null) || (offender && (offender.status === 'rejected_ai' || offender.status === 'rejected_ai_generated' || offender.ai_suspect === true));
          const penaltyType = isAi ? 'report_rejected_media_ai' : 'report_rejected_media_non_env';
          const rejectionReason = isAi ? 'AI-generated image detected' : 'Uploaded image does not depict an environmental scenario';

          await query(`UPDATE reports SET status = 'rejected_media' WHERE id = $1`, [reportId]);

          await query(
            `INSERT INTO user_stats (user_id)
             VALUES ($1)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
          );

          await query(
            `UPDATE user_stats
                SET updated_at = CURRENT_TIMESTAMP,
                    last_active = CURRENT_TIMESTAMP,
                    reports_submitted = GREATEST(COALESCE(reports_submitted, 0) - 1, 0)
              WHERE user_id = $1`,
            [userId]
          );

          await query(
            `INSERT INTO user_activity_points (user_id, activity_type, points, reference_id)
             VALUES ($1,$2,$3,$4)`,
            [userId, penaltyType, -penaltyPoints, reportId]
          );

          await query('COMMIT');

          return res.status(422).json({
            success: false,
            reportId,
            status: 'rejected_media',
            error: rejectionReason
          });
        }
      } catch (mediaErr) {
        console.warn('Media validation failed during submitReport:', mediaErr?.message || mediaErr);
      }
    }

    // Submit to blockchain (include report id in metadata). Don't fail DB insert if blockchain fails.
    let txHash = null;
    try {
      if (!blockchain) blockchain = await import('../services/blockchain.service.js');
      txHash = await blockchain.submitReportToChain({
        reportId,
        issueType,
        description,
        severity,
        keywords: keywords || '',
        location: `${lat},${lon}|${addr || ''}`,
        photoHash: photoHash || '',
        additionalData: additionalData || ''
      });
    } catch (chainErr) {
      console.error('Blockchain submission failed or optional deps missing, continuing with DB record:', chainErr?.message || chainErr);
      // continue without failing the response — blockchain may be unavailable in some environments
    }
    // Record activity and update gamification WITHIN this transaction to avoid nested transactions
    let pointsAwarded = 0;
    try {
      // Calculate points based on report details using the service helper
      try {
        pointsAwarded = UserActivityService.calculateReportPoints({
          description,
          severity,
          photoHash: parsedPhotoHash,
          keywords,
          additionalData: parsedAdditionalData
        });
      } catch (calcErr) {
        console.warn('Failed to calculate report points, defaulting to base points', calcErr?.message || calcErr);
        pointsAwarded = 10;
      }

      // Ensure user_stats exists and increment reports_submitted
      await query(
        `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      await query(
        `UPDATE user_stats SET reports_submitted = COALESCE(reports_submitted,0) + 1, last_active = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [userId]
      );

      // If any media was unverified (client-side fallback/local-only) withhold points to avoid rewarding unvetted uploads
      if (unverifiedMedia) {
        console.log('[submitReport] withholding points because some media assets are unverified');
        pointsAwarded = 0;
      }

      // Insert points record
      await query(
        `INSERT INTO user_activity_points (user_id, activity_type, points, reference_id) VALUES ($1, $2, $3, $4)`,
        [userId, 'report_submitted', pointsAwarded, reportId]
      );

      // Update achievements (uses separate queries; safe to call)
      try {
        await UserActivityService.updateAchievements(userId);
      } catch (achErr) {
        console.warn('Failed to update achievements:', achErr?.message || achErr);
      }

      // Light spam/media checks: if the report included media asset IDs, aggregate their spam_score
      try {
        const assetIds = Array.isArray(parsedPhotoHash) ? parsedPhotoHash : (parsedPhotoHash ? [parsedPhotoHash] : []);
        if (assetIds.length > 0) {
          const spamRes = await query(`SELECT AVG(spam_score) AS avg_score FROM media_features WHERE asset_id = ANY($1::text[])`, [assetIds]);
          const avgScore = Number(spamRes.rows?.[0]?.avg_score) || 0;
          console.log('[submitReport] media avg spam score:', avgScore);
          const SPAM_THRESHOLD = 80; // configurable
          if (avgScore >= SPAM_THRESHOLD) {
            console.log('[submitReport] Flagging report as suspected_spam due to media analysis');
            await query(`UPDATE reports SET status = 'suspected_spam' WHERE id = $1`, [reportId]);
            // If points were awarded previously for this report, insert a negative adjustment
            if (pointsAwarded && pointsAwarded > 0) {
              await query(
                `INSERT INTO user_activity_points (user_id, activity_type, points, reference_id) VALUES ($1,$2,$3,$4)`,
                [userId, 'report_spam_penalty', -pointsAwarded, reportId]
              );
              // Zero out pointsAwarded for response
              pointsAwarded = 0;
            }
          }
        }
      } catch (spErr) {
        console.warn('Failed to run media spam checks:', spErr?.message || spErr);
      }

    } catch (e) {
      console.error('Failed to record activity in submitReport:', e?.message || e);
      // proceed — still return success for the report insert
    }

    // Commit transaction and return success with points awarded
    await query('COMMIT');
    res.json({ 
      success: true, 
      txHash, 
      reportId,
      pointsAwarded 
    });
    } catch (innerErr) {
      await query('ROLLBACK');
      throw innerErr;
    }
  } catch (err) {
    // Log full error for debugging
    console.error('Failed to submit report:', err?.stack || err);

    // Send appropriate error message based on error type
    if (err.message.includes('Invalid location coordinates')) {
      res.status(400).json({ error: 'Invalid location coordinates provided' });
    } else if (err.message.includes('outside Chhattisgarh')) {
      res.status(400).json({ error: 'Location must be within Chhattisgarh region' });
    } else {
      // In development return the actual error message to help debug client-side
      res.status(500).json({ error: err?.message || 'Failed to submit report' });
    }
  }
  }

export async function getAllReports(req, res) {
  try {
    // Get bounds from query parameters if provided
    const { bounds } = req.query;
    let boundsFilter = '';
    let boundsParams = [];

    if (bounds) {
      try {
        const [swLat, swLng, neLat, neLng] = bounds.split(',').map(Number);
        if (!isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng)) {
          boundsFilter = `AND r.latitude BETWEEN $1 AND $2 AND r.longitude BETWEEN $3 AND $4`;
          boundsParams = [swLat, neLat, swLng, neLng];
        }
      } catch (e) {
        console.warn('Invalid bounds parameter:', e);
      }
    }

    // Query with optional bounds filter
    const dbRes = await query(
      `SELECT 
         r.id, 
         r.reporter_id, 
         u.full_name AS reporter_name, 
         r.status,
         r.issue_type, 
         r.description, 
         r.severity, 
         r.keywords,
         r.latitude, 
         r.longitude, 
         r.address, 
         r.photo_hash, 
         r.additional_data,
         EXTRACT(EPOCH FROM r.created_at) AS timestamp
       FROM reports r 
       LEFT JOIN users u ON r.reporter_id = u.id 
       WHERE 1=1 ${boundsFilter}
       ORDER BY r.created_at DESC`,
      boundsParams
    );

    if (dbRes.rows && dbRes.rows.length > 0) {
      const rows = dbRes.rows.map(r => ({
        id: r.id,
        reporter_id: r.reporter_id,
         status: r.status || 'reported',
        reporter_name: r.reporter_name,
        issueType: r.issue_type,
        description: r.description,
        severity: r.severity,
        keywords: r.keywords,
        location: {
          latitude: r.latitude,
          longitude: r.longitude,
          address: r.address || '',
          display: r.latitude != null && r.longitude != null ? 
            `${r.latitude},${r.longitude}${r.address ? ` | ${r.address}` : ''}` : 
            (r.address || '')
        },
        photoHash: r.photo_hash,
        additionalData: r.additional_data,
        timestamp: Number(r.timestamp)
      }));
      
      return res.json({ 
        success: true, 
        data: rows,
        metadata: {
          total: rows.length,
          bounds: bounds ? {
            sw: { lat: boundsParams[0], lng: boundsParams[2] },
            ne: { lat: boundsParams[1], lng: boundsParams[3] }
          } : null
        }
      });
    }

    // If DB empty, fall back to blockchain stored reports (lazy import, ignore if not available)
    let reports = [];
    try {
      if (!blockchain) blockchain = await import('../services/blockchain.service.js');
      reports = await blockchain.getAllReportsFromChain();
    } catch (chainErr) {
      console.warn('Blockchain not available for fallback reports:', chainErr?.message || chainErr);
      reports = [];
    }
    
    // Transform blockchain reports to match DB format
    const transformedReports = reports.map(r => {
      const [coords, addr] = (r.location || '').split('|');
      const [lat, lon] = (coords || '').split(',').map(Number);
      
      return {
        ...r,
        location: {
          latitude: lat || null,
          longitude: lon || null,
          address: addr || '',
          display: r.location || ''
        }
      };
    });

    res.json({ 
      success: true, 
      data: transformedReports,
      metadata: {
        total: transformedReports.length,
        source: 'blockchain'
      }
    });
  } catch (err) {
    console.error('Failed to fetch reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
  }

// GET /summary/pollution-sources
export async function getPollutionSources(req, res) {
  try {
    const { duration = '7d' } = req.query;
    // Map allowed duration tokens to safe SQL interval literals
    const durationMap = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    };
    const intervalLiteral = durationMap[duration] || durationMap['7d'];
    // Aggregate issue_type counts in the given duration
    const result = await query(
      `SELECT issue_type, COUNT(*)::int as count
       FROM reports
       WHERE created_at > NOW() - INTERVAL '${intervalLiteral}'
       GROUP BY issue_type
       ORDER BY count DESC`
    );

    // Map friendly names if necessary
    const data = result.rows.map(r => ({
      source: r.issue_type,
      value: r.count
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Failed to fetch pollution sources:', err);
    res.status(500).json({ error: 'Failed to fetch pollution sources' });
  }
}

// Update report status (municipality employees)
export async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, resolutionMedia } = req.body;
    const allowed = ['reported', 'investigating', 'action_ongoing', 'resolved', 'rejected_media', 'suspected_spam', 'unverified_media'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    // Ensure reports table exists
    await query(`CREATE TABLE IF NOT EXISTS reports (id BIGSERIAL PRIMARY KEY)`);

    // Ensure caller is municipality employee (best-effort)
    try {
      const emp = await query('SELECT 1 FROM employees WHERE user_id = $1 LIMIT 1', [req.user.userId]);
      if (emp.rows.length === 0) {
        return res.status(403).json({ error: 'Only municipality employees may update report status' });
      }
    } catch (e) {
      // If employees table missing, deny to be safe
      return res.status(403).json({ error: 'Only municipality employees may update report status' });
    }

    // If marking as resolved, require evidence media from the employee
    if (status === 'resolved') {
      if (!resolutionMedia || !Array.isArray(resolutionMedia) || resolutionMedia.length === 0) {
        return res.status(400).json({ error: 'Employee must submit at least one image/video when marking resolved' });
      }
    }

    await query('UPDATE reports SET status = $1 WHERE id = $2', [status, id]);

    // If resolved and resolutionMedia provided, store them in a table
    if (status === 'resolved') {
      // create resolutions table if missing
      await query(`
        CREATE TABLE IF NOT EXISTS report_resolutions (
          id SERIAL PRIMARY KEY,
          report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
          submitted_by INTEGER REFERENCES users(id),
          media JSONB,
          created_at TIMESTAMP DEFAULT now()
        )
      `);
      await query('INSERT INTO report_resolutions (report_id, submitted_by, media) VALUES ($1, $2, $3)', [id, req.user.userId, JSON.stringify(resolutionMedia)]);
    }

    return res.json({ success: true, id: Number(id), status });
  } catch (err) {
    console.error('Failed to update report status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

// Assign a report to an employee (store assignment record)
export async function assignReport(req, res) {
  try {
    const { id } = req.params;
    const { assigneeName, assigneePhone, assigneeEmployeeId } = req.body;
    if (!assigneeName || !assigneeEmployeeId) return res.status(400).json({ error: 'Assignee name and employeeId are required' });

    // Create assignments table if missing
    await query(`
      CREATE TABLE IF NOT EXISTS report_assignments (
        id SERIAL PRIMARY KEY,
        report_id BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id),
        assignee_name TEXT NOT NULL,
        assignee_phone TEXT,
        assignee_employee_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Only municipality employees can assign
    try {
      const emp = await query('SELECT 1 FROM employees WHERE user_id = $1 LIMIT 1', [req.user.userId]);
      if (emp.rows.length === 0) return res.status(403).json({ error: 'Only municipality employees may assign tasks' });
    } catch (e) {
      return res.status(403).json({ error: 'Only municipality employees may assign tasks' });
    }

    const insert = await query(
      `INSERT INTO report_assignments (report_id, assigned_by, assignee_name, assignee_phone, assignee_employee_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [id, req.user.userId, assigneeName, assigneePhone || null, assigneeEmployeeId]
    );

    return res.json({ success: true, assignmentId: insert.rows[0].id });
  } catch (err) {
    console.error('Failed to assign report:', err);
    res.status(500).json({ error: 'Failed to assign report' });
  }
}

// Add an internal note for a report
export async function addReportNote(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Note is required' });

    await query(`
      CREATE TABLE IF NOT EXISTS report_notes (
        id SERIAL PRIMARY KEY,
        report_id BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES users(id),
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Only municipality employees can add notes
    try {
      const emp = await query('SELECT 1 FROM employees WHERE user_id = $1 LIMIT 1', [req.user.userId]);
      if (emp.rows.length === 0) return res.status(403).json({ error: 'Only municipality employees may add notes' });
    } catch (e) {
      return res.status(403).json({ error: 'Only municipality employees may add notes' });
    }

    const insert = await query(
      `INSERT INTO report_notes (report_id, author_id, note) VALUES ($1,$2,$3) RETURNING id, created_at`,
      [id, req.user.userId, note]
    );

    return res.json({ success: true, noteId: insert.rows[0].id, createdAt: insert.rows[0].created_at });
  } catch (err) {
    console.error('Failed to add report note:', err);
    res.status(500).json({ error: 'Failed to add note' });
  }
}

// GET /summary/weekly-reports
export async function getWeeklyReports(req, res) {
  try {
    // Last 7 days
    const result = await query(
      `SELECT to_char(created_at::date, 'Dy') as day_label,
              COUNT(*)::int as reports,
              SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::int as resolved
       FROM reports
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY created_at::date
       ORDER BY MIN(created_at)
       LIMIT 7`
    );

    // Normalize to 7 days sequence (Mon..Sun) - but return rows as-is for now
    const data = result.rows.map(r => ({ day: r.day_label, reports: r.reports, resolved: r.resolved }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Failed to fetch weekly reports:', err);
    res.status(500).json({ error: 'Failed to fetch weekly reports' });
  }
}

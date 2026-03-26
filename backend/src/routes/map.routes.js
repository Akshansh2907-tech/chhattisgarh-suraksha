import express from 'express';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get report markers for map
router.get('/markers', async (req, res) => {
  try {
    const { bounds, filters } = req.query;
    let boundsFilter = '';
    let boundsParams = [];
    let typeFilter = '';
    let severityFilter = '';
    let params = [];

    // Parse map bounds if provided
    if (bounds) {
      try {
        const [swLat, swLng, neLat, neLng] = bounds.split(',').map(Number);
        if (!isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng)) {
          boundsFilter = `AND latitude BETWEEN $${params.length + 1} AND $${params.length + 2} 
                         AND longitude BETWEEN $${params.length + 3} AND $${params.length + 4}`;
          params.push(swLat, neLat, swLng, neLng);
        }
      } catch (e) {
        console.warn('Invalid bounds parameter:', e);
      }
    }

    // Parse filters if provided
    if (filters) {
      try {
        const { issueTypes, severities } = JSON.parse(filters);
        if (Array.isArray(issueTypes) && issueTypes.length > 0) {
          typeFilter = `AND issue_type = ANY($${params.length + 1}::text[])`;
          params.push(issueTypes);
        }
        if (Array.isArray(severities) && severities.length > 0) {
          severityFilter = `AND severity = ANY($${params.length + 1}::text[])`;
          params.push(severities);
        }
      } catch (e) {
        console.warn('Invalid filters:', e);
      }
    }

    // Query markers with filters
    const result = await query(
      `SELECT 
         id,
         issue_type,
         severity,
         latitude,
         longitude,
         address,
         created_at
       FROM reports 
       WHERE latitude IS NOT NULL 
         AND longitude IS NOT NULL
         ${boundsFilter}
         ${typeFilter}
         ${severityFilter}
       ORDER BY created_at DESC`,
      params
    );

    // Group markers by type for efficient rendering
    const groupedMarkers = result.rows.reduce((acc, row) => {
      const type = row.issue_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push({
        id: row.id,
        position: {
          lat: row.latitude,
          lng: row.longitude
        },
        title: row.issue_type,
        severity: row.severity,
        address: row.address,
        timestamp: row.created_at
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedMarkers,
      metadata: {
        total: result.rows.length,
        bounds: bounds ? {
          sw: { lat: params[0], lng: params[2] },
          ne: { lat: params[1], lng: params[3] }
        } : null,
        filters: filters ? JSON.parse(filters) : null
      }
    });
  } catch (err) {
    console.error('Failed to fetch map markers:', err);
    res.status(500).json({ error: 'Failed to fetch map markers' });
  }
});

// Get marker details by ID
router.get('/markers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT 
         r.*,
         u.full_name as reporter_name
       FROM reports r
       LEFT JOIN users u ON r.reporter_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Marker not found' });
    }

    const report = result.rows[0];
    res.json({
      success: true,
      data: {
        id: report.id,
        issueType: report.issue_type,
        description: report.description,
        severity: report.severity,
        reporter: {
          id: report.reporter_id,
          name: report.reporter_name
        },
        location: {
          latitude: report.latitude,
          longitude: report.longitude,
          address: report.address
        },
        metadata: {
          keywords: report.keywords,
          photoHash: report.photo_hash,
          additionalData: report.additional_data
        },
        timestamp: report.created_at
      }
    });
  } catch (err) {
    console.error('Failed to fetch marker details:', err);
    res.status(500).json({ error: 'Failed to fetch marker details' });
  }
});

export default router;
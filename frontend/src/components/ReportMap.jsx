import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import Icon from './AppIcon';

const ReportMap = ({ reports = [], center = [21.2787, 81.8661], zoom = 12, onMarkerClick = null }) => {
  useEffect(() => {
    // Initialize map
    const map = L.map('reportMap').setView(center, zoom);

    // Add OpenStreetMap tile layer with referrerPolicy and crossOrigin to reduce referrer warnings
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
      // Ensure CORS-friendly requests and proper referrer policy for tile servers
      crossOrigin: true,
      referrerPolicy: 'no-referrer-when-downgrade'
    }).addTo(map);

    // Create custom markers for each issue type
    reports.forEach(report => {
      const type = getIssueTypeInfo(report.issueType);

      // resolve coordinates (reports may have coordinates or location string)
      let lat = null;
      let lon = null;
      if (report.coordinates) {
        lat = Number(report.coordinates.lat);
        lon = Number(report.coordinates.lon);
      } else if (report.location?.latitude || report.location?.longitude) {
        lat = Number(report.location.latitude);
        lon = Number(report.location.longitude || report.location.lon);
      } else if (typeof report.location === 'string') {
        const loc = report.location.split('|')[0];
        const parts = loc.split(',').map(Number);
        if (parts.length >= 2) {
          lat = parts[0]; lon = parts[1];
        }
      }

      // Validate coordinates (not null/NaN/infinite and within lat/lng ranges)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;

      // Use a simple colored circle as a marker (SVG) so we don't depend on external icon libs
      const svgLabel = type.emoji ? type.emoji : type.name.charAt(0);
      const svg = `
        <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="14" r="10" fill="${type.color}" stroke="#fff" stroke-width="2" />
          <text x="18" y="20" font-size="14" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif">${svgLabel}</text>
        </svg>
      `;

      const customIcon = L.divIcon({
        html: `<div class=\"report-marker-wrapper\">${svg}</div>`,
        className: 'custom-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      // Create marker with custom icon
      const marker = L.marker([lat, lon], { icon: customIcon });

      // Build popup content (escape data lightly)
      const shortDesc = report.description ? (report.description.length > 120 ? report.description.substring(0, 117) + '...' : report.description) : '';
      const reportedAt = report.timestamp ? new Date(report.timestamp * 1000).toLocaleString() : (report.created_at ? new Date(report.created_at).toLocaleString() : 'Unknown');
      const reporter = report.reporter_name || report.reporter || report.reporter_id || 'Anonymous';

      // Escape HTML to avoid broken popup rendering when report data contains HTML-sensitive chars
      const escapeHTML = (str) => {
        if (str == null) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const popupContent = `
        <div class="report-popup">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${type.color}"></div>
              <strong>${escapeHTML(type.name)}</strong>
            </div>
            <div class="priority-badge" style="padding:2px 8px;border-radius:12px;font-size:11px;background:${report.severity === 'high' ? '#FEE2E2' : report.severity === 'medium' ? '#FEF3C7' : '#ECFDF5'};color:${report.severity === 'high' ? '#DC2626' : report.severity === 'medium' ? '#D97706' : '#059669'}">
              ${report.severity ? report.severity.charAt(0).toUpperCase() + report.severity.slice(1) : 'Low'} Priority
            </div>
          </div>
          <div style="font-size:13px;margin-bottom:6px;line-height:1.4">${escapeHTML(shortDesc)}</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
            <div style="font-size:12px;color:#6b7280;">
              <span style="color:#4B5563">Reporter:</span> ${escapeHTML(reporter)}
            </div>
            <div style="font-size:12px;color:#6b7280;">
              <span style="color:#4B5563">Reported:</span> ${escapeHTML(reportedAt)}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <a href="/reports/${encodeURIComponent(report.id || '')}" class="text-primary text-sm" style="display:inline-block;">View Details</a>
            <a href="/analytics?reportId=${encodeURIComponent(report.id || '')}" class="text-primary text-sm" style="display:inline-block;">View Analytics</a>
          </div>
        </div>`;

      marker.bindPopup(popupContent);
      if (onMarkerClick && typeof onMarkerClick === 'function') {
        marker.on('click', () => onMarkerClick(report));
      }
      marker.addTo(map);
    });

    // Cleanup on unmount
    return () => {
      map.remove();
    };
  }, [reports, center, zoom]);

  return (
    <div id="reportMap" style={{ height: '100%', minHeight: '400px' }} />
  );
};

// Helper function to get issue type information
const getIssueTypeInfo = (typeId) => {
  const types = {
    air_pollution: { name: 'Air Pollution', icon: 'Wind', color: '#DC2626' },
    water_pollution: { name: 'Water Pollution', icon: 'Droplets', color: '#4A90A4' },
    noise_pollution: { name: 'Noise Pollution', icon: 'Volume2', color: '#D97706' },
    litter_waste: { name: 'Litter & Waste', icon: 'Trash2', color: '#6B7280' },
    green_space_damage: { name: 'Green Space Damage', icon: 'Trees', color: '#2D5A27' },
    wildlife_concern: { name: 'Wildlife Concern', icon: 'Bird', color: '#059669' },
    infrastructure: { name: 'Infrastructure Issues', icon: 'Construction', color: '#7C3AED', emoji: '🏗️' },
    mall: { name: 'Commercial / Mall', icon: 'ShoppingBag', color: '#7B61FF', emoji: '🏬' },
    factory: { name: 'Factory / Industrial', icon: 'Factory', color: '#6B7280', emoji: '🏭' },
    river: { name: 'River / Waterbody', icon: 'Droplets', color: '#4A90A4', emoji: '🏞️' },
    other: { name: 'Other Environmental Issue', icon: 'AlertTriangle', color: '#F4A261', emoji: '⚠️' }
  };
  return types[typeId] || types.other;
};

export default ReportMap;
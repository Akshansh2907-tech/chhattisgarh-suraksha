import api from './api.js';

export const mlAPI = {
  getHotspots: (locationId = 1) => api.get('/ml/hotspots', { params: { location_id: locationId } }),
  getForecast: (locationId = 1) => api.get('/ml/forecast', { params: { location_id: locationId } }),
  getRiskAssessment: (locationId = 1) => api.get('/ml/risk-assessment', { params: { location_id: locationId } }),
  getPatterns: (locationId = 1, days = 30) => api.get('/ml/patterns', { params: { location_id: locationId, days } }),
  getModelInfo: (model = null) => api.get('/ml/models/info', { params: { model } }),
  trainModels: (models = null) => api.post('/ml/train', { models })
};

export default mlAPI;

import api from './api';

class ReportService {
  async submitReport(reportData) {
    try {
      // Validate required fields
      const requiredFields = ['issueType', 'description', 'severity', 'location'];
      const missingFields = requiredFields.filter(field => !reportData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate location format
      if (reportData.location && (!reportData.location.latitude || !reportData.location.longitude)) {
        throw new Error('Invalid location format. Must include latitude and longitude.');
      }

      // Ensure description isn't too long
      if (reportData.description && reportData.description.length > 2000) {
        throw new Error('Description is too long (maximum 2000 characters)');
      }

      // Clean and validate JSON data
      if (reportData.additionalData) {
        try {
          if (typeof reportData.additionalData === 'string') {
            JSON.parse(reportData.additionalData);
          }
        } catch (e) {
          throw new Error('Invalid additional data format');
        }
      }

      // Submit report
      const response = await api.post('/reports/submit', reportData);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Report submission failed');
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to submit report:', error);
      
      // Enhance error message for common issues
      if (error.response?.status === 413) {
        throw new Error('Report data too large. Try reducing photo sizes or removing some photos.');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data.error || 'Invalid report data. Please check all fields.');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (error.response?.status === 500) {
        throw new Error('Server error. Please try again later.');
      }
      
      throw error;
    }
  }

  async getAllReports() {
    try {
      // Accept optional bounds to limit results: can be array [swLat,swLng,neLat,neLng]
      // or object { sw: [lat,lng], ne: [lat,lng] }
      const args = Array.from(arguments);
      let url = '/reports/all';
      if (args.length > 0 && args[0]) {
        const b = args[0];
        let swLat, swLng, neLat, neLng;
        if (Array.isArray(b) && b.length === 4) {
          [swLat, swLng, neLat, neLng] = b;
        } else if (b && b.sw && b.ne) {
          [swLat, swLng] = b.sw;
          [neLat, neLng] = b.ne;
        }

        if ([swLat, swLng, neLat, neLng].every(v => typeof v === 'number')) {
          url += `?bounds=${swLat},${swLng},${neLat},${neLng}`;
        }
      }

      const response = await api.get(url);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw error;
    }
  }
}

export const reportService = new ReportService();
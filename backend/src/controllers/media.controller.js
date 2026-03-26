import MediaAnalysis from '../services/media-analysis.service.js';

export const uploadMedia = async (req, res, next) => {
  try {
    // Accept JSON body { data: base64Data, name, type }
    const { data, name } = req.body || {};
    const userId = req.user?.userId || null;

    if (!data) return res.status(400).json({ success: false, error: 'Missing image data' });

    const result = await MediaAnalysis.analyzeAndStoreImage({ base64Data: data, filename: name, userId });
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    res.status(200).json({ success: true, data: result.asset });
  } catch (error) {
    console.error('uploadMedia error', error);
    next(error);
  }
};

export default { uploadMedia };

import Forum from '../models/forum.js';

// Schedule cleanup every minute using setInterval
// Run every 60 seconds
setInterval(async () => {
  try {
    await Forum.cleanupOfflineUsers();
    console.log('✅ Cleaned up offline users');
  } catch (error) {
    console.error('❌ Error cleaning up offline users:', error);
  }
}, 60 * 1000);
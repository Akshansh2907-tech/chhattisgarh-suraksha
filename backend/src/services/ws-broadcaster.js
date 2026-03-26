// Simple WebSocket broadcaster used by the server to notify connected clients
// Keeps a map of userId -> ws socket and exposes helper functions to register
// and broadcast messages. This avoids coupling the rest of the app to the
// HTTP server implementation.

const clients = new Map();

export const registerClient = (userId, ws) => {
  if (!userId || !ws) return;
  clients.set(userId, ws);
};

export const removeClient = (userId) => {
  if (!userId) return;
  clients.delete(userId);
};

export const broadcast = (messageObj) => {
  const payload = typeof messageObj === 'string' ? messageObj : JSON.stringify(messageObj);
  for (const [userId, ws] of clients.entries()) {
    try {
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    } catch (err) {
      // Ignore send errors for now; cleanup will occur on close
      console.warn('WS broadcast failed for user', userId, err?.message || err);
    }
  }
};

// Also provide a helper to send to a specific user
export const sendToUser = (userId, messageObj) => {
  const ws = clients.get(userId);
  if (!ws || ws.readyState !== ws.OPEN) return;
  try {
    ws.send(typeof messageObj === 'string' ? messageObj : JSON.stringify(messageObj));
  } catch (err) {
    console.warn('WS sendToUser failed for', userId, err?.message || err);
  }
};

export default {
  registerClient,
  removeClient,
  broadcast,
  sendToUser
};

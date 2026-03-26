import { useState, useEffect, useRef, useCallback } from 'react';

// Defaults
const DEFAULT_INITIAL_DELAY = 2000; // 2s
const DEFAULT_MAX_DELAY = 30000; // 30s
const DEFAULT_MAX_ATTEMPTS = 6; // cap attempts to avoid runaway

export function useWebSocket(url, options = {}) {
  const { onMessage, onOpen, onClose, maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;

  const wsRef = useRef(null);
  const attemptsRef = useRef(0);
  const delayRef = useRef(DEFAULT_INITIAL_DELAY);
  const urlRef = useRef(url);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // keep url in ref so reconnect uses latest value without recreating handlers unnecessarily
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const close = useCallback((code = 1000, reason) => {
    attemptsRef.current = maxAttempts; // prevent further reconnects when closed manually
    if (wsRef.current) {
      try {
        wsRef.current.close(code, reason);
      } catch (e) {
        // ignore
      }
    }
  }, [maxAttempts]);

  const connect = useCallback(() => {
    // If there's already a socket and it's open or connecting, do nothing
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Don't try indefinitely
    if (attemptsRef.current >= maxAttempts) {
      console.warn('useWebSocket: max reconnect attempts reached');
      return;
    }

    const urlToUse = urlRef.current;

    let ws;
    try {
      ws = new WebSocket(urlToUse);
      wsRef.current = ws;
    } catch (err) {
      setError(err);
      return;
    }

    ws.onopen = (ev) => {
      attemptsRef.current = 0;
      delayRef.current = DEFAULT_INITIAL_DELAY;
      setIsConnected(true);
      setError(null);
      if (typeof onOpen === 'function') onOpen(ev);
    };

    ws.onmessage = (ev) => {
      if (!ev.data) return;
      if (typeof onMessage === 'function') {
        try {
          const parsed = JSON.parse(ev.data);
          onMessage(parsed);
        } catch (e) {
          // If message isn't JSON, pass raw
          onMessage(ev.data);
        }
      }
    };

    ws.onerror = (ev) => {
      // set a generic error but avoid noisy console spam
      setError(ev.error || new Error('WebSocket error'));
    };

    ws.onclose = (ev) => {
      setIsConnected(false);
      if (typeof onClose === 'function') onClose(ev);

      // If closed intentionally (code 1000) and we flagged attempts to max, don't reconnect
      if (attemptsRef.current >= maxAttempts) return;

      // schedule reconnect with exponential backoff
      attemptsRef.current += 1;
      const delay = Math.min(delayRef.current, DEFAULT_MAX_DELAY);

      // increase delay for next time
      delayRef.current = Math.min(delayRef.current * 2, DEFAULT_MAX_DELAY);

      // Only attempt reconnect a limited number of times
      setTimeout(() => {
        connect();
      }, delay);
    };
  }, [onMessage, onOpen, onClose, maxAttempts]);

  useEffect(() => {
    // start connection
    connect();

    // cleanup on unmount
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'Component unmounted');
        } catch (e) {}
      }
      attemptsRef.current = maxAttempts; // stop reconnects
    };
  }, [connect, maxAttempts]);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
      } catch (e) {
        console.warn('useWebSocket send failed', e);
      }
    } else {
      console.warn('useWebSocket: cannot send, socket not open');
    }
  }, []);

  return {
    isConnected,
    error,
    send,
    connect,
    close,
    _wsRef: wsRef // exposed for debugging if needed
  };
}
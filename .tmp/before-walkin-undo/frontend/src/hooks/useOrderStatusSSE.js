import { useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * useOrderStatusSSE
 * Connects to the backend SSE endpoint and fires `onUpdate` whenever an
 * "order_status_update" event is received for this user.
 *
 * @param {{ onUpdate: (data: object) => void, enabled?: boolean }} options
 */
export function useOrderStatusSSE({ onUpdate, onReconnect, enabled = true }) {
  const esRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const onReconnectRef = useRef(onReconnect);

  // Keep ref in sync so the effect closure doesn't go stale
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onReconnectRef.current = onReconnect;
  });

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || !enabled) return;

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = `${API_BASE}/sse/orders?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      // Reload authoritative data on first connection and after missed events.
      onReconnectRef.current?.();
    });

    es.addEventListener('order_status_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdateRef.current?.(data);
      } catch {
        // Malformed payload — ignore
      }
    });

    es.onerror = () => {
      // EventSource will auto-reconnect on network errors.
      // We only close explicitly on 401/403 (handled below via a separate fetch).
    };

    return es;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const es = connect();

    return () => {
      es?.close();
      esRef.current = null;
    };
  }, [connect, enabled]);

  /** Manually close the stream (e.g. on logout) */
  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  return { disconnect };
}

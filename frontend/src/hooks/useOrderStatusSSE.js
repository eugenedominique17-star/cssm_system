import { useEffect, useRef, useCallback } from 'react';

import { API_BASE } from '../api/baseUrl';
import { supabase, supabaseAuthEnabled } from '../api/supabase';

/**
 * useOrderStatusSSE
 * Connects to the backend SSE endpoint and fires `onUpdate` whenever an
 * "order_status_update" event is received for this user.
 *
 * @param {{ onUpdate: (data: object) => void, enabled?: boolean }} options
 */
export function useOrderStatusSSE({ onUpdate, enabled = true }) {
  const esRef = useRef(null);
  const channelRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep ref in sync so the effect closure doesn't go stale
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || !enabled) return;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (supabaseAuthEnabled) {
      let cancelled = false;
      let channel = null;
      const subscribe = async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (cancelled || !data.session?.access_token || !data.session.user?.id) return;

        supabase.realtime.setAuth(data.session.access_token);
        channel = supabase
          .channel(`order-status:${data.session.user.id}`, { config: { private: true } })
          .on('broadcast', { event: 'order_status_update' }, ({ payload }) => {
            if (payload && typeof payload === 'object') onUpdateRef.current?.(payload);
          })
          .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('Supabase Realtime order status subscription failed:', error || status);
            }
          });
        channelRef.current = channel;
      };

      subscribe().catch(error => {
        console.error('Could not start Supabase Realtime order status subscription:', error);
      });

      return () => {
        cancelled = true;
        if (channel) {
          supabase.removeChannel(channel);
          if (channelRef.current === channel) channelRef.current = null;
        }
      };
    }

    const url = `${API_BASE}/sse/orders?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      // Connection confirmed — nothing needed here but can be used for logging
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

    const connection = connect();

    return () => {
      if (typeof connection === 'function') connection();
      else connection?.close();
      esRef.current = null;
    };
  }, [connect, enabled]);

  /** Manually close the stream (e.g. on logout) */
  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { disconnect };
}

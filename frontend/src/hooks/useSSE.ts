import { useEffect, useRef, useCallback } from 'react';

const SSE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/sse/stream`;

type EventHandlers = Record<string, (data: any) => void>;

interface UseSSEOptions {
  /** Max reconnect delay in ms (default 30000) */
  maxRetryDelay?: number;
}

/**
 * useSSE — subscribe to the backend SSE stream and register event handlers.
 *
 * The hook automatically reconnects with exponential backoff when the connection
 * drops (network blip, server restart, etc.).
 *
 * @example
 * useSSE({
 *   order_updated: (data) => refetch(),
 *   shop_updated:  (data) => refetch(),
 * });
 */
export function useSSE(handlers: EventHandlers, options: UseSSEOptions = {}) {
  const { maxRetryDelay = 30_000 } = options;
  const handlersRef = useRef<EventHandlers>(handlers);
  const retryDelayRef = useRef<number>(1_000);
  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep handlers ref up-to-date without restarting the connection
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const es = new EventSource(SSE_URL, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('connected', () => {
      // Reset backoff on successful connection
      retryDelayRef.current = 1_000;
    });

    // Attach a generic message listener that dispatches to named event handlers
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current['message']?.(data);
      } catch {
        // ignore malformed messages
      }
    };

    // Attach named event listeners dynamically
    const attachHandlers = () => {
      const eventNames = [
        'order_created',
        'order_updated',
        'order_cancelled',
        'orders_cancelled_all',
        'menu_updated',
        'shop_updated',
      ];

      eventNames.forEach((eventName) => {
        es.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlersRef.current[eventName]?.(data);
          } catch {
            // ignore malformed event data
          }
        });
      });
    };

    attachHandlers();

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (!mountedRef.current) return;

      // Exponential backoff: 1s → 2s → 4s → … → maxRetryDelay
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, maxRetryDelay);

      console.log(`[SSE] Connection lost. Retrying in ${delay}ms…`);
      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, [maxRetryDelay]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}

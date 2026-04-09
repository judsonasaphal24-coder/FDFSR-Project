/**
 * useWebSocket Hook
 * =================
 * WebSocket connection to Django Channels for real-time
 * audio analysis streaming.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export function useWebSocket(url = null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [analysisData, setAnalysisData] = useState({ key: '', chord: '', keyConfidence: 0 });
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const wsUrl = url || `ws://${window.location.host}/ws/audio/analyze/`;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (data.type === 'analysis') {
            setAnalysisData({
              key: data.key || '',
              chord: data.chord || '',
              keyConfidence: data.key_confidence || 0,
              chordConfidence: data.chord_confidence || 0,
            });
          }
        } catch (e) {
          console.warn('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect after 2 seconds
        reconnectRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
    }
  }, [wsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendAudioFrame = useCallback((float32Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(float32Array.buffer);
    }
  }, []);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    isConnected,
    lastMessage,
    analysisData,
    connect,
    disconnect,
    sendAudioFrame,
    sendMessage,
  };
}

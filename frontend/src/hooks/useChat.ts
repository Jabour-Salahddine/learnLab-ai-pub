import { useState, useEffect, useRef, useCallback } from "react";
import { WebSocketClient } from "@/lib/websocket";
import type { ChatMessage } from "@/types/api";

let _idCounter = 0;
const uid = () => String(++_idCounter);

export function useChat(tpId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocketClient | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tpId) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const ws = new WebSocketClient();
    wsRef.current = ws;

    ws.onChunk((chunk) => {
      const id = streamingIdRef.current;
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: m.content + chunk } : m
        )
      );
    });

    ws.onDone(() => {
      if (streamingIdRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m
          )
        );
        streamingIdRef.current = null;
      }
      setIsTyping(false);
    });

    ws.onError((error) => {
      setIsTyping(false);
      streamingIdRef.current = null;
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `Erreur: ${error}`,
          agent: "tuteur",
          isStreaming: false,
        },
      ]);
    });

    ws.connect(tpId, token)
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false));

    return () => {
      ws.disconnect();
      setIsConnected(false);
    };
  }, [tpId]);

  const sendMessage = useCallback(
    (question: string, agent: "tuteur" | "explicateur" = "tuteur") => {
      if (!wsRef.current?.isConnected) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: question,
      };

      const assistantId = uid();
      streamingIdRef.current = assistantId;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        agent,
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsTyping(true);
      wsRef.current.sendMessage(question, agent);
    },
    []
  );

  return { messages, sendMessage, isConnected, isTyping };
}

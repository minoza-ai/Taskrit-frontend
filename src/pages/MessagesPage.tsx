import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../lib/store';
import {
  createDmRoom,
  listChatUsers,
  listMyChatRooms,
  listRoomMessages,
  sendRoomMessage,
  type ChatMessage,
  type ChatRoom,
  type ChatUser,
} from '../lib/api';

const MessagesPage = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const appendMessageDedup = (incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === incoming.message_id)) {
        return prev;
      }
      return [...prev, incoming].sort((a, b) => a.seq - b.seq);
    });
  };

  const clearSocketResources = () => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsConnected(false);
  };

  const roomName = (room: ChatRoom): string => {
    if (room.room_type === 'team') return room.room_name;

    const myUuid = user?.user_uuid;
    if (!myUuid) return room.room_name || '1:1 채팅';

    const otherUuid = room.members.find((memberUuid) => memberUuid !== myUuid);
    if (!otherUuid) return room.room_name || '1:1 채팅';

    const otherUser = chatUsers.find((u) => u.user_uuid === otherUuid);
    if (!otherUser) return room.room_name || '1:1 채팅';

    return otherUser.nickname;
  };

  const loadRooms = async () => {
    if (!accessToken) return;
    setLoadingRooms(true);
    setError(null);
    try {
      const [roomData, userData] = await Promise.all([
        listMyChatRooms(accessToken),
        listChatUsers(accessToken),
      ]);

      setRooms(roomData);
      setChatUsers(userData);
      if (!selectedConversation && roomData.length > 0) {
        setSelectedConversation(roomData[0].room_id);
      }
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      setError(err.message || '채팅방 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadMessages = async (roomId: string) => {
    if (!accessToken) return;
    setLoadingMessages(true);
    setError(null);
    try {
      const data = await listRoomMessages(accessToken, roomId);
      setMessages(data);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      setError(err.message || '메시지를 불러오지 못했습니다.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [accessToken]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation, accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedConversation) {
      clearSocketResources();
      return;
    }

    const wsBase = import.meta.env.VITE_CHAT_WS_BASE
      || `${import.meta.env.VITE_CHAT_WS_TARGET || 'ws://localhost:8000'}/ws`;
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].message_id : null;

    const toWsUrl = () => {
      const query = new URLSearchParams({ token: accessToken });
      if (lastMessageId) {
        query.set('last_message_id', lastMessageId);
      }

      if (wsBase.startsWith('ws://') || wsBase.startsWith('wss://')) {
        return `${wsBase}/rooms/${selectedConversation}?${query.toString()}`;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${wsProtocol}://${window.location.host}${wsBase}/rooms/${selectedConversation}?${query.toString()}`;
    };

    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const socket = new WebSocket(toWsUrl());
      wsRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        if (disposed) return;

        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'message' && payload.data) {
            const incoming = payload.data as ChatMessage;

            if (incoming.room_id === selectedConversation) {
              appendMessageDedup(incoming);
            }

            void loadRooms();
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onerror = () => {
        if (disposed) return;
        setWsConnected(false);
      };

      socket.onclose = () => {
        if (disposed) return;
        setWsConnected(false);

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 2000);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearSocketResources();
    };
  }, [accessToken, selectedConversation]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || !accessToken) return;
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const sent = await sendRoomMessage(accessToken, selectedConversation, text);
      setMessages((prev) => [...prev, sent]);
      await loadRooms();
    } catch (err: any) {
      setError(err.message || '메시지 전송에 실패했습니다.');
    }
  };

  const handleCreateDmByUserId = async () => {
    if (!accessToken) return;

    const inputUserId = targetUserId.trim().toLowerCase();
    if (!inputUserId) {
      setError('상대방 아이디를 입력해주세요.');
      return;
    }

    if (inputUserId === user?.user_id?.toLowerCase()) {
      setError('본인 아이디로는 채팅방을 만들 수 없습니다.');
      return;
    }

    setCreatingRoom(true);
    setError(null);

    try {
      const users = await listChatUsers(accessToken);
      const target = users.find((u) => u.user_id.toLowerCase() === inputUserId);

      if (!target) {
        setError('해당 아이디의 사용자를 찾을 수 없습니다.');
        return;
      }

      const room = await createDmRoom(accessToken, target.user_uuid, `${target.nickname}님과의 대화`);
      setTargetUserId('');
      await loadRooms();
      setSelectedConversation(room.room_id);
      await loadMessages(room.room_id);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      setError(err.message || '채팅방 생성에 실패했습니다.');
    } finally {
      setCreatingRoom(false);
    }
  };

  return (
    <div className="animate-in h-[calc(100vh-12rem)]">
      <h1 className="text-2xl font-bold mb-6">메시지</h1>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100%-3rem)]">
        {/* Conversation List */}
        <div className="glass-card rounded-xl p-3 overflow-y-auto">
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDmByUserId()}
              placeholder="상대방 아이디 입력"
              className="glass-input flex-1 py-2 px-3 rounded-md text-sm"
            />
            <button
              onClick={handleCreateDmByUserId}
              disabled={creatingRoom}
              className="btn-primary px-3 py-2 rounded-md text-sm disabled:opacity-60"
            >
              {creatingRoom ? '생성중' : '시작'}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {rooms.map((conv) => (
              <button
                key={conv.room_id}
                onClick={() => setSelectedConversation(conv.room_id)}
                className={`w-full text-left p-3 rounded-lg transition-all cursor-pointer ${
                  selectedConversation === conv.room_id
                    ? 'bg-surface-2 border border-border'
                    : 'hover:bg-surface-2/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{roomName(conv)}</span>
                  <span className="text-[10px] text-text-hint">{conv.last_message_time || ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-sub truncate flex-1">{conv.last_message?.text || '메시지가 없습니다'}</span>
                  {(conv.unread_count || 0) > 0 && (
                    <span className="ml-2 bg-active text-active-text text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {loadingRooms && <div className="text-center py-8 text-text-hint text-sm">불러오는 중...</div>}
          {!loadingRooms && rooms.length === 0 && (
            <div className="text-center py-12 text-text-hint text-sm">
              대화가 없습니다
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="md:col-span-2 glass-card rounded-xl flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border">
                <span className="font-semibold text-sm">
                  {(() => {
                    const selectedRoom = rooms.find((c) => c.room_id === selectedConversation);
                    return selectedRoom ? roomName(selectedRoom) : '채팅';
                  })()}
                </span>
                <span className={`ml-3 text-xs ${wsConnected ? 'text-green-600' : 'text-text-hint'}`}>
                  {wsConnected ? '실시간 연결됨' : '재연결 중'}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                {loadingMessages && <div className="text-center py-8 text-text-hint text-sm">메시지 불러오는 중...</div>}
                {messages.map((msg) => (
                  <div
                    key={msg.message_id}
                    className={`flex ${msg.sender_uuid === user?.user_uuid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                        msg.sender_uuid === user?.user_uuid
                          ? 'bg-active text-active-text rounded-br-md'
                          : 'bg-surface-2 text-text rounded-bl-md'
                      }`}
                    >
                      {msg.text}
                      <div
                        className={`text-[10px] mt-1 ${
                          msg.sender_uuid === user?.user_uuid ? 'text-active-text/70' : 'text-text-hint'
                        }`}
                      >
                        {msg.created_at}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="메시지를 입력하세요..."
                    className="glass-input flex-1 py-2.5 px-4 rounded-full text-sm"
                  />
                  <button
                    onClick={handleSend}
                    className="btn-primary px-5 py-2.5 rounded-full text-sm cursor-pointer"
                  >
                    전송
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-hint text-sm">
              대화를 선택해주세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;

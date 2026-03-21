import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/theme';
import {
  createDmRoom,
  deleteRoomMessage,
  listChatUsers,
  listMyChatRooms,
  listRoomMessages,
  markRoomAsRead,
  sendRoomMessage,
  type ChatMessage,
  type ChatRoom,
  type ChatUser,
} from '../lib/api';

const MessagesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useThemeStore((s) => s.mode);
  const isLightTheme =
    themeMode === 'light' ||
    (themeMode === 'system' && document.documentElement.getAttribute('data-theme') === 'light');

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
  const [isComposingMessage, setIsComposingMessage] = useState(false);
  const [isComposingTargetUserId, setIsComposingTargetUserId] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showNewMessageNotice, setShowNewMessageNotice] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [actionMenuState, setActionMenuState] = useState<{ messageId: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.innerWidth >= 768);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollOnNextMessageRef = useRef(false);
  const lastMarkedReadMessageByRoomRef = useRef<Record<string, string>>({});
  const longPressTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const appendMessageDedup = (incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === incoming.message_id)) {
        return prev;
      }
      return [...prev, incoming].sort((a, b) => a.seq - b.seq);
    });
  };

  const applyDeletedMessage = (deleted: ChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.message_id === deleted.message_id ? deleted : msg)));
  };

  const markMessageAsRead = async (roomId: string, messageId: string) => {
    if (!accessToken) return;
    if (!messageId) return;

    if (lastMarkedReadMessageByRoomRef.current[roomId] === messageId) {
      return;
    }

    try {
      await markRoomAsRead(accessToken, roomId, messageId);
      lastMarkedReadMessageByRoomRef.current[roomId] = messageId;
      await loadRooms();
    } catch {
      // 읽음 표시는 UX 보조 기능이라 실패해도 채팅 흐름은 유지한다.
    }
  };

  const applyReadUpdate = (readerUserUuid: string, lastReadSeq: number) => {
    setMessages((prev) => {
      if (!Number.isFinite(lastReadSeq) || lastReadSeq <= 0) {
        return prev;
      }

      return prev.map((msg) => {
        if (msg.sender_uuid === readerUserUuid || msg.seq > lastReadSeq) {
          return msg;
        }

        const nextUnread = Math.max((msg.unread_member_count || 0) - 1, 0);
        return { ...msg, unread_member_count: nextUnread };
      });
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

  const selectedRoom = rooms.find((c) => c.room_id === selectedConversation) || null;

  const isNearMessageBottom = () => {
    const viewport = messageViewportRef.current;
    if (!viewport) return true;

    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return remaining <= 56;
  };

  const scrollMessagesToBottom = (behavior: ScrollBehavior = 'auto') => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    setShowNewMessageNotice(false);
  };

  const handleMessageScroll = () => {
    if (isNearMessageBottom()) {
      setShowNewMessageNotice(false);
    }
  };

  useLayoutEffect(() => {
    if (!shouldAutoScrollOnNextMessageRef.current) return;

    scrollMessagesToBottom('smooth');
    shouldAutoScrollOnNextMessageRef.current = false;
  }, [messages]);

  useEffect(() => {
    const onResize = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const openActionMenu = (messageId: string) => {
    setActionMenuState({ messageId });
  };

  const closeActionMenu = () => {
    setActionMenuState(null);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageTouchStart = (_e: React.TouchEvent<HTMLDivElement>, messageId: string) => {
    if (isDesktopViewport) return;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      openActionMenu(messageId);
    }, 450);
  };

  const handleMessageTouchEnd = () => {
    clearLongPressTimer();
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

  const formatMessageTime = (iso: string): string => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;

    const now = new Date();
    const sameDay =
      dt.getFullYear() === now.getFullYear()
      && dt.getMonth() === now.getMonth()
      && dt.getDate() === now.getDate();

    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');

    if (sameDay) {
      return `${hh}:${mm}`;
    }

    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${month}/${day} ${hh}:${mm}`;
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

      const latest = data[data.length - 1];
      if (latest) {
        void markMessageAsRead(roomId, latest.message_id);
      }

      requestAnimationFrame(() => {
        scrollMessagesToBottom('auto');
      });
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
    const handleNewChatNotification = () => {
      void loadRooms();
    };

    window.addEventListener('taskrit:new-chat-notification', handleNewChatNotification as EventListener);

    return () => {
      window.removeEventListener('taskrit:new-chat-notification', handleNewChatNotification as EventListener);
    };
  }, [accessToken]);

  useEffect(() => {
    const targetRoomId = searchParams.get('room');
    if (!targetRoomId) return;

    setSelectedConversation(targetRoomId);
    setMobileView('chat');

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('room');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

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

    const resolvedWsBase = () => {
      if (import.meta.env.VITE_CHAT_WS_BASE) {
        return import.meta.env.VITE_CHAT_WS_BASE as string;
      }

      if (import.meta.env.VITE_CHAT_WS_TARGET) {
        return `${import.meta.env.VITE_CHAT_WS_TARGET as string}/ws`;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (isLocalhost) {
        return 'ws://localhost:3001/ws';
      }

      return `${wsProtocol}://${window.location.host}/chat-ws`;
    };

    const wsBase = resolvedWsBase();
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
            const wasNearBottom = isNearMessageBottom();

            if (incoming.room_id === selectedConversation) {
              shouldAutoScrollOnNextMessageRef.current = incoming.sender_uuid === user?.user_uuid || wasNearBottom;
              appendMessageDedup(incoming);

              if (incoming.sender_uuid !== user?.user_uuid) {
                void markMessageAsRead(selectedConversation, incoming.message_id);
              }

              if (!shouldAutoScrollOnNextMessageRef.current) {
                setShowNewMessageNotice(true);
              }
            }

            void loadRooms();
            return;
          }

          if (
            payload.type === 'read_update'
            && payload.room_id === selectedConversation
            && typeof payload.user_uuid === 'string'
            && typeof payload.last_read_seq === 'number'
          ) {
            applyReadUpdate(payload.user_uuid, payload.last_read_seq);
            void loadRooms();
            return;
          }

          if (payload.type === 'message_deleted' && payload.data) {
            const deleted = payload.data as ChatMessage;
            if (deleted.room_id === selectedConversation) {
              applyDeletedMessage(deleted);
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
  }, [accessToken, selectedConversation, user?.user_uuid]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || !accessToken) return;
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const sent = await sendRoomMessage(accessToken, selectedConversation, text);
      appendMessageDedup(sent);
      requestAnimationFrame(() => {
        scrollMessagesToBottom('smooth');
      });
      await loadRooms();
    } catch (err: any) {
      setError(err.message || '메시지 전송에 실패했습니다.');
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!accessToken) return;
    if (message.sender_uuid !== user?.user_uuid) return;
    if (message.is_deleted || message.message_type === 'deleted') return;

    try {
      const result = await deleteRoomMessage(accessToken, message.message_id);
      applyDeletedMessage(result.data);
      await loadRooms();
      closeActionMenu();
    } catch (err: any) {
      setError(err.message || '메시지 삭제에 실패했습니다.');
    }
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    if (message.is_deleted || message.message_type === 'deleted') {
      showToast('삭제된 메시지는 복사할 수 없습니다.');
      closeActionMenu();
      return;
    }

    try {
      await navigator.clipboard.writeText(message.text || '');
      showToast('복사했습니다.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = message.text || '';
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('복사했습니다.');
    }

    closeActionMenu();
  };

  const handleOpenDesktopActionMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    messageId: string,
  ) => {
    e.stopPropagation();
    openActionMenu(messageId);
  };

  const handleMessageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    // 한글 IME 조합 중 Enter는 글자 확정 용도로만 사용하고 전송을 막는다.
    if (isComposingMessage || e.nativeEvent.isComposing) {
      return;
    }

    e.preventDefault();
    void handleSend();
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
      setMobileView('chat');
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

  const handleTargetUserIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    // 한글 IME 조합 중 Enter는 글자 확정 용도이므로 제출을 막는다.
    if (isComposingTargetUserId || e.nativeEvent.isComposing) {
      return;
    }

    e.preventDefault();
    void handleCreateDmByUserId();
  };

  return (
    <div className="animate-in h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-8.25rem)] flex flex-col overflow-hidden">
      <h1 className="text-2xl font-bold mb-4 md:mb-6">메시지</h1>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Conversation List */}
        <div className={`glass-card rounded-xl p-3 overflow-y-auto min-h-[22rem] md:min-h-0 ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              onCompositionStart={() => setIsComposingTargetUserId(true)}
              onCompositionEnd={() => setIsComposingTargetUserId(false)}
              onKeyDown={handleTargetUserIdKeyDown}
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
                onClick={() => {
                  setSelectedConversation(conv.room_id);
                  setMobileView('chat');
                }}
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
        <div className={`md:col-span-2 glass-card rounded-xl flex flex-col min-h-[22rem] md:min-h-0 ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-3 md:p-4 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden btn-ghost px-2 py-1 rounded-md text-sm"
                    aria-label="채팅방 목록으로 돌아가기"
                  >
                    뒤로
                  </button>
                  <span className="font-semibold text-sm truncate">
                    {selectedRoom ? roomName(selectedRoom) : '채팅'}
                  </span>
                </div>
                <span className={`text-xs shrink-0 ${wsConnected ? 'text-green-600' : 'text-text-hint'}`}>
                  {wsConnected ? '실시간 연결됨' : '재연결 중'}
                </span>
              </div>

              {/* Messages */}
              <div className="relative flex-1 min-h-0">
                <div
                  ref={messageViewportRef}
                  onScroll={handleMessageScroll}
                  className="h-full p-3 md:p-4 overflow-y-auto flex flex-col gap-3"
                >
                {loadingMessages && <div className="text-center py-8 text-text-hint text-sm">메시지 불러오는 중...</div>}
                {messages.map((msg) => {
                  const isMe = msg.sender_uuid === user?.user_uuid;
                  const isDeleted = msg.is_deleted || msg.message_type === 'deleted';
                  const menuVisible = hoveredMessageId === msg.message_id || actionMenuState?.messageId === msg.message_id;
                  return (
                    <div
                      key={msg.message_id}
                      onMouseEnter={() => setHoveredMessageId(msg.message_id)}
                      onMouseLeave={() => setHoveredMessageId((prev) => (prev === msg.message_id ? null : prev))}
                      className={`flex w-full mb-1 items-end ${
                        isMe ? 'justify-end pl-10' : 'justify-start pr-10'
                      }`}
                    >
                      {/* 내가 보낸 메시지의 시간 및 읽음표시 */}
                      {isMe && (
                        <div className="relative shrink-0 flex flex-col items-end justify-end text-[10px] leading-tight mr-1.5 pb-[2px]">
                          {isDesktopViewport && menuVisible && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenDesktopActionMenu(e, msg.message_id)}
                              className="absolute -top-6 right-0 w-7 h-7 rounded-full flex items-center justify-center text-text-hint hover:text-text hover:bg-surface-2 text-lg transition-colors"
                              aria-label="메시지 액션 열기"
                            >
                              ⋯
                            </button>
                          )}
                          {(msg.unread_member_count || 0) > 0 && (
                            <span className="font-semibold text-amber-500 mb-[2px]">
                              {msg.unread_member_count}
                            </span>
                          )}
                          <span className="text-text-hint">{formatMessageTime(msg.created_at)}</span>
                        </div>
                      )}

                      {/* 메시지 내용 (말풍선) */}
                      <div
                        onTouchStart={(e) => handleMessageTouchStart(e, msg.message_id)}
                        onTouchEnd={handleMessageTouchEnd}
                        onTouchMove={handleMessageTouchEnd}
                        className={`relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap min-w-[2rem] max-w-full shadow-sm ${
                          isMe
                            ? 'bg-blue-500 text-white rounded-br-sm text-left'
                            : isLightTheme
                              ? 'bg-[#F7F7F8] text-black rounded-bl-sm text-left border border-[#E3E3E6]'
                              : 'bg-[#2C2C2E] text-gray-200 rounded-bl-sm text-left border border-gray-700'
                        }`}
                        // break-word를 CSS로 강제 적용하여 아주 긴 영문/숫자가 영역을 뚫지 못하게 합니다.
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                      >
                        {/* 말풍선 꼬리 추가 */}
                        {isMe && (
                          <svg
                            className="absolute bottom-0 -right-2 w-3 h-4 text-blue-500"
                            viewBox="0 0 12 16"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M0 16C5 16 12 12 12 0C12 8 8 16 0 16Z" />
                          </svg>
                        )}
                        {!isMe && (
                          <svg
                            className={`absolute bottom-0 -left-2 w-3 h-4 ${
                              isLightTheme ? 'text-[#F7F7F8]' : 'text-[#2C2C2E]'
                            }`}
                            viewBox="0 0 12 16"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 16C7 16 0 12 0 0C0 8 4 16 12 16Z" />
                          </svg>
                        )}

                        {isDeleted ? (
                          <span className={`italic ${isMe ? 'text-white/80' : 'text-text-hint'}`}>
                            삭제된 메시지입니다.
                          </span>
                        ) : (
                          msg.text
                        )}
                      </div>

                      {/* 상대가 보낸 메시지의 시간 */}
                      {!isMe && (
                        <div className="relative shrink-0 flex flex-col justify-end text-[10px] leading-tight ml-1.5 pb-[2px] text-text-hint">
                          {isDesktopViewport && menuVisible && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenDesktopActionMenu(e, msg.message_id)}
                              className="absolute -top-6 left-0 w-7 h-7 rounded-full flex items-center justify-center text-text-hint hover:text-text hover:bg-surface-2 text-lg transition-colors"
                              aria-label="메시지 액션 열기"
                            >
                              ⋯
                            </button>
                          )}
                          {formatMessageTime(msg.created_at)}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                {actionMenuState && (() => {
                  const activeMessage = messages.find((m) => m.message_id === actionMenuState.messageId) || null;
                  const canDelete = !!activeMessage
                    && activeMessage.sender_uuid === user?.user_uuid
                    && !activeMessage.is_deleted
                    && activeMessage.message_type !== 'deleted';

                  if (!activeMessage) {
                    return null;
                  }

                  return (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={closeActionMenu}
                      role="presentation"
                      style={{
                        animation: 'fadeIn 0.15s ease-out',
                      }}
                    >
                      <style>{`
                        @keyframes fadeIn {
                          from { opacity: 0; }
                          to { opacity: 1; }
                        }
                        @keyframes popIn {
                          from { opacity: 0; transform: scale(0.95); }
                          to { opacity: 1; transform: scale(1); }
                        }
                        @keyframes slideUp {
                          from { opacity: 0; transform: translateY(10px); }
                          to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes slideOut {
                          from { opacity: 1; transform: translateY(0); }
                          to { opacity: 0; transform: translateY(10px); }
                        }
                      `}</style>
                      <div className="absolute inset-0 z-50 flex items-center justify-center">
                        <div
                          className="w-56 rounded-lg border border-border bg-surface shadow-2xl py-2"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(activeMessage)}
                            className="w-full text-left px-4 py-3 text-base hover:bg-surface-2 transition-colors"
                          >
                            복사
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              showToast('수정 기능은 준비 중입니다.');
                              closeActionMenu();
                            }}
                            className="w-full text-left px-4 py-3 text-base text-text-hint hover:bg-surface-2 transition-colors"
                          >
                            수정 (준비중)
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => void handleDeleteMessage(activeMessage)}
                            className="w-full text-left px-4 py-3 text-base text-red-500 hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {toastMessage && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50 px-4 py-3 text-sm rounded-lg bg-black/90 text-white shadow-lg"
                    style={{
                      animation: toastMessage ? 'slideUp 0.2s ease-out forwards' : 'slideOut 0.2s ease-out forwards',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {toastMessage}
                  </div>
                )}

                {showNewMessageNotice && (
                  <button
                    onClick={() => scrollMessagesToBottom('smooth')}
                    className="absolute right-3 bottom-3 btn-primary px-3 py-2 rounded-full text-xs shadow-lg flex items-center gap-1.5"
                  >
                    <span aria-hidden="true">●</span>
                    <span>새 메시지</span>
                  </button>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onCompositionStart={() => setIsComposingMessage(true)}
                    onCompositionEnd={() => setIsComposingMessage(false)}
                    onKeyDown={handleMessageInputKeyDown}
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

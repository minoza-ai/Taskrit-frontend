import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/theme';

/* Icons */
const DashboardIcon = () => {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
};

const ProjectIcon = () => {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
};

const MarketIcon = () => {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
};

const MessageIcon = () => {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
};

const AssetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

import VerifiedIcon from './VerifiedIcon';

const BellIcon = () => {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
};

const navItems = [
  { to: '/dashboard', label: '대시보드', icon: DashboardIcon },
  { to: '/projects', label: '프로젝트', icon: ProjectIcon },
  { to: '/marketplace', label: '마켓', icon: MarketIcon },
  { to: '/messages', label: '메시지', icon: MessageIcon },
  { to: '/my/assets', label: '내 자산', icon: AssetIcon },
];

type ChatNotification = {
  id: string;
  roomId: string;
  roomName: string;
  preview: string;
  createdAt: string;
  seen: boolean;
  senderProfileImage?: string;
  notificationType?: 'new_message' | 'incoming_call';
  callerUserUuid?: string;
  callerNickname?: string;
  roomType?: 'dm' | 'team';
  roomImageUrl?: string;
};

type PendingIncomingCall = {
  roomId: string;
  callerUserUuid: string;
  callerNickname?: string;
  roomName?: string;
  createdAt?: number;
};

const PENDING_INCOMING_CALL_STORAGE_KEY = 'taskrit:pending-incoming-call';
const PENDING_INCOMING_CALL_MAX_AGE_MS = 90 * 1000;
const CHAT_MESSAGE_OVERLAY_DURATION_MS = 4500;

const AppLayout = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileImageError, setIsProfileImageError] = useState(false);
  const [taskTokenBalance, setTaskTokenBalance] = useState<number | null>(null);
  const [taskTokenImage, setTaskTokenImage] = useState<string | null>(null);
  const [pendingIncomingCall, setPendingIncomingCall] = useState<PendingIncomingCall | null>(null);
  const [chatMessageOverlay, setChatMessageOverlay] = useState<ChatNotification | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationSocketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const callRingtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedMessageByRoomRef = useRef<Record<string, string>>({});
  const chatOverlayTimerRef = useRef<number | null>(null);

  const isDarkTheme = resolvedTheme() === 'dark';
  const themeIcon = themeMode === 'system' ? '⚙' : isDarkTheme ? '🌙' : '☀️';
  const themeLabel = themeMode === 'system' ? '시스템 설정' : isDarkTheme ? '다크 모드' : '라이트 모드';

  const profileImageSrc = user?.profile_image_url
    ? user.profile_image_url.startsWith('http') ? user.profile_image_url : `/api${user.profile_image_url}`
    : null;
  const profileInitial = (user?.nickname?.[0] || user?.user_id?.[0] || 'U').toUpperCase();
  const unreadNotificationCount = useMemo(() => notifications.filter((item) => !item.seen).length, [notifications]);

  const toChatAssetUrl = (assetUrl?: string): string | null => {
    if (!assetUrl) {
      return null;
    }

    if (assetUrl.startsWith('http')) {
      return assetUrl;
    }

    const chatApiBase = (import.meta.env.VITE_CHAT_API_BASE as string | undefined)?.trim() || '/chat-api';
    return `${chatApiBase}${assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`}`;
  };

  const getNotificationAvatarSrc = (notification: ChatNotification): string | null => {
    if (notification.notificationType === 'new_message' && notification.roomType === 'team') {
      return toChatAssetUrl(notification.roomImageUrl) || null;
    }

    if (!notification.senderProfileImage) {
      return null;
    }

    return notification.senderProfileImage.startsWith('http')
      ? notification.senderProfileImage
      : `/api${notification.senderProfileImage}`;
  };

  const readPendingIncomingCall = (): PendingIncomingCall | null => {
    try {
      const rawPending = sessionStorage.getItem(PENDING_INCOMING_CALL_STORAGE_KEY);
      if (!rawPending) return null;

      const parsed = JSON.parse(rawPending) as PendingIncomingCall;
      if (!parsed.roomId || !parsed.callerUserUuid) {
        return null;
      }

      if (parsed.createdAt && (Date.now() - parsed.createdAt) > PENDING_INCOMING_CALL_MAX_AGE_MS) {
        sessionStorage.removeItem(PENDING_INCOMING_CALL_STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    setIsProfileImageError(false);
  }, [profileImageSrc]);

  useEffect(() => {
    if (!user?.wallet_address) {
      setTaskTokenBalance(null);
      return;
    }
    
    // Fallbacks just in case .env defaults aren't caught by Vite types
    const mintAddress = import.meta.env.VITE_TASK_TOKEN_MINT || '3TRVYjSd1DrC4Jsn2bhpHsYCykkUZdEUK4Tok8jENMfs';
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

    let isMounted = true;

    const fetchTokenImage = async () => {
      if (taskTokenImage) return; // Already fetched
      try {
        const metaProgramId = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
        const mintPubKey = new PublicKey(mintAddress);
        const [pda] = PublicKey.findProgramAddressSync(
          [
            new TextEncoder().encode('metadata'),
            metaProgramId.toBytes(),
            mintPubKey.toBytes()
          ],
          metaProgramId
        );
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAccountInfo',
            params: [pda.toBase58(), { encoding: 'base64' }]
          })
        });
        const data = await response.json();
        
        if (isMounted && data.result?.value?.data) {
          const base64Data = data.result.value.data[0];
          const decodedData = atob(base64Data);
          const uriMatch = decodedData.match(/https?:\/\/[^\s\0]+/);
          if (uriMatch) {
            const uri = uriMatch[0];
            const metaResponse = await fetch(uri);
            const metaJson = await metaResponse.json();
            if (isMounted && metaJson.image) {
              const imageUrl = metaJson.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
              setTaskTokenImage(imageUrl);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch TASK token image', e);
      }
    };

    const fetchBalance = async () => {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              user.wallet_address,
              { mint: mintAddress },
              { encoding: 'jsonParsed' }
            ]
          })
        });
        const data = await response.json();
        if (isMounted && data.result?.value) {
          const accounts = data.result.value;
          if (accounts.length > 0) {
            const amountString = accounts[0].account.data.parsed?.info?.tokenAmount?.uiAmountString;
            setTaskTokenBalance(parseFloat(amountString || '0'));
          } else {
            setTaskTokenBalance(0);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch TASK balance', e);
      }
    };
    
    fetchTokenImage();
    fetchBalance();
    const intervalId = window.setInterval(fetchBalance, 30000); // refresh every 30s
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user?.wallet_address]);

  const stopCallRingtone = () => {
    if (callRingtoneAudioRef.current) {
      callRingtoneAudioRef.current.pause();
      callRingtoneAudioRef.current.currentTime = 0;
      callRingtoneAudioRef.current = null;
    }
  };

  const startCallRingtone = () => {
    // Prevent duplicate ringtone instances during rapid incoming-call events.
    if (callRingtoneAudioRef.current) {
      return;
    }

    const ringtoneSrc = `${import.meta.env.BASE_URL}ringtone_trimmed.mp3`;
    const audio = new Audio(ringtoneSrc);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.35;
    callRingtoneAudioRef.current = audio;

    void audio.play().catch(() => {
      // 브라우저 자동재생 정책으로 재생이 차단될 수 있다.
      callRingtoneAudioRef.current = null;
    });
  };

  useEffect(() => {
    const onStartCallRingtone = () => {
      startCallRingtone();
      setPendingIncomingCall(readPendingIncomingCall());
    };

    const onStopCallRingtone = () => {
      stopCallRingtone();
      setPendingIncomingCall(readPendingIncomingCall());
    };

    window.addEventListener('taskrit:start-call-ringtone', onStartCallRingtone as EventListener);
    window.addEventListener('taskrit:stop-call-ringtone', onStopCallRingtone as EventListener);

    return () => {
      window.removeEventListener('taskrit:start-call-ringtone', onStartCallRingtone as EventListener);
      window.removeEventListener('taskrit:stop-call-ringtone', onStopCallRingtone as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      stopCallRingtone();
      setPendingIncomingCall(null);
      setChatMessageOverlay(null);

      if (chatOverlayTimerRef.current) {
        window.clearTimeout(chatOverlayTimerRef.current);
        chatOverlayTimerRef.current = null;
      }

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (notificationSocketRef.current) {
        notificationSocketRef.current.close();
        notificationSocketRef.current = null;
      }

      setNotifications([]);
      return;
    }

    let disposed = false;

    const resolvedWsBase = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const envWsBase = (import.meta.env.VITE_CHAT_WS_BASE as string | undefined)?.trim();
      const envWsTarget = (import.meta.env.VITE_CHAT_WS_TARGET as string | undefined)?.trim();

      // taskr.it 배포에서는 기본값(/chat-ws)일 때 채팅 서브도메인으로 직접 연결해
      // 루트 도메인 프록시의 WS 업그레이드 불안정 구간을 우회한다.
      if (
        (window.location.hostname === 'taskr.it' || window.location.hostname === 'www.taskr.it')
        && (!envWsBase || envWsBase === '/chat-ws')
      ) {
        return `${wsProtocol}://chat.taskr.it/ws`;
      }

      if (envWsBase) {
        return envWsBase;
      }

      if (envWsTarget) {
        return `${envWsTarget}/ws`;
      }

      if (isLocalhost) {
        return 'ws://localhost:3001/ws';
      }

      return `${wsProtocol}://${window.location.host}/chat-ws`;
    };

    const wsBase = resolvedWsBase();

    const toNotificationsWsUrl = () => {
      const query = new URLSearchParams({ token: accessToken });

      if (wsBase.startsWith('ws://') || wsBase.startsWith('wss://')) {
        return `${wsBase}/notifications?${query.toString()}`;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${wsProtocol}://${window.location.host}${wsBase}/notifications?${query.toString()}`;
    };

    const connect = () => {
      if (disposed) return;

      const socket = new WebSocket(toNotificationsWsUrl());
      notificationSocketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        reconnectAttemptRef.current = 0; // Reset attempts on successful connection
      };

      socket.onmessage = (event) => {
        if (disposed) return;

        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== 'notification') {
            return;
          }

          if (payload.event === 'incoming_call') {
            const roomId = payload.room_id as string;
            const callerUserUuid = payload.caller?.user_uuid as string | undefined;
            const callerNickname = payload.caller?.nickname as string | undefined;

            if (!roomId || !callerUserUuid || callerUserUuid === user?.user_uuid) {
              return;
            }

            window.dispatchEvent(new CustomEvent('taskrit:incoming-call-notification', {
              detail: {
                roomId,
                callerUserUuid,
                callerNickname,
              },
            }));

            try {
              sessionStorage.setItem(PENDING_INCOMING_CALL_STORAGE_KEY, JSON.stringify({
                roomId,
                callerUserUuid,
                callerNickname,
                roomName: (payload.room_name as string) || '채팅방',
                createdAt: Date.now(),
              }));
            } catch {
              // Ignore storage failures (e.g., private mode restrictions)
            }

            setPendingIncomingCall({
              roomId,
              callerUserUuid,
              callerNickname,
              roomName: (payload.room_name as string) || '채팅방',
              createdAt: Date.now(),
            });

            startCallRingtone();

            const callNotification: ChatNotification = {
              id: `${roomId}-incoming-call-${Date.now()}`,
              roomId,
              roomName: (payload.room_name as string) || '채팅방',
              preview: `${callerNickname || '상대방'}님이 음성 통화를 요청했습니다.`,
              createdAt: new Date().toISOString(),
              seen: false,
              senderProfileImage: payload.caller?.profile_image_url as string | undefined,
              notificationType: 'incoming_call',
              callerUserUuid,
              callerNickname,
            };

            setNotifications((prev) => [
              callNotification,
              ...prev,
            ].slice(0, 30));

            return;
          }

          if (payload.event === 'room_members_updated') {
            const roomId = payload.room_id as string;
            if (!roomId) {
              return;
            }

            window.dispatchEvent(new CustomEvent('taskrit:new-chat-notification', {
              detail: {
                roomId,
                messageId: `room-members-updated-${Date.now()}`,
              },
            }));
            return;
          }

          if (payload.event !== 'new_message') {
            return;
          }

          if (payload.message?.sender_uuid === user?.user_uuid) {
            return;
          }

          const roomId = payload.room_id as string;
          const messageId = payload.message?.message_id as string | undefined;
          if (!roomId || !messageId) {
            return;
          }

          if (lastNotifiedMessageByRoomRef.current[roomId] === messageId) {
            return;
          }

          lastNotifiedMessageByRoomRef.current[roomId] = messageId;

          window.dispatchEvent(new CustomEvent('taskrit:new-chat-notification', {
            detail: {
              roomId,
              messageId,
            },
          }));

          const messageNotification: ChatNotification = {
            id: `${roomId}-${messageId}`,
            roomId,
            roomName: (payload.room_name as string) || '채팅방',
            preview: (payload.message?.text as string) || '새 메시지가 도착했습니다.',
            createdAt: (payload.message?.created_at as string) || new Date().toISOString(),
            seen: false,
            senderProfileImage: payload.message?.sender_profile_image as string | undefined,
            notificationType: 'new_message',
            roomType: payload.room_type as 'dm' | 'team' | undefined,
            roomImageUrl: payload.room_image_url as string | undefined,
          };

          if (chatOverlayTimerRef.current) {
            window.clearTimeout(chatOverlayTimerRef.current);
          }
          setChatMessageOverlay(messageNotification);
          chatOverlayTimerRef.current = window.setTimeout(() => {
            setChatMessageOverlay(null);
            chatOverlayTimerRef.current = null;
          }, CHAT_MESSAGE_OVERLAY_DURATION_MS);

          setNotifications((prev) => [
            messageNotification,
            ...prev,
          ].slice(0, 30));
        } catch {
          // Ignore malformed notification payloads.
        }
      };

      socket.onerror = () => {
        if (disposed) return;
        console.warn('Notification WebSocket error - will attempt to reconnect');
      };

      socket.onclose = () => {
        if (disposed) return;
        reconnectAttemptRef.current += 1;

        // Exponential backoff: 1200ms * (2 ^ attempt), max 30s
        const backoffMs = Math.min(1200 * Math.pow(2, reconnectAttemptRef.current - 1), 30000);

        // Max 10 Attempts
        if (reconnectAttemptRef.current >= 10) {
          console.error('Notification WebSocket: max reconnection attempts reached');
          return;
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, backoffMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (!readPendingIncomingCall()) {
        stopCallRingtone();
      }
      if (chatOverlayTimerRef.current) {
        window.clearTimeout(chatOverlayTimerRef.current);
        chatOverlayTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (notificationSocketRef.current) {
        notificationSocketRef.current.close();
        notificationSocketRef.current = null;
      }
      reconnectAttemptRef.current = 0;
    };
  }, [accessToken, user?.user_uuid]);

  useEffect(() => {
    setPendingIncomingCall(readPendingIncomingCall());
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationPanelRef.current?.contains(target)) return;
      if (notificationButtonRef.current?.contains(target)) return;
      if (profileMenuRef.current?.contains(target)) return;
      if (profileButtonRef.current?.contains(target)) return;

      setIsNotificationOpen(false);
      setIsProfileMenuOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const toggleNotifications = () => {
    setIsProfileMenuOpen(false);
    setIsNotificationOpen((prev) => {
      const next = !prev;
      if (next) {
        if (!readPendingIncomingCall()) {
          stopCallRingtone();
        }
      }
      return next;
    });
  };

  const moveToIncomingCallRoom = (incomingCall: PendingIncomingCall) => {
    const params = new URLSearchParams({
      room: incomingCall.roomId,
      incomingCall: '1',
      callerUserUuid: incomingCall.callerUserUuid,
    });

    if (incomingCall.callerNickname) {
      params.set('callerNickname', incomingCall.callerNickname);
    }

    navigate(`/messages?${params.toString()}`);
  };

  const moveToNotifiedRoom = (notification: ChatNotification) => {
    setIsNotificationOpen(false);
    setChatMessageOverlay(null);
    setNotifications((prev) => prev.filter((n) => n.roomId !== notification.roomId));

    if (notification.notificationType === 'incoming_call' && notification.callerUserUuid) {
      moveToIncomingCallRoom({
        roomId: notification.roomId,
        callerUserUuid: notification.callerUserUuid,
        callerNickname: notification.callerNickname,
      });
      return;
    }

    if (!readPendingIncomingCall()) {
      stopCallRingtone();
    }
    navigate(`/messages?room=${encodeURIComponent(notification.roomId)}`);
  };

  const toggleProfileMenu = () => {
    setIsNotificationOpen(false);
    setIsProfileMenuOpen((prev) => !prev);
  };

  const cycleTheme = () => {
    const next = themeMode === 'system' ? 'dark' : themeMode === 'dark' ? 'light' : 'system';
    setThemeMode(next);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        @keyframes chatOverlayIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes chatOverlayProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border-light bg-bg/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-5 h-14 md:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="font-display font-black text-lg tracking-tight text-text cursor-pointer"
            >
              Taskrit
            </button>
            {user && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-hint font-normal truncate max-w-24 md:max-w-none">{user.nickname}</span>
                {user.wallet_address && <VerifiedIcon tooltipPlacement="bottom" />}
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border bg-surface/70 px-2 py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-active text-active-text'
                    : 'text-text-sub hover:text-text hover:bg-hover'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <div className="relative">
              <button
                ref={notificationButtonRef}
                onClick={toggleNotifications}
                className="relative text-xs px-2.5 md:px-3 py-1.5 rounded-md border border-border text-text-sub hover:text-text hover:border-text-hint transition-all"
                aria-label="채팅 알림"
                title="채팅 알림"
              >
                <BellIcon />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-active text-active-text text-[10px] font-bold flex items-center justify-center">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <div
                  ref={notificationPanelRef}
                  className="absolute right-0 mt-2 w-[20rem] max-w-[80vw] rounded-xl border border-border bg-surface text-text shadow-2xl p-2 z-50"
                >
                  <div className="px-2 py-1.5 text-xs text-text-sub">채팅 알림</div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-text-hint">새 알림이 없습니다</div>
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => moveToNotifiedRoom(item)}
                          className="w-full text-left px-2 py-2 rounded-lg hover:bg-hover transition-colors flex items-start gap-3"
                        >
                          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-surface-3 overflow-hidden flex items-center justify-center text-text-sub font-bold text-sm">
                            {item.senderProfileImage ? (
                              <img
                                src={item.senderProfileImage.startsWith('http') ? item.senderProfileImage : `/api${item.senderProfileImage}`}
                                alt={item.roomName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fb = e.currentTarget.parentElement?.querySelector('.fallback-avatar');
                                  if (fb) fb.classList.remove('hidden');
                                  if (fb) fb.classList.add('flex');
                                }}
                              />
                            ) : null}
                            <div className={`fallback-avatar w-full h-full items-center justify-center bg-surface-3 text-text-sub ${item.senderProfileImage ? 'hidden' : 'flex'}`}>
                              {item.roomName?.[0] || '?'}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-text truncate flex items-center gap-1">
                              <span className="truncate">{item.roomName}</span>
                              {item.notificationType === 'incoming_call' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">통화</span>
                              )}
                            </div>
                            <div className="text-xs text-text-sub truncate mt-0.5">{item.preview}</div>
                            <div className="text-[10px] text-text-hint mt-1">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          {!item.seen && (
                            <div className="w-2 h-2 rounded-full bg-active mt-2 shrink-0"></div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {user?.wallet_address && taskTokenBalance !== null && (
              <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-full border border-border bg-surface-2 mx-0.5 md:mx-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)] shrink-0 transition-colors" title="TASK 잔액">
                {taskTokenImage ? (
                  <img src={taskTokenImage} alt="TASK" className="w-5 h-5 rounded-full object-cover shrink-0 shadow-sm bg-surface-3" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm">
                    T
                  </div>
                )}
                <span className="text-xs font-semibold text-text tabular-nums tracking-tight">
                  {taskTokenBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} <span className="text-[10px] text-text-hint font-medium ml-0.5">TASK</span>
                </span>
              </div>
            )}

            <div className="relative">
              <button
                ref={profileButtonRef}
                onClick={toggleProfileMenu}
                className="w-9 h-9 rounded-full border border-border overflow-hidden bg-surface-3 flex items-center justify-center text-sm font-semibold text-text-sub hover:border-text-hint transition-all"
                aria-label="프로필 메뉴"
                title="프로필 메뉴"
              >
                {profileImageSrc && !isProfileImageError ? (
                  <img
                    src={profileImageSrc}
                    alt="프로필"
                    className="w-full h-full object-cover"
                    onError={() => setIsProfileImageError(true)}
                  />
                ) : (
                  <span>{profileInitial}</span>
                )}
              </button>

              {isProfileMenuOpen && (
                <div
                  ref={profileMenuRef}
                  className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-surface text-text shadow-2xl p-1.5 z-50"
                >
                  <button
                    onClick={cycleTheme}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover transition-colors text-sm flex items-center justify-between"
                  >
                    <span>{themeLabel}</span>
                    <span>{themeIcon}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/mypage');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover transition-colors text-sm"
                  >
                    설정
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/membership');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover transition-colors text-sm"
                  >
                    멤버십
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors text-sm"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {pendingIncomingCall && location.pathname !== '/messages' && (
        <div className="fixed z-50 left-4 right-4 md:left-auto md:right-5 top-[4.25rem] md:top-[4.75rem] md:w-[22rem]">
          <div className="rounded-2xl border border-emerald-500/30 bg-surface/95 backdrop-blur-xl shadow-2xl p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.25C3 4.56 3.56 4 4.25 4h2.12a1.5 1.5 0 011.47 1.21l.6 2.86a1.5 1.5 0 01-.4 1.35l-1.03 1.03a14 14 0 006.03 6.03l1.03-1.03a1.5 1.5 0 011.35-.4l2.86.6A1.5 1.5 0 0120 17.13v2.12c0 .69-.56 1.25-1.25 1.25h-.5C10.94 20.5 3.5 13.06 3.5 3.75v-.5z" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-emerald-500">수신 전화</div>
                <div className="text-sm text-text mt-0.5 truncate">
                  {(pendingIncomingCall.callerNickname || '상대방')}님이 전화를 걸고 있습니다.
                </div>
                <div className="text-[11px] text-text-hint mt-1 truncate">
                  {pendingIncomingCall.roomName || '채팅방'}
                </div>
              </div>
            </div>

            <button
              onClick={() => moveToIncomingCallRoom(pendingIncomingCall)}
              className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 transition-colors"
            >
              통화 화면으로 이동
            </button>
          </div>
        </div>
      )}

      {chatMessageOverlay && (
        <div className={`fixed z-50 left-4 right-4 md:left-auto md:right-5 ${pendingIncomingCall && location.pathname !== '/messages' ? 'top-[9.5rem] md:top-[10rem]' : 'top-[4.25rem] md:top-[4.75rem]'} md:w-[22rem]`}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => moveToNotifiedRoom(chatMessageOverlay)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                moveToNotifiedRoom(chatMessageOverlay);
              }
            }}
            className="w-full rounded-2xl border border-blue-500/45 bg-surface/98 backdrop-blur-md shadow-2xl p-3 text-left hover:border-blue-400/70 transition-colors"
            style={{
              animation: 'chatOverlayIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getNotificationAvatarSrc(chatMessageOverlay) ? '' : 'bg-surface-3 text-text font-semibold text-lg'}`}>
                {getNotificationAvatarSrc(chatMessageOverlay) ? (
                  <img
                    src={getNotificationAvatarSrc(chatMessageOverlay) || undefined}
                    alt={chatMessageOverlay.roomName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : chatMessageOverlay.roomType === 'team' ? (
                  <svg className="w-5 h-5 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 20v-2a4 4 0 0 0-3-3.87" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (
                  <span>{chatMessageOverlay.roomName?.[0] || '?'}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-blue-500">새 메시지</div>
                <div className="text-sm font-semibold text-text mt-0.5 truncate">{chatMessageOverlay.roomName}</div>
                <div className="text-[13px] leading-5 text-text mt-1 line-clamp-2 break-words">{chatMessageOverlay.preview}</div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setChatMessageOverlay(null);
                  if (chatOverlayTimerRef.current) {
                    window.clearTimeout(chatOverlayTimerRef.current);
                    chatOverlayTimerRef.current = null;
                  }
                }}
                className="text-text-sub hover:text-text p-1 rounded-md hover:bg-surface-2 transition-colors"
                aria-label="채팅 알림 닫기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-2 h-1 w-full rounded-full bg-blue-500/20 overflow-hidden">
              <div
                key={chatMessageOverlay.id}
                className="h-full rounded-full bg-blue-500"
                style={{
                  animation: `chatOverlayProgress ${CHAT_MESSAGE_OVERLAY_DURATION_MS}ms linear forwards`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 pt-14 md:pt-16 pb-20 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 md:px-5 py-4 md:py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-2">
        <div className="grid grid-cols-5 gap-1 max-w-xl mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${isActive
                  ? 'bg-active text-active-text'
                  : 'text-text-hint hover:text-text-sub hover:bg-hover'
                }`
              }
            >
              <item.icon />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;

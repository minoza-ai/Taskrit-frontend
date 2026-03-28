import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
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

const UserIcon = () => {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
  { to: '/mypage', label: '마이페이지', icon: UserIcon },
];

type ChatNotification = {
  id: string;
  roomId: string;
  roomName: string;
  preview: string;
  createdAt: string;
  seen: boolean;
  senderProfileImage?: string;
};

const AppLayout = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationSocketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const lastNotifiedMessageByRoomRef = useRef<Record<string, string>>({});

  const cycleTheme = () => {
    const next = themeMode === 'system' ? 'dark' : themeMode === 'dark' ? 'light' : 'system';
    setThemeMode(next);
  };

  const themeIcon = themeMode === 'system' ? '⚙' : resolvedTheme() === 'dark' ? '🌙' : '☀️';
  const themeLabel = themeMode === 'system' ? '시스템' : themeMode === 'dark' ? '다크' : '라이트';
  const unreadNotificationCount = useMemo(() => notifications.filter((item) => !item.seen).length, [notifications]);

  useEffect(() => {
    if (!accessToken) {
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
          if (payload.type !== 'notification' || payload.event !== 'new_message') {
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

          setNotifications((prev) => [
            {
              id: `${roomId}-${messageId}`,
              roomId,
              roomName: (payload.room_name as string) || '채팅방',
              preview: (payload.message?.text as string) || '새 메시지가 도착했습니다.',
              createdAt: (payload.message?.created_at as string) || new Date().toISOString(),
              seen: false,
              senderProfileImage: payload.message?.sender_profile_image as string | undefined,
            },
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
  }, [accessToken, location.pathname, user?.user_uuid]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationPanelRef.current?.contains(target)) return;
      if (notificationButtonRef.current?.contains(target)) return;

      setIsNotificationOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const toggleNotifications = () => {
    setIsNotificationOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotifications((items) => items.map((item) => ({ ...item, seen: true })));
      }
      return next;
    });
  };

  const moveToNotifiedRoom = (notification: ChatNotification) => {
    setIsNotificationOpen(false);
    navigate(`/messages?room=${encodeURIComponent(notification.roomId)}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
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
                {user.wallet_address && <VerifiedIcon />}
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
                            <div className="text-xs font-semibold text-text truncate">{item.roomName}</div>
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

            <button
              onClick={cycleTheme}
              title={`테마: ${themeLabel}`}
              className="text-xs px-2.5 md:px-3 py-1.5 rounded-md border border-border text-text-sub hover:text-text hover:border-text-hint transition-all flex items-center gap-1 md:gap-1.5"
            >
              <span>{themeIcon}</span>
              <span className="hidden md:inline">{themeLabel}</span>
            </button>
            <button
              onClick={() => navigate('/membership')}
              className="text-xs px-2.5 md:px-3 py-1.5 rounded-md border border-border text-text-sub hover:text-text hover:border-text-hint transition-all"
            >
              멤버십
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="text-xs text-text-hint hover:text-text transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

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

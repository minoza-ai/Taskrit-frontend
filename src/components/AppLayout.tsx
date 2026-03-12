import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/theme';

const navItems = [
  { to: '/dashboard', label: '대시보드', icon: DashboardIcon },
  { to: '/projects', label: '프로젝트', icon: ProjectIcon },
  { to: '/marketplace', label: '마켓', icon: MarketIcon },
  { to: '/messages', label: '메시지', icon: MessageIcon },
  { to: '/mypage', label: '마이페이지', icon: UserIcon },
];

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const cycleTheme = () => {
    const next = themeMode === 'system' ? 'dark' : themeMode === 'dark' ? 'light' : 'system';
    setThemeMode(next);
  };

  const themeIcon = themeMode === 'system' ? '⚙' : resolvedTheme() === 'dark' ? '🌙' : '☀️';
  const themeLabel = themeMode === 'system' ? '시스템' : themeMode === 'dark' ? '다크' : '라이트';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border-light bg-bg/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="font-display font-black text-lg tracking-tight text-text cursor-pointer"
            >
              Taskrit
            </button>
            {user && (
              <span className="text-xs text-text-hint font-normal">{user.nickname}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              title={`테마: ${themeLabel}`}
              className="text-xs px-3 py-1.5 rounded-md border border-border text-text-sub hover:text-text hover:border-text-hint transition-all flex items-center gap-1.5"
            >
              <span>{themeIcon}</span>
              <span>{themeLabel}</span>
            </button>
            <button
              onClick={() => navigate('/membership')}
              className="text-xs px-3 py-1.5 rounded-md border border-border text-text-sub hover:text-text hover:border-text-hint transition-all"
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
      <main className="flex-1 pt-14 pb-24">
        <div className="max-w-6xl mx-auto px-5 py-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation - pill style */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
        <div className="flex gap-1.5 bg-surface-2 rounded-full p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] [[data-theme=light]_&]:shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-border">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-active text-active-text shadow-md'
                    : 'text-text-hint hover:text-text-sub hover:bg-hover'
                }`
              }
              title={item.label}
            >
              <item.icon />
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* Icons */
function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

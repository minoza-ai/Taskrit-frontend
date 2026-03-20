import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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

const navItems = [
  { to: '/dashboard', label: '대시보드', icon: DashboardIcon },
  { to: '/projects', label: '프로젝트', icon: ProjectIcon },
  { to: '/marketplace', label: '마켓', icon: MarketIcon },
  { to: '/messages', label: '메시지', icon: MessageIcon },
  { to: '/mypage', label: '마이페이지', icon: UserIcon },
];

const AppLayout = () => {
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
        <div className="max-w-6xl mx-auto px-4 md:px-5 h-14 md:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="font-display font-black text-lg tracking-tight text-text cursor-pointer"
            >
              Taskrit
            </button>
            {user && (
              <span className="text-xs text-text-hint font-normal truncate max-w-24 md:max-w-none">{user.nickname}</span>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border bg-surface/70 px-2 py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
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
                `h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                  isActive
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

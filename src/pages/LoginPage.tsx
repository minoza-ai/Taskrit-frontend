import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(userId && password && !isLoading);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await login(userId, password);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.status === 429) {
        setError('로그인 시도 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(err.message || '로그인에 실패했습니다');
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-in">
        <h1 className="font-display font-black text-5xl text-center mb-2 tracking-tight">Taskrit</h1>
        <p className="text-text-hint text-sm text-center mb-8">차세대 태스크 매칭 플랫폼</p>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">아이디</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="아이디 입력"
              autoComplete="username"
              className="glass-input w-full px-3.5 py-3 rounded-md text-[15px] font-sans"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              autoComplete="current-password"
              className="glass-input w-full px-3.5 py-3 rounded-md text-[15px] font-sans"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-md bg-error-bg text-error text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full py-3.5 rounded-lg text-[15px] cursor-pointer mt-2"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-text-hint">
          <Link to="/" className="hover:text-text-sub transition-colors">
            ← 돌아가기
          </Link>
          <span className="mx-3">·</span>
          <Link to="/register" className="hover:text-text-sub transition-colors">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

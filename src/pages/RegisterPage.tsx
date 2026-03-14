import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

const RegisterPage = () => {
  const navigate = useNavigate();
  const registerFn = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(
    userId && nickname && password && password === passwordConfirm && !isLoading,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await registerFn(userId, nickname, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-in">
        <h1 className="text-2xl font-bold text-center mb-8">회원가입</h1>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">아이디</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="사용할 아이디"
              autoComplete="username"
              className="glass-input w-full px-3.5 py-3 rounded-md text-[15px] font-sans"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="서비스 내 표시될 이름"
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
              autoComplete="new-password"
              className="glass-input w-full px-3.5 py-3 rounded-md text-[15px] font-sans"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">비밀번호 확인</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 다시 입력"
              autoComplete="new-password"
              className="glass-input w-full px-3.5 py-3 rounded-md text-[15px] font-sans"
            />
            {password && passwordConfirm && password !== passwordConfirm && (
              <p className="text-xs text-error mt-1">비밀번호가 일치하지 않습니다</p>
            )}
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
            {isLoading ? '처리 중...' : '가입하기'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-text-hint">
          <Link to="/" className="hover:text-text-sub transition-colors">
            ← 돌아가기
          </Link>
          <span className="mx-3">·</span>
          <Link to="/login" className="hover:text-text-sub transition-colors">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;

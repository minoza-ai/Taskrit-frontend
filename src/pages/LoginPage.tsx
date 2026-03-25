import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import * as api from '../lib/api';

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loginWithWallet = useAuthStore((s) => s.loginWithWallet);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(userId && password && !isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await login(userId, password, otpCode.trim() || undefined);
      navigate('/dashboard');
    } catch (err: any) {
      if (err?.otp_required) {
        setOtpRequired(true);
        setError('OTP 인증 코드 6자리를 입력해주세요.');
        return;
      }
      if (err.status === 429) {
        setError('로그인 시도 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(err.message || '로그인에 실패했습니다');
      }
    }
  };

  const handleWalletLogin = async () => {
    setError(null);

    try {
      if (!window.solana?.isPhantom) {
        setError('Phantom 지갑 확장 프로그램을 찾을 수 없습니다. 설치 후 다시 시도해주세요.');
        return;
      }

      const connectResult = await window.solana.connect();
      const walletAddress = connectResult.publicKey?.toString() || window.solana.publicKey?.toString();

      if (!walletAddress) {
        setError('지갑 주소를 확인할 수 없습니다.');
        return;
      }

      const { nonce, message } = await api.walletConnectRequest(walletAddress);
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await window.solana.signMessage(encodedMessage, 'utf8');
      const signature = uint8ArrayToBase64(signed.signature);

      await loginWithWallet(walletAddress, signature, nonce, message, otpCode.trim() || undefined);
      navigate('/dashboard');
    } catch (err: any) {
      if (err?.otp_required) {
        setOtpRequired(true);
        setError('OTP 인증 코드 6자리를 입력한 뒤 다시 시도해주세요.');
        return;
      }
      if (err?.status === 429) {
        setError('로그인 시도 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(err?.message || '지갑 로그인에 실패했습니다.');
      }
    }
  };

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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">
              OTP 코드 {otpRequired ? '(필수)' : '(2차인증 사용 시 입력)'}
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6자리 인증 코드"
              inputMode="numeric"
              autoComplete="one-time-code"
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

          <div className="flex items-center gap-2 text-xs text-text-hint">
            <span className="h-px flex-1 bg-border" />
            <span>또는</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleWalletLogin()}
            className="btn-ghost w-full py-3.5 rounded-lg text-[15px] border border-border hover:bg-surface-2 transition-colors disabled:opacity-60"
          >
            {isLoading ? '지갑 확인 중...' : 'Phantom 지갑으로 로그인'}
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
};

export default LoginPage;

declare global {
  interface SolanaProvider {
    isPhantom?: boolean;
    publicKey?: { toString(): string };
    connect: () => Promise<{ publicKey: { toString(): string } }>;
    signMessage: (
      message: Uint8Array,
      display?: 'utf8' | 'hex',
    ) => Promise<{ signature: Uint8Array }>;
  }

  interface Window {
    solana?: SolanaProvider;
  }
}

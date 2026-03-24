import { useState } from 'react';
import { useAuthStore } from '../lib/store';
import * as api from '../lib/api';
import PopupModal from '../components/PopupModal';
import { useChatSettingsStore } from '../lib/chatSettings';

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const MyPage = () => {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const setUser = useAuthStore((s) => s.setUser);
  const optimizeUploadedImages = useChatSettingsStore((s) => s.optimizeUploadedImages);
  const setOptimizeUploadedImages = useChatSettingsStore((s) => s.setOptimizeUploadedImages);

  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wallet states
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !accessToken) return;
    const file = e.target.files[0];

    if (file.size > 10 * 1024 * 1024) {
      setError('이미지 파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    setUploadingImage(true);
    setStatus(null);
    setError(null);

    const performUpload = async (token: string) => {
      const updatedUser = await api.uploadProfileImage(token, file);
      setUser(updatedUser);
      setStatus('프로필 이미지가 변경되었습니다.');
    };

    try {
      await performUpload(accessToken);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          const newToken = useAuthStore.getState().accessToken;
          if (newToken) {
            try {
              await performUpload(newToken);
            } catch (retryErr: any) {
              setError(retryErr.message || '프로필 이미지 변경에 실패했습니다.');
            }
            return;
          }
        }
        logout();
        return;
      }
      setError(err.message || '프로필 이미지 변경에 실패했습니다.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const data: { nickname?: string; password?: string } = {};
      if (nickname !== user?.nickname) data.nickname = nickname;
      if (newPassword) {
        if (newPassword !== newPasswordConfirm) {
          setError('비밀번호가 일치하지 않습니다');
          setBusy(false);
          return;
        }
        data.password = newPassword;
      }
      await updateUser(data);
      setStatus('정보가 수정되었습니다');
      setEditMode(false);
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: any) {
      setError(err.message || '수정에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount();
    } catch (err: any) {
      setError(err.message || '탈퇴에 실패했습니다');
    }
  };

  const handleConnectWallet = async () => {
    if (!accessToken) return;
    setWalletBusy(true);
    setWalletError(null);
    setWalletStatus(null);
    try {
      if (!window.solana?.isPhantom) {
        setWalletError('Phantom 지갑 확장 프로그램을 찾을 수 없습니다. 설치 후 Solana Devnet으로 연결해주세요.');
        setWalletBusy(false);
        return;
      }

      const connectResult = await window.solana.connect();
      const walletAddress = connectResult.publicKey?.toString() || window.solana.publicKey?.toString();

      if (!walletAddress) {
        setWalletError('지갑 계정을 확인할 수 없습니다');
        setWalletBusy(false);
        return;
      }

      // Step 1: Request nonce
      const { nonce, message } = await api.walletConnectRequest(walletAddress);

      const encodedMessage = new TextEncoder().encode(message);
      const signed = await window.solana.signMessage(encodedMessage, 'utf8');
      const signature = uint8ArrayToBase64(signed.signature);

      // Step 3: Confirm
      try {
        await api.walletConnectConfirm(accessToken, walletAddress, signature, nonce, message, 'base64');
      } catch (err: any) {
        if (err.status !== 401) throw err;

        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          throw err;
        }

        const refreshedToken = useAuthStore.getState().accessToken;
        if (!refreshedToken) {
          logout();
          throw err;
        }

        await api.walletConnectConfirm(refreshedToken, walletAddress, signature, nonce, message, 'base64');
      }

      setWalletStatus('지갑이 연동되었습니다');
      await fetchUser();
    } catch (err: any) {
      setWalletError(err.message || '지갑 연동에 실패했습니다');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleDisconnectWallet = async () => {
    if (!accessToken) return;
    setWalletBusy(true);
    setWalletError(null);
    try {
      try {
        await api.walletDisconnect(accessToken);
      } catch (err: any) {
        if (err.status !== 401) throw err;

        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          throw err;
        }

        const refreshedToken = useAuthStore.getState().accessToken;
        if (!refreshedToken) {
          logout();
          throw err;
        }

        await api.walletDisconnect(refreshedToken);
      }

      setWalletStatus('지갑 연동이 해제되었습니다');
      await fetchUser();
    } catch (err: any) {
      setWalletError(err.message || '지갑 연동 해제에 실패했습니다');
    } finally {
      setWalletBusy(false);
    }
  };

  const requestDeleteAccount = () => {
    setIsDeleteConfirmOpen(true);
  };

  const requestDisconnectWallet = () => {
    setIsDisconnectConfirmOpen(true);
  };

  if (!user) {
    return (
      <div className="animate-in text-center py-12 text-text-sub">
        사용자 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="animate-in max-w-lg">
      <h1 className="text-2xl font-bold mb-6">마이페이지</h1>

      {/* User Info Card */}
      <div className="glass-card rounded-lg p-5 mb-4 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">계정 정보</h2>
          {!editMode && (
            <button
              onClick={() => { setEditMode(true); setNickname(user.nickname); }}
              className="text-xs text-text-sub hover:text-text transition-colors"
            >
              수정
            </button>
          )}
        </div>

        {/* Profile Image Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-gray-200 cursor-pointer shadow-md" onClick={() => document.getElementById('profile-upload')?.click()}>
            {user.profile_image_url ? (
              <img
                src={user.profile_image_url.startsWith('http') ? user.profile_image_url : `/api${user.profile_image_url}`}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-avatar');
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
            ) : null}

            <div className={`fallback-avatar w-full h-full flex items-center justify-center text-gray-500 bg-gray-300 absolute inset-0 ${user.profile_image_url ? 'hidden' : ''}`}>
              <span className="text-2xl font-bold">{user.nickname?.[0]}</span>
            </div>

            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-semibold">편집</span>
            </div>
            {uploadingImage && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10">
                <span className="text-white text-xs">업로드 중...</span>
              </div>
            )}
          </div>
          <input
            type="file"
            id="profile-upload"
            className="hidden"
            accept="image/*"
            onChange={handleProfileImageChange}
          />
          <p className="text-xs text-text-sub mt-2">프로필 사진 클릭하여 변경</p>
        </div>

        {editMode ? (
          <form onSubmit={handleUpdate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="glass-input px-3.5 py-2.5 rounded-md text-sm font-sans"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="변경하지 않으려면 비워두세요"
                autoComplete="new-password"
                className="glass-input px-3.5 py-2.5 rounded-md text-sm font-sans"
              />
            </div>
            {newPassword && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="새 비밀번호 다시 입력"
                  autoComplete="new-password"
                  className="glass-input px-3.5 py-2.5 rounded-md text-sm font-sans"
                />
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary px-5 py-2.5 rounded-lg text-sm cursor-pointer"
              >
                {busy ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => { setEditMode(false); setError(null); }}
                className="btn-ghost px-4 py-2.5 rounded-lg text-sm"
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <InfoRow label="UUID" value={user.user_uuid} />
            <InfoRow label="아이디" value={user.user_id} />
            <InfoRow label="닉네임" value={user.nickname} />
            <InfoRow
              label="가입일"
              value={new Date(user.created_at * 1000).toLocaleDateString('ko-KR')}
            />
          </div>
        )}
      </div>

      {status && (
        <div className="px-4 py-3 rounded-md bg-success-bg text-success text-sm mb-4">
          {status}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-md bg-error-bg text-error text-sm mb-4">
          {error}
        </div>
      )}

      {/* Wallet Section */}
      <div className="glass-card rounded-lg p-5 mb-4">
        <h2 className="text-base font-semibold mb-4">Web3 지갑</h2>

        {user.wallet_address ? (
          <div>
            <InfoRow label="연동 주소" value={user.wallet_address} />
            <button
              onClick={requestDisconnectWallet}
              disabled={walletBusy}
              className="btn-danger btn-ghost text-sm mt-3 px-3 py-1.5 rounded-md"
            >
              {walletBusy ? '처리 중...' : '연동 해제'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-sub">Phantom 지갑으로 서명해 Solana Devnet 주소를 연동하세요.</p>
            <button
              onClick={handleConnectWallet}
              disabled={walletBusy}
              className="btn-primary px-4 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap self-start"
            >
              {walletBusy ? '연동 중...' : 'Phantom으로 연동'}
            </button>
          </div>
        )}

        {walletStatus && (
          <div className="px-4 py-3 rounded-md bg-success-bg text-success text-sm mt-3">
            {walletStatus}
          </div>
        )}
        {walletError && (
          <div className="px-4 py-3 rounded-md bg-error-bg text-error text-sm mt-3">
            {walletError}
          </div>
        )}
      </div>

      {/* Chat Settings */}
      <div className="glass-card rounded-lg p-5 mb-4">
        <h2 className="text-base font-semibold mb-4">채팅 설정</h2>
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={optimizeUploadedImages}
            onChange={(e) => setOptimizeUploadedImages(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border text-blue-500 focus:ring-0"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">이미지 업로드 시 용량 최적화</span>
            <span className="text-xs text-text-sub">
              켜면 사진을 압축해 빠르게 전송하고, 끄면 원본 화질 그대로 전송합니다.
            </span>
          </div>
        </label>
      </div>

      {/* Danger Zone */}
      <div className="border border-error/20 rounded-lg p-5">
        <h2 className="text-base font-semibold text-error mb-2">위험 영역</h2>
        <p className="text-sm text-text-sub mb-4">계정을 탈퇴하면 복구할 수 없습니다.</p>
        <button
          onClick={requestDeleteAccount}
          className="text-sm text-error hover:bg-error-bg px-4 py-2 rounded-md transition-colors"
        >
          계정 탈퇴
        </button>
      </div>

      <PopupModal
        open={isDisconnectConfirmOpen}
        title="지갑 연동 해제"
        message="지갑 연동을 해제하시겠습니까?"
        confirmText={walletBusy ? '처리 중...' : '해제'}
        cancelText="취소"
        variant="confirm"
        destructive
        busy={walletBusy}
        onClose={() => setIsDisconnectConfirmOpen(false)}
        onConfirm={async () => {
          await handleDisconnectWallet();
          setIsDisconnectConfirmOpen(false);
        }}
      />

      <PopupModal
        open={isDeleteConfirmOpen}
        title="계정 탈퇴"
        message={'정말 탈퇴하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'}
        confirmText="탈퇴"
        cancelText="취소"
        variant="confirm"
        destructive
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await handleDelete();
          setIsDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-text-hint uppercase tracking-wider font-medium">
        {label}
      </span>
      <span className="text-sm text-text font-medium break-all">{value}</span>
    </div>
  );
};

export default MyPage;

// Extend window for Phantom provider
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

import { useState } from 'react';
import { getAddress } from 'ethers';
import { useAuthStore } from '../lib/store';
import * as api from '../lib/api';
import PopupModal from '../components/PopupModal';

const normalizeEthAddress = (address: string): string => {
  try {
    return getAddress(address.trim());
  } catch {
    // Fallback if address is invalid
    return address.trim().toLowerCase();
  }
};

const MyPage = () => {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wallet states
  const [walletAddress, setWalletAddress] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);

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
    if (!accessToken || !walletAddress) return;
    setWalletBusy(true);
    setWalletError(null);
    setWalletStatus(null);
    try {
      // Step 1: Request nonce
      const { nonce, message } = await api.walletConnectRequest(walletAddress);

      // Step 2: Request signature from EVM wallet provider
      if (!window.ethereum) {
        setWalletError('이더리움 지갑 확장 프로그램을 찾을 수 없습니다');
        setWalletBusy(false);
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      const account = accounts[0];

      if (!account) {
        setWalletError('지갑 계정을 확인할 수 없습니다');
        setWalletBusy(false);
        return;
      }

      if (normalizeEthAddress(account) !== normalizeEthAddress(walletAddress)) {
        setWalletError('입력한 주소와 지갑에서 서명한 주소가 일치하지 않습니다. 지갑의 이더리움 계정 주소를 입력해주세요.');
        setWalletBusy(false);
        return;
      }

      const signMessage = `${message}\nNonce: ${nonce}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [signMessage, account],
      });

      // Step 3: Confirm
      try {
        await api.walletConnectConfirm(accessToken, walletAddress, signature, nonce, message);
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

        await api.walletConnectConfirm(refreshedToken, walletAddress, signature, nonce, message);
      }

      setWalletStatus('지갑이 연동되었습니다');
      setWalletAddress('');
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
      <div className="glass-card rounded-lg p-5 mb-4">
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
            <p className="text-sm text-text-sub">원하는 지갑 서비스에서 사용하는 이더리움 주소를 입력해 연동하세요.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="glass-input flex-1 px-3.5 py-2.5 rounded-md text-sm font-sans font-mono"
              />
              <button
                onClick={handleConnectWallet}
                disabled={walletBusy || !walletAddress}
                className="btn-primary px-4 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap"
              >
                {walletBusy ? '연동 중...' : '연동'}
              </button>
            </div>
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

// Extend window for ethereum provider
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<any>;
    };
  }
}

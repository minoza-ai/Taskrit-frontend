import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../lib/store';
import * as api from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

const MyAssetsPage = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [assets, setAssets] = useState<api.Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetUuid, setDeleteTargetUuid] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const assetCountText = useMemo(() => `${assets.length}개`, [assets.length]);

  useEffect(() => {
    if (accessToken) {
      loadAssets();
    }
  }, [accessToken]);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyAssets(accessToken!);
      setAssets(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '자산 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newFile || !newName || !newDesc) return;

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      await api.createAsset(accessToken, {
        name: newName,
        description: newDesc,
        file: newFile,
      });
      setNewName('');
      setNewDesc('');
      setNewFile(null);
      setIsCreating(false);
      setStatus('자산이 등록되었습니다.');
      setTimeout(() => setStatus(null), 3000);
      loadAssets();
    } catch (err: any) {
      console.error(err);
      setError(err.message || '자산 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!accessToken || !deleteTargetUuid) return;
    
    setIsDeleting(true);
    try {
      await api.deleteAsset(accessToken, deleteTargetUuid);
      setAssets(assets.filter((a) => a.asset_uuid !== deleteTargetUuid));
      setStatus('자산이 삭제되었습니다.');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '자산 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTargetUuid(null);
    }
  };

  const handleDeleteClick = (uuid: string) => {
    setDeleteTargetUuid(uuid);
    setDeleteConfirmOpen(true);
  };

  if (!user) {
    return (
      <div className="animate-in glass-card rounded-lg p-12 text-center">
        <p className="text-text-sub mb-1">로그인이 필요합니다</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">내 자산</h1>
          <p className="text-text-sub text-sm mt-1">자산을 등록하고 프로젝트에 매칭하세요. ({assetCountText})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAssets}
            disabled={loading}
            className="btn-secondary px-4 py-2.5 rounded-lg text-sm"
          >
            새로고침
          </button>
          <button
            onClick={() => {
              setIsCreating(!isCreating);
              setError(null);
              setStatus(null);
            }}
            className="btn-primary px-5 py-2.5 rounded-lg text-sm cursor-pointer"
          >
            {isCreating ? '취소' : '+ 새 자산 등록'}
          </button>
        </div>
      </div>

      {/* Status/Error Messages */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
          {error}
        </div>
      )}
      {status && (
        <div className="mb-4 px-4 py-3 rounded-md bg-active text-active-text text-sm">
          {status}
        </div>
      )}

      {/* Create Form */}
      {isCreating && (
        <div className="glass-card rounded-lg p-6 mb-6 animate-in">
          <h2 className="text-lg font-semibold mb-1">새 자산 등록</h2>
          <p className="text-text-sub text-sm mb-6">능력치 벡터화를 위해 설명을 상세하게 작성해주세요.</p>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">자산 이름</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: Python FastAPI 백엔드 템플릿"
                className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">설명 (매칭 알고리즘 학습용)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="예: Python, FastAPI, MongoDB, Docker, JWT 인증, RESTful API 구현, 에러 핸들링..."
                rows={4}
                className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[100px]"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">파일 업로드</label>
              <input
                type="file"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                  setNewDesc('');
                  setNewFile(null);
                  setError(null);
                }}
                className="btn-secondary px-5 py-2.5 rounded-lg text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !newName || !newDesc || !newFile}
                className="btn-primary px-5 py-2.5 rounded-lg text-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <p className="text-text-sub mb-1">자산 목록을 불러오는 중입니다</p>
          <p className="text-text-hint text-xs">잠시만 기다려주세요</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <p className="text-text-sub mb-1">등록된 자산이 없습니다</p>
          <p className="text-text-hint text-xs">새 자산을 등록하여 프로젝트에 매칭받으세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.asset_uuid}
              className="glass-card rounded-lg p-5 flex flex-col hover:border-text-hint transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold flex-1 break-words">{asset.name}</h3>
                <button
                  onClick={() => handleDeleteClick(asset.asset_uuid)}
                  className="text-text-hint hover:text-error ml-2 transition-colors text-xl leading-none"
                  title="자산 삭제"
                >
                  ×
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-text-sub mb-4 line-clamp-4 break-words">
                {asset.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                <a
                  href={asset.file_url.startsWith('http') ? asset.file_url : `/api${asset.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-active hover:underline font-medium"
                >
                  파일 다운로드 →
                </a>
                <span className="text-xs text-text-hint">
                  {new Date(asset.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="자산 삭제"
        message={'정말로 이 자산을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'}
        buttons={[
          {
            label: '취소',
            onClick: () => {
              setDeleteConfirmOpen(false);
              setDeleteTargetUuid(null);
            },
            variant: 'secondary',
          },
          {
            label: isDeleting ? '삭제 중...' : '삭제',
            onClick: handleDeleteConfirm,
            variant: 'error',
            disabled: isDeleting,
          },
        ]}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteTargetUuid(null);
        }}
      />
    </div>
  );
};

export default MyAssetsPage;

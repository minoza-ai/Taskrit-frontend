import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import * as api from '../lib/api';

const MyAssetsPage = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [assets, setAssets] = useState<api.Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (accessToken) {
      loadAssets();
    }
  }, [accessToken]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await api.getMyAssets(accessToken!);
      setAssets(data);
    } catch (err: any) {
      console.error(err);
      setError('자산 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newFile || !newName || !newDesc) return;

    setSubmitting(true);
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
      loadAssets(); // Refresh list
    } catch (err: any) {
      console.error(err);
      alert('자산 생성 실패: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!accessToken || !window.confirm('정말 이 자산을 삭제하시겠습니까?')) return;
    try {
      await api.deleteAsset(accessToken, uuid);
      setAssets(assets.filter(a => a.asset_uuid !== uuid));
    } catch (err: any) {
      console.error(err);
      alert('삭제 실패');
    }
  };

  if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

  return (
    <div className="animate-in max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">내 자산 관리</h1>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
        >
          {isCreating ? '취소' : '새 자산 등록'}
        </button>
      </div>

      {isCreating && (
        <div className="glass-card p-6 mb-8 animate-in">
          <h2 className="text-lg font-semibold mb-4">새 자산 등록</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">자산 이름</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2 border rounded bg-white/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">설명 (매칭에 사용됩니다)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full p-2 border rounded bg-white/50 h-24"
                placeholder="예: Python 백엔드 CRUD 템플릿, FastAPI, Docker 포함..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">파일 업로드</label>
              <input
                type="file"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="w-full p-2 border rounded bg-white/50"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">로딩 중...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">등록된 자산이 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assets.map((asset) => (
            <div key={asset.asset_uuid} className="glass-card p-5 relative group">
              <h3 className="text-lg font-bold mb-2">{asset.name}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{asset.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <a
                  href={asset.file_url.startsWith('http') ? asset.file_url : `/api${asset.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  파일 다운로드
                </a>
                <span className="text-xs text-gray-400">
                  {new Date(asset.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => handleDelete(asset.asset_uuid)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAssetsPage;

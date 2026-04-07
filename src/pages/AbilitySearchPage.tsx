import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { suggestProjectMatches, type TeamingMatchResult } from '../lib/api';
import { useAuthStore } from '../lib/store';

const parseBudgetToNumber = (value: string): number | undefined => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  return Number(digits);
};

const parseDeadlineToUnix = (value: string): number | undefined => {
  if (!value) return undefined;
  const unix = Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000);
  return Number.isNaN(unix) ? undefined : unix;
};

const formatSimilarity = (value: number): string => `${Math.round(value * 100)}%`;
const formatScore = (value: number): string => value.toFixed(2);

const accountTypeLabel = (type: string): string => {
  if (type === 'human') return '인간';
  if (type === 'agent') return 'AI';
  if (type === 'robot') return '로봇';
  if (type === 'asset') return '에셋';
  return type;
};

const candidateDisplayName = (candidate: { accountType: string; accountId: string; displayName?: string }): string => {
  if (candidate.accountType === 'asset') {
    return candidate.accountId;
  }

  return candidate.displayName || candidate.accountId;
};

const AbilitySearchPage = () => {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);

  const [query, setQuery] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requireHuman, setRequireHuman] = useState(true);
  const [matches, setMatches] = useState<TeamingMatchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!accessToken || isSearching || !query.trim()) return;

    setIsSearching(true);
    setError(null);

    const payload = {
      request: query.trim(),
      requiredDate: parseDeadlineToUnix(deadline),
      requiredCost: parseBudgetToNumber(budget),
      maxCost: parseBudgetToNumber(budget),
      requireHuman,
    };

    const runSearch = async (token: string) => {
      const result = await suggestProjectMatches(token, payload);
      setMatches(result.matches || []);
    };

    try {
      await runSearch(accessToken);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await runSearch(token);
          } catch (retryErr: any) {
            setError(retryErr.message || '능력치 검색에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '능력치 검색에 실패했습니다');
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="animate-in max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">능력치 검색</h1>
          <p className="text-sm text-text-sub mt-1">프로젝트 생성 없이 필요한 능력만으로 AI 팀 후보를 검색합니다.</p>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="btn-secondary px-4 py-2.5 rounded-lg text-sm"
        >
          프로젝트 목록
        </button>
      </div>

      <div className="glass-card rounded-lg p-5 mb-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-sub">검색할 능력/요구사항</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 실시간 채팅 서비스의 메시지 딜리버리 보장을 위한 백엔드 아키텍트와 테스트 자동화 엔지니어"
              rows={4}
              className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">예산(선택)</label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="예: 500000"
                className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">마감일(선택)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
              />
            </div>
          </div>

          <label className="glass-card rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold">인간 작업자 최소 1명 포함</p>
              <p className="text-xs text-text-sub mt-1">검색 결과에 human 후보를 우선 반영합니다.</p>
            </div>
            <input
              type="checkbox"
              checked={requireHuman}
              onChange={(e) => setRequireHuman(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <div className="flex justify-end">
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm cursor-pointer"
            >
              {isSearching ? '검색 중...' : 'AI 능력치 검색'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {matches.map((match) => {
          const nonAssetCandidates = match.candidates.filter((candidate) => candidate.accountType !== 'asset');
          const assetCandidates = match.candidates.filter((candidate) => candidate.accountType === 'asset');

          return (
            <div key={match.requiredAbility} className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">{match.requiredAbility}</p>
                <span className="text-xs text-text-sub">후보 {match.candidates.length}개</span>
              </div>

              <div className="flex flex-col gap-2">
                {nonAssetCandidates.map((candidate) => (
                  <div
                    key={`${match.requiredAbility}-${candidate.accountId}`}
                    className="rounded-lg border border-border bg-surface-2 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{candidateDisplayName(candidate)}</p>
                        <p className="text-xs text-text-sub mt-0.5">{accountTypeLabel(candidate.accountType)}</p>
                      </div>
                      <div className="text-right text-xs text-text-sub">
                        <p>유사도 {formatSimilarity(candidate.similarity)}</p>
                        <p>점수 {formatScore(candidate.score)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-sub mt-2 line-clamp-2">{candidate.abilityText || '능력 설명 없음'}</p>
                  </div>
                ))}

                {assetCandidates.length > 0 && (
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                    <p className="text-xs font-semibold text-text-sub mb-2">장비/자산 후보</p>
                    <div className="flex flex-col gap-2">
                      {assetCandidates.map((candidate) => (
                        <div key={`${match.requiredAbility}-asset-${candidate.accountId}`} className="text-xs text-text-sub">
                          <span className="font-medium text-text">{candidateDisplayName(candidate)}</span>
                          <span className="ml-2">유사도 {formatSimilarity(candidate.similarity)} · 점수 {formatScore(candidate.score)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {match.candidates.length === 0 && (
                  <p className="text-sm text-text-sub">매칭 후보가 없습니다.</p>
                )}
              </div>
            </div>
          );
        })}

        {!isSearching && matches.length === 0 && (
          <div className="glass-card rounded-lg p-5">
            <p className="text-sm text-text-sub">능력/요구사항을 입력하고 AI 능력치 검색을 실행하면 결과가 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbilitySearchPage;

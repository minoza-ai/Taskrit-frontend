import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import {
  createProject,
  suggestProjectMatches,
} from '../lib/api';
import type { TeamingMatchResult } from '../lib/api';

const parseBudgetToNumber = (value: string): number | null => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return Number(digits);
};

const parseDeadlineToUnix = (value: string): number | null => {
  if (!value) return null;
  const unix = Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000);
  return Number.isNaN(unix) ? null : unix;
};

const serializeCategories = (categories: string[]): string | null => {
  if (categories.length === 0) return null;
  return categories.join(', ');
};

const accountTypeLabel = (type: string): string => {
  if (type === 'human') return '인간';
  if (type === 'agent') return 'AI';
  if (type === 'robot') return '로봇';
  if (type === 'asset') return '에셋';
  return type;
};

const toRequirementType = (type: string): string => {
  if (type === 'agent') return 'ai';
  return type;
};

const formatSimilarity = (value: number): string => `${Math.round(value * 100)}%`;

const formatScore = (value: number): string => value.toFixed(2);

const ProjectCreatePage = () => {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [requireHuman, setRequireHuman] = useState(true);
  const [matches, setMatches] = useState<TeamingMatchResult[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
  const [isGeneratingMatches, setIsGeneratingMatches] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'AI 학습 데이터',
    '프롬프트 개발',
    '소프트웨어 개발',
    '데이터 분석',
    '콘텐츠 제작',
    '검수/검증',
    '기타',
  ];

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const selectedMatchRows = useMemo(() => {
    return matches.flatMap((match) => {
      const selectedAccountId = selectedCandidates[match.requiredAbility];
      if (!selectedAccountId) return [];

      const candidate = match.candidates.find((c) => c.accountId === selectedAccountId);
      if (!candidate) return [];

      return [{ requiredAbility: match.requiredAbility, candidate }];
    });
  }, [matches, selectedCandidates]);

  const handleGenerateMatches = async () => {
    if (!accessToken || isGeneratingMatches || !title.trim() || !description.trim()) return;

    setIsGeneratingMatches(true);
    setMatchError(null);

    const payload = {
      request: `${title.trim()}\n${description.trim()}`,
      requiredDate: parseDeadlineToUnix(deadline) ?? undefined,
      requiredCost: parseBudgetToNumber(budget) ?? undefined,
      maxCost: parseBudgetToNumber(budget) ?? undefined,
      requireHuman,
    };

    try {
      const result = await suggestProjectMatches(accessToken, payload);
      setMatches(result.matches || []);

      const nextSelection: Record<string, string> = {};
      (result.matches || []).forEach((match) => {
        if (match.candidates.length > 0) {
          nextSelection[match.requiredAbility] = match.candidates[0].accountId;
        }
      });
      setSelectedCandidates(nextSelection);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            const result = await suggestProjectMatches(token, payload);
            setMatches(result.matches || []);

            const nextSelection: Record<string, string> = {};
            (result.matches || []).forEach((match) => {
              if (match.candidates.length > 0) {
                nextSelection[match.requiredAbility] = match.candidates[0].accountId;
              }
            });
            setSelectedCandidates(nextSelection);
          } catch (retryErr: any) {
            setMatchError(retryErr.message || '팀 추천 생성에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setMatchError(err.message || '팀 추천 생성에 실패했습니다');
      }
    } finally {
      setIsGeneratingMatches(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !accessToken || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const serializedRequirements = selectedMatchRows.length > 0
      ? selectedMatchRows
        .map(({ requiredAbility, candidate }, idx) => {
          const role = requiredAbility.trim() || '역할 미정';
          const displayId = candidate.accountType === 'asset' 
            ? (candidate.abilityText || '이름 없는 자산')
            : candidate.accountId;
          const linkedAsset = candidate.linkedAssetId ? ` (조종사: ${candidate.linkedAssetId})` : '';
          return `${idx + 1}) ${toRequirementType(candidate.accountType)}/1개/${role} - ${displayId}${linkedAsset}`;
        })
        .join('\n')
      : null;

    const matchSummary = selectedMatchRows.length > 0
      ? `\n\n[AI 매칭 제안]\n${selectedMatchRows
        .map(({ requiredAbility, candidate }) => {
          const displayId = candidate.accountType === 'asset' 
            ? (candidate.abilityText || '이름 없는 자산')
            : candidate.accountId;
          return `- ${requiredAbility}: ${displayId} (${accountTypeLabel(candidate.accountType)}, score ${formatScore(candidate.score)})`;
        })
        .join('\n')}`
      : '';

    const payload = {
      name: title.trim(),
      category: serializeCategories(selectedCategories),
      budget: parseBudgetToNumber(budget),
      deadline: parseDeadlineToUnix(deadline),
      team_requirements: serializedRequirements,
      detailed_description: `${description.trim()}${matchSummary}`,
    };

    try {
      const created = await createProject(accessToken, payload);
      navigate(`/projects/${created.project.project_uuid}`);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            const created = await createProject(token, payload);
            navigate(`/projects/${created.project.project_uuid}`);
          } catch (retryErr: any) {
            setError(retryErr.message || '프로젝트 등록에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '프로젝트 등록에 실패했습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in max-w-lg">
      {/* Step dots */}
      <div className="flex gap-2 justify-center mb-7">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${s === step ? 'bg-text scale-130' : s < step ? 'bg-text' : 'bg-border'
              }`}
          />
        ))}
      </div>

      {/* Step 1: Goal */}
      {step === 1 && (
        <div className="animate-in" key="step1">
          <h1 className="text-xl font-bold mb-1">프로젝트 등록</h1>
          <p className="text-text-sub text-sm mb-6">프로젝트 목표를 입력하면 Taskrit이 팀 구성을 제안합니다.</p>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">프로젝트 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="프로젝트 제목을 입력하세요"
                className="glass-input px-3.5 py-3 rounded-md text-[15px] font-sans"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">카테고리</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategories.includes(cat)
                        ? 'bg-active text-active-text'
                        : 'bg-surface-2 text-text-sub border border-border hover:border-text-hint'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-sub">프로젝트 목표</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 커뮤니티 운영 자동화를 위한 AI 에이전트와 데이터 검수 팀을 구성하고 싶어요"
                rows={5}
                className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">예산</label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="예: 500,000원"
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">마감일</label>
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
                <p className="text-xs text-text-sub mt-1">실행 안정성을 위해 human 후보를 우선 반영합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={requireHuman}
                onChange={(e) => setRequireHuman(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!title.trim() || !description.trim()}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm cursor-pointer"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Team Matching */}
      {step === 2 && (
        <div className="animate-in" key="step2">
          <h1 className="text-xl font-bold mb-1">팀 매칭</h1>
          <p className="text-text-sub text-sm mb-6">요구 능력별로 가장 적합한 후보를 선택하세요.</p>

          <button
            onClick={handleGenerateMatches}
            disabled={isGeneratingMatches || !title.trim() || !description.trim()}
            className="btn-primary w-full py-2.5 rounded-lg text-sm cursor-pointer"
          >
            {isGeneratingMatches ? '추천 생성 중...' : matches.length > 0 ? '추천 다시 생성' : 'AI 팀 추천 생성'}
          </button>

          {matchError && (
            <div className="mt-3 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
              {matchError}
            </div>
          )}

          <div className="flex flex-col gap-4 mt-4">
            {matches.map((match) => {
              const nonAssetCandidates = match.candidates.filter((c) => c.accountType !== 'asset');
              const assetCandidates = match.candidates.filter((c) => c.accountType === 'asset');

              return (
                <div key={match.requiredAbility} className="flex flex-col gap-3">
                  {/* 인력(Human/Agent/Robot) 섹션 */}
                  {nonAssetCandidates.length > 0 && (
                    <div className="glass-card rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">{match.requiredAbility}</p>
                        <span className="text-xs text-text-sub">후보 {nonAssetCandidates.length}명</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {nonAssetCandidates.map((candidate) => {
                          const isSelected = selectedCandidates[match.requiredAbility] === candidate.accountId;
                          return (
                            <button
                              key={`${match.requiredAbility}-${candidate.accountId}`}
                              type="button"
                              onClick={() => setSelectedCandidates((prev) => ({
                                ...prev,
                                [match.requiredAbility]: candidate.accountId,
                              }))}
                              className={`text-left rounded-lg border px-3 py-3 transition-colors ${isSelected
                                  ? 'border-active bg-active/10'
                                  : 'border-border bg-surface-2 hover:border-text-hint'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{candidate.accountId}</p>
                                  <p className="text-xs text-text-sub mt-0.5">{accountTypeLabel(candidate.accountType)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-text-sub">유사도 {formatSimilarity(candidate.similarity)}</p>
                                  <p className="text-xs text-text-sub">점수 {formatScore(candidate.score)}</p>
                                </div>
                              </div>
                              <p className="text-xs text-text-sub mt-2 line-clamp-2">{candidate.abilityText || '능력 설명 없음'}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 장비/자산 섹션 */}
                  {assetCandidates.length > 0 && (
                    <div className="glass-card rounded-lg p-4 border-l-2 border-l-active/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">⚙️ 장비/자산</p>
                          <p className="text-xs text-text-hint">({match.requiredAbility})</p>
                        </div>
                        <span className="text-xs text-text-sub">후보 {assetCandidates.length}개</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {assetCandidates.map((candidate) => {
                          const isSelected = selectedCandidates[match.requiredAbility] === candidate.accountId;
                          const assetName = candidate.abilityText || '이름 없는 자산';
                          return (
                            <button
                              key={`${match.requiredAbility}-${candidate.accountId}`}
                              type="button"
                              onClick={() => setSelectedCandidates((prev) => ({
                                ...prev,
                                [match.requiredAbility]: candidate.accountId,
                              }))}
                              className={`text-left rounded-lg border px-3 py-3 transition-colors ${isSelected
                                  ? 'border-active bg-active/10'
                                  : 'border-border bg-surface-2 hover:border-text-hint'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{assetName}</p>
                                  <p className="text-xs text-text-sub mt-0.5">장비/자산</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-text-sub">유사도 {formatSimilarity(candidate.similarity)}</p>
                                  <p className="text-xs text-text-sub">점수 {formatScore(candidate.score)}</p>
                                </div>
                              </div>
                              {candidate.linkedAssetId && (
                                <p className="text-xs text-text-hint mt-2">조종사: {candidate.linkedAssetId}</p>
                              )}
                              {!candidate.linkedAssetId && (
                                <p className="text-xs text-text-hint mt-2">조종사 필요</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 후보 없음 */}
                  {match.candidates.length === 0 && (
                    <div className="glass-card rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">{match.requiredAbility}</p>
                      </div>
                      <p className="text-sm text-text-sub">매칭 후보가 없습니다. 제한 조건을 완화하고 다시 시도해보세요.</p>
                    </div>
                  )}
                </div>
              );
            })}

            {matches.length === 0 && !isGeneratingMatches && (
              <div className="glass-card rounded-lg p-5">
                <p className="text-sm text-text-sub">AI 팀 추천을 생성하면 능력별 후보 카드가 표시됩니다.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep(1)} className="btn-ghost px-4 py-2.5 rounded-lg text-sm">
              이전
            </button>
            <button onClick={() => setStep(3)} className="btn-primary flex-1 py-2.5 rounded-lg text-sm cursor-pointer">
              다음
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="animate-in" key="step3">
          <h1 className="text-xl font-bold mb-1">확인</h1>
          <p className="text-text-sub text-sm mb-6">목표와 매칭 구성을 확인한 뒤 프로젝트를 등록하세요.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
              {error}
            </div>
          )}

          <div className="glass-card rounded-lg p-5 mb-4">
            <div className="flex flex-col gap-3">
              <SummaryRow label="제목" value={title} />
              <SummaryRow label="카테고리" value={selectedCategories.join(', ')} />
              <SummaryRow label="예산" value={budget || '미정'} />
              <SummaryRow label="마감일" value={deadline || '미정'} />
              <SummaryRow label="매칭 역할" value={`${matches.length}개`} />
              <SummaryRow label="선택 후보" value={`${selectedMatchRows.length}명`} />
            </div>
          </div>

          {description && (
            <div className="glass-card rounded-lg p-5 mb-4">
              <p className="text-xs text-text-hint uppercase tracking-wider mb-2">프로젝트 목표</p>
              <p className="text-sm text-text-sub whitespace-pre-wrap">{description}</p>
            </div>
          )}

          {selectedMatchRows.length > 0 && (
            <div className="glass-card rounded-lg p-5 mb-4">
              <p className="text-xs text-text-hint uppercase tracking-wider mb-3">선택된 팀 구성</p>
              <div className="flex flex-col gap-2">
                {selectedMatchRows.map(({ requiredAbility, candidate }, idx) => {
                  const displayName = candidate.accountType === 'asset' 
                    ? (candidate.abilityText || '이름 없는 자산')
                    : candidate.accountId;
                  return (
                    <div key={`${requiredAbility}-${candidate.accountId}-${idx}`} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{requiredAbility}</p>
                        <p className="text-xs text-text-sub mt-0.5">
                          {displayName} · {accountTypeLabel(candidate.accountType)}
                        </p>
                      </div>
                      <span className="text-xs text-text-sub">score {formatScore(candidate.score)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep(2)} className="btn-ghost px-4 py-2.5 rounded-lg text-sm">
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="btn-primary flex-1 py-2.5 rounded-lg text-sm cursor-pointer"
            >
              {isSubmitting ? '등록 중...' : '프로젝트 등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-text-hint">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
};

export default ProjectCreatePage;

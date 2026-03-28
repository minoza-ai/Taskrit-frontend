import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../lib/store';
import { deleteProject, getProject, updateProject, type Project } from '../lib/api';
import PopupModal from '../components/PopupModal';

interface MatchedCandidate {
  ability: string;
  name: string;
  type: 'human' | 'ai' | 'robot' | 'asset';
  score: number;
  info?: string;
}

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'submissions'>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [teamRequirements, setTeamRequirements] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeIcons: Record<string, string> = {
    human: '👤',
    ai: '🤖',
    robot: '⚙️',
    asset: '🔗',
  };

  const typeLabel: Record<string, string> = {
    human: '인간 전문가',
    ai: 'AI 에이전트',
    robot: '로봇',
    asset: '자산',
  };

  const parseMatchingResults = (description: string): MatchedCandidate[] => {
    const matchingSection = description.split('[AI 매칭 제안]')[1];
    if (!matchingSection) return [];

    const candidates: MatchedCandidate[] = [];
    const lines = matchingSection.trim().split('\n');

    for (const line of lines) {
      const match = line.match(/^-\s+([^:]+):\s+([^(]+)\s+\(([^,]+),\s+score\s+([\d.]+)\)/);
      if (match) {
        const [, ability, name, typeStr, scoreStr] = match;
        const typeMap: Record<string, 'human' | 'ai' | 'robot' | 'asset'> = {
          'human': 'human',
          'agent': 'ai',
          'robot': 'robot',
          'asset': 'asset',
        };

        candidates.push({
          ability: ability.trim(),
          name: name.trim(),
          type: typeMap[typeStr.trim()] || 'human',
          score: parseFloat(scoreStr),
        });
      }
    }

    return candidates;
  };

  const matchedCandidates = useMemo(() => {
    return detailedDescription ? parseMatchingResults(detailedDescription) : [];
  }, [detailedDescription]);

  const formatBudget = (value: number | null): string => {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('ko-KR');
  };

  const parseBudgetToNumber = (value: string): number | null => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return null;
    return Number(digits);
  };

  const formatUnixToDateInput = (unix: number | null): string => {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDeadlineToUnix = (value: string): number | null => {
    if (!value) return null;
    const unix = Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000);
    return Number.isNaN(unix) ? null : unix;
  };

  useEffect(() => {
    let ignore = false;

    const load = async (token: string) => {
      if (!id) throw new Error('잘못된 프로젝트 ID입니다');
      const result = await getProject(token, id);
      if (!ignore) {
        setProject(result);
        setName(result.name);
        setCategory(result.category || '');
        setBudget(formatBudget(result.budget));
        setDeadline(formatUnixToDateInput(result.deadline));
        setTeamRequirements(result.team_requirements || '');
        setDetailedDescription(result.detailed_description || '');
        setError(null);
      }
    };

    const run = async () => {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await load(accessToken);
      } catch (err: any) {
        if (err.status === 401) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            try {
              await load(useAuthStore.getState().accessToken!);
            } catch (retryErr: any) {
              setError(retryErr.message || '프로젝트를 불러오지 못했습니다');
            }
          } else {
            logout();
          }
        } else {
          setError(err.message || '프로젝트를 불러오지 못했습니다');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [accessToken, id, logout, tryRefresh]);

  const handleSave = async () => {
    if (!accessToken || !id || !name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await updateProject(accessToken, id, {
        name: name.trim(),
        category: category.trim() || null,
        budget: parseBudgetToNumber(budget),
        deadline: parseDeadlineToUnix(deadline),
        team_requirements: teamRequirements.trim() || null,
        detailed_description: detailedDescription.trim() || null,
      });
      setProject(response.project);
      setCategory(response.project.category || '');
      setBudget(formatBudget(response.project.budget));
      setDeadline(formatUnixToDateInput(response.project.deadline));
      setTeamRequirements(response.project.team_requirements || '');
      setDetailedDescription(response.project.detailed_description || '');
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            const response = await updateProject(token, id, {
              name: name.trim(),
              category: category.trim() || null,
              budget: parseBudgetToNumber(budget),
              deadline: parseDeadlineToUnix(deadline),
              team_requirements: teamRequirements.trim() || null,
              detailed_description: detailedDescription.trim() || null,
            });
            setProject(response.project);
            setCategory(response.project.category || '');
            setBudget(formatBudget(response.project.budget));
            setDeadline(formatUnixToDateInput(response.project.deadline));
            setTeamRequirements(response.project.team_requirements || '');
            setDetailedDescription(response.project.detailed_description || '');
          } catch (retryErr: any) {
            setError(retryErr.message || '프로젝트 수정에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '프로젝트 수정에 실패했습니다');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !id || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      await deleteProject(accessToken, id);
      navigate('/projects');
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await deleteProject(token, id);
            navigate('/projects');
          } catch (retryErr: any) {
            setError(retryErr.message || '프로젝트 삭제에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '프로젝트 삭제에 실패했습니다');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const formatUnixTime = (unix: number): string => {
    return new Date(unix * 1000).toLocaleString('ko-KR');
  };

  return (
    <div className="animate-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/projects')} className="text-text-hint hover:text-text transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">프로젝트 상세</h1>
          <p className="text-xs text-text-hint">ID: {id}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="glass-card rounded-lg p-5 text-center py-12 mb-6">
          <p className="text-text-sub">프로젝트를 불러오는 중입니다</p>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-0.5 mb-6">
        {(['overview', 'team', 'submissions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-hint hover:text-text-sub'
              }`}
          >
            {tab === 'overview' ? '개요' : tab === 'team' ? 'AI 추천 팀' : '결과물'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          {!project ? (
            <div className="glass-card rounded-lg p-5 text-center py-12">
              <p className="text-text-sub">프로젝트 데이터가 없습니다</p>
              <p className="text-xs text-text-hint mt-1">프로젝트가 삭제되었거나 접근 권한이 없습니다</p>
            </div>
          ) : (
            <>
              <div className="glass-card rounded-lg p-5">
                <h2 className="text-base font-semibold mb-4">기본 정보</h2>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-sub">프로젝트 제목</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="glass-input px-3.5 py-3 rounded-md text-[15px] font-sans"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">카테고리</label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                        placeholder="예: 소프트웨어 개발"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">예산</label>
                      <input
                        type="text"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                        placeholder="예: 500000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">마감일</label>
                      <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">팀 요구사항</label>
                      <textarea
                        value={teamRequirements}
                        onChange={(e) => setTeamRequirements(e.target.value)}
                        rows={3}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[90px]"
                        placeholder={'1) human/1명/프론트엔드 개발\n2) ai/1명/테스트 자동화'}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-sub">상세 설명</label>
                    <textarea
                      value={detailedDescription}
                      onChange={(e) => setDetailedDescription(e.target.value)}
                      rows={6}
                      className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[120px]"
                    />
                  </div>
                  <div className="text-xs text-text-hint flex flex-col gap-1">
                    <span>생성일: {formatUnixTime(project.created_at)}</span>
                    <span>수정일: {formatUnixTime(project.updated_at)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !name.trim()}
                      className="btn-primary flex-1 py-2.5 rounded-lg text-sm cursor-pointer"
                    >
                      {isSaving ? '저장 중...' : '수정 저장'}
                    </button>
                    <button
                      onClick={requestDelete}
                      disabled={isDeleting}
                      className="btn-secondary py-2.5 px-4 rounded-lg text-sm text-error"
                    >
                      {isDeleting ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="flex flex-col gap-6">
          {/* Hero Section */}
          <div className="glass-card rounded-lg p-6 border border-active/20 bg-gradient-to-br from-active/10 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-sub mb-2">이런 프로젝트를 계획 중이신가요?</p>
                <p className="text-sm italic text-text-hint">
                  "{name && name.length > 30 ? `${name.substring(0, 30)}...` : name}"
                </p>
              </div>
              <button
                onClick={() => navigate(`/projects/new`)}
                className="btn-primary px-5 py-2.5 rounded-lg text-sm whitespace-nowrap"
              >
                팀 구성하기
              </button>
            </div>
          </div>

          {/* Matching Results */}
          {matchedCandidates.length > 0 ? (
            <>
              <div>
                <h2 className="text-base font-bold mb-1">
                  AI 분석 결과: <span className="text-active">{name}</span>
                </h2>
                <p className="text-sm text-text-sub">
                  필요 역할 <span className="font-semibold text-text">{matchedCandidates.length}개</span> 도출
                </p>
              </div>

              {/* Candidate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {matchedCandidates.map((candidate, idx) => (
                  <div
                    key={`${candidate.ability}-${idx}`}
                    className="glass-card rounded-lg p-5 flex flex-col items-center text-center hover:shadow-md transition-shadow"
                  >
                    {/* Type Badge */}
                    <div className="text-[10px] font-semibold text-text-hint uppercase tracking-wider mb-2">
                      {typeLabel[candidate.type]}
                    </div>

                    {/* Role Title */}
                    <h3 className="text-sm font-bold mb-4 text-text line-clamp-2 min-h-10">
                      {candidate.ability}
                    </h3>

                    {/* Icon */}
                    <div className="text-4xl mb-4">{typeIcons[candidate.type]}</div>

                    {/* Name */}
                    <p className="text-sm font-semibold text-text mb-1">{candidate.name}</p>

                    {/* Info */}
                    <div className="text-xs text-text-sub mb-4 min-h-10">
                      {candidate.type === 'asset' ? (
                        <p>자동 배정</p>
                      ) : candidate.type === 'ai' ? (
                        <p>자동 배정</p>
                      ) : (
                        <p>검증 완료</p>
                      )}
                    </div>

                    {/* Score/Match Bar */}
                    <div className="w-full">
                      <div className="mb-2">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[9px] text-text-hint">매칭</span>
                          <span className="text-xs font-bold text-active">
                            {Math.round(candidate.score * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-active to-success transition-all"
                            style={{ width: `${Math.min(candidate.score * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Footer */}
              <div className="glass-card rounded-lg p-5 bg-surface-2 flex items-center justify-between gap-6">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-text-hint">총 필요 자원</p>
                    <p className="text-sm font-bold text-text">{matchedCandidates.length}개 충족</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-hint">예상 기간</p>
                    <p className="text-sm font-bold text-text">{Math.ceil(matchedCandidates.length * 1.5)}주</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-hint">예상 비용</p>
                    <p className="text-sm font-bold text-text">
                      {(matchedCandidates.length * 1375000).toLocaleString('ko-KR')}원
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs px-3 py-2 rounded-lg bg-surface text-text-sub hover:bg-surface-2 transition-colors">
                    역할 수정
                  </button>
                  <button className="btn-primary px-4 py-2 rounded-lg text-xs whitespace-nowrap cursor-pointer">
                    이 팀으로 프로젝트 시작하기
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-lg p-12 text-center">
              <p className="text-sm text-text-sub mb-2">아직 AI 분석 결과가 없습니다</p>
              <p className="text-xs text-text-hint mb-4">프로젝트를 생성하거나 수정할 때 팀 추천을 받을 수 있습니다</p>
              <button
                onClick={() => navigate(`/projects/new`)}
                className="btn-primary px-5 py-2.5 rounded-lg text-sm"
              >
                프로젝트 생성하기
              </button>
            </div>
          )}

          <button
            onClick={() => navigate('/messages')}
            className="glass-card glass-card-hover rounded-lg p-4 text-left transition-all cursor-pointer"
          >
            <span className="text-sm font-medium">💬 팀원과 협상하기</span>
            <p className="text-xs text-text-sub mt-1">메시지로 역할과 조건을 조율하세요</p>
          </button>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="flex flex-col gap-4">
          <div className="glass-card rounded-lg p-5">
            <h2 className="text-base font-semibold mb-3">결과물 제출</h2>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-text-sub mb-2">팀 매칭 확정 후 결과물을 제출할 수 있습니다</p>
              <p className="text-xs text-text-hint">프롬프트, 코드, 데이터 파일 등</p>
            </div>
          </div>

          <div className="glass-card rounded-lg p-5">
            <h2 className="text-base font-semibold mb-3">블록체인 공탁 상태</h2>
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-text-hint" />
              <span className="text-sm text-text-sub">대기 중</span>
            </div>
          </div>

          <button
            onClick={() => navigate(`/workspace/${id}`)}
            className="btn-secondary w-full py-3 rounded-lg text-sm"
          >
            협업 공간으로 이동 →
          </button>
        </div>
      )}

      <PopupModal
        open={isDeleteConfirmOpen}
        title="프로젝트 삭제"
        message="정말 이 프로젝트를 삭제하시겠습니까?"
        confirmText={isDeleting ? '삭제 중...' : '삭제'}
        cancelText="취소"
        variant="confirm"
        destructive
        busy={isDeleting}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await handleDelete();
          setIsDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
};

export default ProjectDetailPage;

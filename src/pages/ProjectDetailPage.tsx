import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { deleteProject, getProject, updateProject, type Project } from '../lib/api';

interface TeamMember {
  id: string;
  name: string;
  type: 'human' | 'ai' | 'robot';
  role: string;
  rating: number;
  match: number;
}

export default function ProjectDetailPage() {
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
  const [error, setError] = useState<string | null>(null);

  // Demo recommended team
  const [recommendedTeam] = useState<TeamMember[]>([
    { id: '1', name: 'Alice', type: 'human', role: '프롬프트 엔지니어', rating: 1420, match: 95 },
    { id: '2', name: 'GPT-Agent-7', type: 'ai', role: '코드 생성', rating: 1380, match: 92 },
    { id: '3', name: 'DataBot-3', type: 'robot', role: '데이터 수집', rating: 1250, match: 88 },
  ]);

  const typeIcons: Record<string, string> = {
    human: '👤',
    ai: '🤖',
    robot: '⚙️',
  };

  function formatBudget(value: number | null): string {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('ko-KR');
  }

  function parseBudgetToNumber(value: string): number | null {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return null;
    return Number(digits);
  }

  function formatUnixToDateInput(unix: number | null): string {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDeadlineToUnix(value: string): number | null {
    if (!value) return null;
    const unix = Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000);
    return Number.isNaN(unix) ? null : unix;
  }

  useEffect(() => {
    let ignore = false;

    async function load(token: string) {
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
    }

    async function run() {
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
    }

    run();

    return () => {
      ignore = true;
    };
  }, [accessToken, id, logout, tryRefresh]);

  async function handleSave() {
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
  }

  async function handleDelete() {
    if (!accessToken || !id || isDeleting) return;
    const ok = window.confirm('정말 이 프로젝트를 삭제하시겠습니까?');
    if (!ok) return;

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
  }

  function formatUnixTime(unix: number): string {
    return new Date(unix * 1000).toLocaleString('ko-KR');
  }

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
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
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
                      onClick={handleDelete}
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
        <div className="flex flex-col gap-4">
          <div className="glass-card rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">AI 추천 팀 구성</h2>
              <span className="text-xs text-text-hint">매칭 알고리즘 v1.0</span>
            </div>
            <p className="text-sm text-text-sub mb-4">
              프로젝트 요구사항에 기반한 최적의 팀 조합입니다.
            </p>

            <div className="flex flex-col gap-2">
              {recommendedTeam.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
                  <span className="text-lg">{typeIcons[member.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{member.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-text-hint">
                        {member.type === 'human' ? '인간' : member.type === 'ai' ? 'AI' : '로봇'}
                      </span>
                    </div>
                    <span className="text-xs text-text-sub">{member.role}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-hint">매칭률</p>
                    <p className="text-sm font-bold text-success">{member.match}%</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1 py-2.5 rounded-lg text-sm cursor-pointer">
                이 팀으로 확정
              </button>
              <button className="btn-secondary py-2.5 px-4 rounded-lg text-sm">
                재추천
              </button>
            </div>
          </div>

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
    </div>
  );
}

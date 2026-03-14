import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { listProjects } from '../lib/api';

interface ProjectListItem {
  id: string;
  title: string;
  category: string | null;
  budget: number | null;
  deadline: number | null;
  createdAt: string;
  updatedAt: string;
}

function formatUnixTime(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('ko-KR');
}

function formatBudget(value: number | null): string {
  if (value === null || value === undefined) return '미정';
  return `${value.toLocaleString('ko-KR')}원`;
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectCountText = useMemo(() => `${projects.length}개`, [projects.length]);

  useEffect(() => {
    let ignore = false;

    async function loadProjects(token: string) {
      const response = await listProjects(token);
      const mapped = response.projects.map((project) => ({
        id: project.project_uuid,
        title: project.name,
        category: project.category,
        budget: project.budget,
        deadline: project.deadline,
        createdAt: formatUnixTime(project.created_at),
        updatedAt: formatUnixTime(project.updated_at),
      }));
      if (!ignore) {
        setProjects(mapped);
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
        await loadProjects(accessToken);
      } catch (err: any) {
        if (err.status === 401) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            try {
              await loadProjects(useAuthStore.getState().accessToken!);
            } catch (retryErr: any) {
              setError(retryErr.message || '프로젝트 목록을 불러오지 못했습니다');
            }
          } else {
            logout();
          }
        } else {
          setError(err.message || '프로젝트 목록을 불러오지 못했습니다');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    run();

    return () => {
      ignore = true;
    };
  }, [accessToken, logout, tryRefresh]);

  async function handleRefresh() {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await listProjects(accessToken);
      setProjects(
        response.projects.map((project) => ({
          id: project.project_uuid,
          title: project.name,
          category: project.category,
          budget: project.budget,
          deadline: project.deadline,
          createdAt: formatUnixTime(project.created_at),
          updatedAt: formatUnixTime(project.updated_at),
        })),
      );
    } catch (err: any) {
      setError(err.message || '프로젝트 목록을 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">프로젝트</h1>
          <p className="text-text-sub text-sm mt-1">등록된 프로젝트를 관리하세요. ({projectCountText})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary px-4 py-2.5 rounded-lg text-sm"
          >
            새로고침
          </button>
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-primary px-5 py-2.5 rounded-lg text-sm cursor-pointer"
          >
            + 새 프로젝트
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <p className="text-text-sub mb-1">프로젝트 목록을 불러오는 중입니다</p>
          <p className="text-text-hint text-xs">잠시만 기다려주세요</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <p className="text-text-sub mb-1">등록된 프로젝트가 없습니다</p>
          <p className="text-text-hint text-xs">새 프로젝트를 등록해보세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="glass-card glass-card-hover rounded-lg p-5 text-left transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2 gap-3">
                <h3 className="font-semibold text-[15px]">{project.title}</h3>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-success/10 text-success">
                  활성
                </span>
              </div>
              <div className="flex gap-4 text-xs text-text-hint flex-wrap">
                <span>카테고리: {project.category || '미지정'}</span>
                <span>예산: {formatBudget(project.budget)}</span>
                <span>마감일: {project.deadline ? formatUnixTime(project.deadline) : '미정'}</span>
                <span>생성일: {project.createdAt}</span>
                <span>수정일: {project.updatedAt}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

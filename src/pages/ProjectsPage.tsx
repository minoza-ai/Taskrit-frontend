import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  status: 'open' | 'matching' | 'in-progress' | 'completed';
  budget: string;
  createdAt: string;
  teamSize: number;
}

const statusLabels: Record<Project['status'], string> = {
  open: '모집 중',
  matching: '매칭 중',
  'in-progress': '진행 중',
  completed: '완료',
};

const statusColors: Record<Project['status'], string> = {
  open: 'bg-success/10 text-success',
  matching: 'bg-amber-500/10 text-amber-400',
  'in-progress': 'bg-blue-500/10 text-blue-400',
  completed: 'bg-text-hint/10 text-text-hint',
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | Project['status']>('all');

  // Demo data — would be fetched from API
  const [projects] = useState<Project[]>([]);

  const filtered = filter === 'all'
    ? projects
    : projects.filter((p) => p.status === filter);

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">프로젝트</h1>
          <p className="text-text-sub text-sm mt-1">등록된 프로젝트를 관리하세요.</p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="btn-primary px-5 py-2.5 rounded-lg text-sm cursor-pointer"
        >
          + 새 프로젝트
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(['all', 'open', 'matching', 'in-progress', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-active text-active-text'
                : 'bg-surface-2 text-text-sub hover:text-text border border-border'
            }`}
          >
            {f === 'all' ? '전체' : statusLabels[f]}
          </button>
        ))}
      </div>

      {/* Project List */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <p className="text-text-sub mb-1">등록된 프로젝트가 없습니다</p>
          <p className="text-text-hint text-xs">새 프로젝트를 등록해보세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="glass-card glass-card-hover rounded-lg p-5 text-left transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-[15px]">{project.title}</h3>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusColors[project.status]}`}>
                  {statusLabels[project.status]}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-text-hint">
                <span>예산: {project.budget}</span>
                <span>팀: {project.teamSize}명</span>
                <span>{project.createdAt}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

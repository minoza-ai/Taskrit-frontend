import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { getUserDashboard } from '../lib/api';
import type { Project } from '../lib/api';

const DashboardPage = () => {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  
  const [ongoingCount, setOngoingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        const data = await getUserDashboard(accessToken);
        setOngoingCount(data.ongoingCount);
        setCompletedCount(data.completedCount);
        setRecentActivities(data.recentActivities);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [accessToken]);

  const formatTimestamp = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const quickActions = [
    {
      title: '프로젝트 등록',
      desc: '새로운 태스크를 등록하고 AI 매칭을 시작하세요',
      action: () => navigate('/projects/new'),
      icon: '→',
    },
    {
      title: '프로젝트 목록',
      desc: '진행 중인 프로젝트를 확인하세요',
      action: () => navigate('/projects'),
      icon: '◇',
    },
    {
      title: '노하우 마켓',
      desc: '프롬프트와 워크플로우를 거래하세요',
      action: () => navigate('/marketplace'),
      icon: '◆',
    },
    {
      title: '프로필 설정',
      desc: '능력치와 보유 데이터를 등록하세요',
      action: () => navigate('/profile'),
      icon: '○',
    },
  ];

  const stats = [
    { label: '진행 중', value: String(ongoingCount), unit: '프로젝트' },
    { label: 'ELO 레이팅', value: '1000', unit: '점' },
    { label: '완료 작업', value: String(completedCount), unit: '건' },
    { label: '평판 점수', value: '-', unit: '' },
  ];

  return (
    <div className="animate-in">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          안녕하세요{user ? `, ${user.nickname}님` : ''}!
        </h1>
        <p className="text-text-sub text-sm">Taskrit 대시보드에 오신 것을 환영합니다.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-lg p-4"
          >
            <p className="text-[11px] text-text-hint uppercase tracking-wider font-medium mb-2">
              {stat.label}
            </p>
            <p className="text-xl font-bold text-text">
              {stat.value}
              {stat.unit && (
                <span className="text-xs font-normal text-text-sub ml-1">{stat.unit}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold mb-4">빠른 시작</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.title}
            onClick={action.action}
            className="glass-card glass-card-hover rounded-lg p-5 text-left transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-base font-semibold text-text group-hover:text-active transition-colors">
                {action.title}
              </span>
              <span className="text-text-hint text-lg opacity-40 group-hover:opacity-80 transition-opacity">
                {action.icon}
              </span>
            </div>
            <p className="text-sm text-text-sub leading-relaxed">
              {action.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">최근 활동</h2>
        {isLoading ? (
          <div className="glass-card rounded-lg p-8 text-center">
            <p className="text-text-sub text-sm">로딩 중...</p>
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="glass-card rounded-lg p-8 text-center">
            <p className="text-text-sub text-sm">아직 활동 내역이 없습니다</p>
            <p className="text-text-hint text-xs mt-1">프로젝트를 등록하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((project) => (
              <button
                key={project.project_uuid}
                onClick={() => navigate(`/projects/${project.project_uuid}`)}
                className="glass-card rounded-lg p-4 text-left transition-all duration-200 hover:bg-bg-hover group w-full"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text group-hover:text-active transition-colors truncate">
                      {project.name}
                    </p>
                    {project.category && (
                      <p className="text-xs text-text-hint mt-1">
                        {project.category}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-text-hint ml-2 whitespace-nowrap">
                    {formatTimestamp(project.updated_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

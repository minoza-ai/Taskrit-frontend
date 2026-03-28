import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getPublicFeed, getPublicMetrics, type Project } from '../lib/api';

interface Metrics {
  activeProjects: number;
  thisWeekMatches: number;
  activeMembers: number;
  totalCompleted: number;
}

const LandingPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    activeProjects: 0,
    thisWeekMatches: 0,
    activeMembers: 0,
    totalCompleted: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsResult, metricsResult] = await Promise.all([
          getPublicFeed(3),
          getPublicMetrics(),
        ]);
        setProjects(projectsResult.projects);
        setMetrics(metricsResult);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);
  return (
    <div className="min-h-screen relative overflow-hidden bg-bg text-text">
      <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-white/6 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[38rem] h-44 bg-white/8 blur-3xl" />

      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="font-display font-black text-2xl tracking-tight">Taskrit</div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost px-4 py-2 rounded-md text-sm">
            로그인
          </Link>
          <Link to="/register" className="btn-primary px-4 py-2 rounded-md text-sm">
            시작하기
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-12 pt-8 md:pt-16">
        <section className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="animate-in">
            <p className="text-xs uppercase tracking-[0.24em] text-text-hint mb-4">AI Task Marketplace</p>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.08] tracking-tight mb-5">
              원하는 프로젝트를
              <br />
              팀과 AI로 완성하세요
            </h1>
            <p className="text-text-sub text-sm md:text-base leading-relaxed max-w-xl mb-8">
              Taskrit은 프로젝트 등록부터 팀 구성, 협업, 결과 관리까지 한 번에 연결하는 태스크 매칭 플랫폼입니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary px-6 py-3 rounded-lg text-sm">
                로그인 후 시작
              </Link>
              <Link to="/register" className="btn-secondary px-6 py-3 rounded-lg text-sm">
                회원가입
              </Link>
            </div>
          </div>

          <div className="animate-in [animation-delay:120ms]">
            <div className="glass-card rounded-2xl p-5 md:p-6 border border-glass-border/70">
              <p className="text-xs text-text-hint uppercase tracking-[0.18em] mb-4">Today Snapshot</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <MetricCard title="진행 중 프로젝트" value={metrics.activeProjects.toString()} />
                <MetricCard title="이번 주 매칭" value={metrics.thisWeekMatches.toString()} />
                <MetricCard title="활성 멤버" value={metrics.activeMembers.toLocaleString('ko-KR')} />
                <MetricCard title="누적 완료" value={metrics.totalCompleted.toString()} />
              </div>
              <div className="rounded-xl bg-surface-2 border border-border p-4">
                <p className="text-sm font-semibold mb-2">실시간 프로젝트 피드</p>
                {isLoading ? (
                  <ul className="flex flex-col gap-2 text-xs text-text-sub">
                    <li className="py-2">로딩 중...</li>
                  </ul>
                ) : projects.length > 0 ? (
                  <ul className="flex flex-col gap-2 text-xs text-text-sub">
                    {projects.map((project) => (
                      <li key={project.project_uuid} className="flex items-center justify-between">
                        <span className="line-clamp-1">{project.name}</span>
                        <span className="text-text-hint text-[11px]">
                          {project.category || '미분류'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="flex flex-col gap-2 text-xs text-text-sub">
                    <li className="py-2">등록된 프로젝트가 없습니다</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 md:mt-16 grid md:grid-cols-3 gap-3">
          <FeatureCard
            title="프로젝트 등록"
            text="목표, 예산, 마감일, 팀 요구사항을 구조화해 등록하세요."
          />
          <FeatureCard
            title="팀/역할 관리"
            text="작업 단위별 역할을 나누고 상태를 한 화면에서 관리하세요."
          />
          <FeatureCard
            title="협업과 결과 관리"
            text="메시지, 파일, 결과 제출 흐름을 연결해 빠르게 완료하세요."
          />
        </section>
      </main>
    </div>
  );
};

const MetricCard = ({ title, value }: { title: string; value: string }) => {
  return (
    <div className="rounded-xl bg-surface-2 border border-border p-3">
      <p className="text-[11px] text-text-hint mb-1">{title}</p>
      <p className="text-xl font-black tracking-tight">{value}</p>
    </div>
  );
};

const FeatureCard = ({ title, text }: { title: string; text: string }) => {
  return (
    <div className="glass-card rounded-xl p-5 border border-glass-border/70">
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      <p className="text-xs text-text-sub leading-relaxed">{text}</p>
    </div>
  );
};

export default LandingPage;

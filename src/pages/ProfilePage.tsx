import { useState } from 'react';
import { useAuthStore } from '../lib/store';

interface Competency {
  category: string;
  skills: { name: string; level: number }[];
}

const ProfilePage = () => {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'competency' | 'reputation'>('competency');

  const [competencies] = useState<Competency[]>([
    {
      category: 'AI / 머신러닝',
      skills: [
        { name: '프롬프트 엔지니어링', level: 0 },
        { name: '모델 파인튜닝', level: 0 },
        { name: '데이터 전처리', level: 0 },
      ],
    },
    {
      category: '개발',
      skills: [
        { name: '프론트엔드', level: 0 },
        { name: '백엔드', level: 0 },
        { name: '스마트 컨트랙트', level: 0 },
      ],
    },
    {
      category: '데이터',
      skills: [
        { name: '라벨링', level: 0 },
        { name: '데이터 수집', level: 0 },
        { name: '분석/시각화', level: 0 },
      ],
    },
  ]);

  const reputationStats = [
    { label: 'ELO 레이팅', value: '1000' },
    { label: '완료 작업', value: '0건' },
    { label: '성공률', value: '-' },
    { label: '평균 평가', value: '-' },
    { label: '활동 기간', value: user ? `${Math.floor((Date.now() / 1000 - user.created_at) / 86400)}일` : '-' },
    { label: '매칭 선호도', value: '-' },
  ];

  return (
    <div className="animate-in max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">프로필 및 역량</h1>
      <p className="text-text-sub text-sm mb-6">능력치와 성과 지표를 관리하세요.</p>

      {/* Tab */}
      <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-0.5 mb-6">
        <button
          onClick={() => setActiveTab('competency')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'competency'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-hint hover:text-text-sub'
            }`}
        >
          능력치
        </button>
        <button
          onClick={() => setActiveTab('reputation')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'reputation'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-hint hover:text-text-sub'
            }`}
        >
          성과 / 평판
        </button>
      </div>

      {activeTab === 'competency' && (
        <div className="flex flex-col gap-4">
          {competencies.map((cat) => (
            <div key={cat.category} className="glass-card rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">{cat.category}</h3>
              <div className="flex flex-col gap-3">
                {cat.skills.map((skill) => (
                  <div key={skill.name} className="flex items-center gap-3">
                    <span className="text-sm text-text-sub w-36 shrink-0">{skill.name}</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-text-sub rounded-full transition-all"
                        style={{ width: `${skill.level}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-hint w-8 text-right">{skill.level}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">활동 가능 시간</h3>
            <p className="text-sm text-text-sub">아직 설정되지 않았습니다.</p>
            <button className="btn-secondary px-4 py-2 rounded-lg text-sm mt-3">
              설정하기
            </button>
          </div>

          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">보유 데이터</h3>
            <p className="text-sm text-text-sub">등록된 데이터셋이 없습니다.</p>
            <button className="btn-secondary px-4 py-2 rounded-lg text-sm mt-3">
              데이터 등록
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reputation' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {reputationStats.map((stat) => (
              <div key={stat.label} className="glass-card rounded-lg p-4">
                <p className="text-[11px] text-text-hint uppercase tracking-wider font-medium mb-1.5">
                  {stat.label}
                </p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">작업 이력</h3>
            <div className="text-center py-6">
              <p className="text-sm text-text-sub">아직 완료된 작업이 없습니다</p>
              <p className="text-xs text-text-hint mt-1">프로젝트를 수행하면 여기에 기록됩니다</p>
            </div>
          </div>

          <div className="glass-card rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">ELO 레이팅 변동</h3>
            <div className="h-32 flex items-center justify-center border border-border-light rounded-md">
              <p className="text-xs text-text-hint">데이터가 쌓이면 그래프가 표시됩니다</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

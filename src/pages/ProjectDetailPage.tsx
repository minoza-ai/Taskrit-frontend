import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'submissions'>('overview');

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
          <div className="glass-card rounded-lg p-5 text-center py-12">
            <p className="text-text-sub">프로젝트 데이터가 없습니다</p>
            <p className="text-xs text-text-hint mt-1">백엔드 API 연동 후 표시됩니다</p>
          </div>
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

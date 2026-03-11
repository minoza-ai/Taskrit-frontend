import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type MemberType = 'human' | 'ai' | 'robot';

interface TeamRequirement {
  type: MemberType;
  count: number;
  role: string;
}

export default function ProjectCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('');
  const [requirements, setRequirements] = useState<TeamRequirement[]>([
    { type: 'human', count: 1, role: '' },
  ]);

  const categories = [
    'AI 학습 데이터',
    '프롬프트 개발',
    '소프트웨어 개발',
    '데이터 분석',
    '콘텐츠 제작',
    '검수/검증',
    '기타',
  ];

  function addRequirement() {
    setRequirements([...requirements, { type: 'human', count: 1, role: '' }]);
  }

  function removeRequirement(idx: number) {
    setRequirements(requirements.filter((_, i) => i !== idx));
  }

  function updateRequirement(idx: number, field: keyof TeamRequirement, value: any) {
    setRequirements(requirements.map((r, i) =>
      i === idx ? { ...r, [field]: value } : r,
    ));
  }

  function handleSubmit() {
    // Would POST to API
    alert('프로젝트가 등록되었습니다! (백엔드 API 연동 예정)');
    navigate('/projects');
  }

  return (
    <div className="animate-in max-w-lg">
      {/* Step dots */}
      <div className="flex gap-2 justify-center mb-7">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              s === step ? 'bg-text scale-130' : s < step ? 'bg-text' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="animate-in" key="step1">
          <h1 className="text-xl font-bold mb-1">프로젝트 등록</h1>
          <p className="text-text-sub text-sm mb-6">프로젝트의 기본 정보를 입력하세요.</p>

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
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      category === cat
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
              <label className="text-xs font-semibold text-text-sub">상세 설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트의 목표, 요구사항 등을 상세히 설명하세요"
                rows={4}
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
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!title || !category}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm cursor-pointer"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Team Requirements */}
      {step === 2 && (
        <div className="animate-in" key="step2">
          <h1 className="text-xl font-bold mb-1">팀 구성 설정</h1>
          <p className="text-text-sub text-sm mb-6">필요한 팀원의 유형과 역할을 지정하세요.</p>

          <div className="flex flex-col gap-3">
            {requirements.map((req, idx) => (
              <div key={idx} className="glass-card rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-text-hint font-medium">팀원 #{idx + 1}</span>
                  {requirements.length > 1 && (
                    <button
                      onClick={() => removeRequirement(idx)}
                      className="text-xs text-error hover:bg-error-bg px-2 py-1 rounded transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="flex gap-2 mb-3">
                  {(['human', 'ai', 'robot'] as MemberType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => updateRequirement(idx, 'type', type)}
                      className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                        req.type === type
                          ? 'bg-active text-active-text'
                          : 'bg-surface-2 text-text-sub border border-border'
                      }`}
                    >
                      {type === 'human' ? '👤 인간' : type === 'ai' ? '🤖 AI' : '⚙️ 로봇'}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={req.role}
                  onChange={(e) => updateRequirement(idx, 'role', e.target.value)}
                  placeholder="역할 (예: 데이터 라벨링, 코드 리뷰)"
                  className="glass-input w-full px-3 py-2 rounded-md text-sm font-sans"
                />
              </div>
            ))}
          </div>

          <button
            onClick={addRequirement}
            className="btn-secondary w-full py-2.5 rounded-lg text-sm mt-3"
          >
            + 팀원 추가
          </button>

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
          <p className="text-text-sub text-sm mb-6">등록 내용을 확인하세요.</p>

          <div className="glass-card rounded-lg p-5 mb-4">
            <div className="flex flex-col gap-3">
              <SummaryRow label="제목" value={title} />
              <SummaryRow label="카테고리" value={category} />
              <SummaryRow label="예산" value={budget || '미정'} />
              <SummaryRow label="마감일" value={deadline || '미정'} />
              <SummaryRow label="팀 구성" value={`${requirements.length}명`} />
            </div>
          </div>

          {description && (
            <div className="glass-card rounded-lg p-5 mb-4">
              <p className="text-xs text-text-hint uppercase tracking-wider mb-2">상세 설명</p>
              <p className="text-sm text-text-sub whitespace-pre-wrap">{description}</p>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep(2)} className="btn-ghost px-4 py-2.5 rounded-lg text-sm">
              이전
            </button>
            <button onClick={handleSubmit} className="btn-primary flex-1 py-2.5 rounded-lg text-sm cursor-pointer">
              프로젝트 등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-text-hint">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

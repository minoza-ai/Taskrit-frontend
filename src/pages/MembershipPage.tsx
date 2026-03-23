import { useState } from 'react';

const MembershipPage = () => {
  const [currentPlan] = useState<'free' | 'pro'>('free');

  const plans = [
    {
      id: 'free' as const,
      name: '무료',
      price: '₩0',
      period: '',
      features: [
        '월 3건 프로젝트 등록',
        '기본 매칭 알고리즘',
        '요약 리포트 제공',
        '노하우 상품 3건 등록',
        '기본 협업 공간',
      ],
      limitations: [
        '매칭 대기 시간 최대 7일',
        '풀 검증 리포트 미제공',
        '우선 매칭 불가',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      price: '₩29,900',
      period: '/월',
      features: [
        '월 프로젝트 무제한 등록',
        'AI 우선 매칭 배정',
        '풀 검증 리포트 제공',
        '노하우 상품 무제한 등록',
        '전용 협업 공간 + 고급 기능',
        '인간 검수자 우선 배정',
        '블록체인 납품 증명서',
        '우선 고객 지원',
      ],
      limitations: [],
    },
  ];

  const paymentMethods = [
    { id: 'kakaopay', name: '카카오페이', icon: '💳' },
    { id: 'naverpay', name: '네이버페이', icon: '💚' },
    { id: 'crypto', name: '암호화폐', icon: '₿' },
    { id: 'giftcard', name: '기프트카드', icon: '🎁' },
  ];

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold mb-1">멤버십</h1>
      <p className="text-text-sub text-sm mb-8">더 빠른 매칭과 풀 검증 리포트를 이용하세요.</p>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl p-6 transition-all ${plan.id === 'pro'
                ? 'glass-card border-white/10 relative overflow-hidden'
                : 'border border-border bg-surface'
              }`}
          >
            {plan.id === 'pro' && (
              <div className="absolute top-0 right-0 bg-active text-active-text text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                RECOMMENDED
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="flex items-baseline mt-1">
                <span className="text-2xl font-black">{plan.price}</span>
                {plan.period && <span className="text-sm text-text-sub ml-1">{plan.period}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <span className="text-success text-xs mt-0.5">✓</span>
                  <span className="text-sm text-text-sub">{f}</span>
                </div>
              ))}
              {plan.limitations.map((l) => (
                <div key={l} className="flex items-start gap-2">
                  <span className="text-text-hint text-xs mt-0.5">✕</span>
                  <span className="text-sm text-text-hint">{l}</span>
                </div>
              ))}
            </div>

            {plan.id === currentPlan ? (
              <div className="text-center py-2.5 rounded-lg bg-surface-2 text-sm text-text-sub">
                현재 플랜
              </div>
            ) : (
              <button className="btn-primary w-full py-2.5 rounded-lg text-sm cursor-pointer">
                업그레이드
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      <h2 className="text-lg font-semibold mb-4">결제 수단</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            className="glass-card glass-card-hover rounded-lg p-4 text-center transition-all cursor-pointer"
          >
            <span className="text-2xl mb-2 block">{method.icon}</span>
            <span className="text-xs font-medium text-text-sub">{method.name}</span>
          </button>
        ))}
      </div>

      {/* Upselling Banner */}
      <div className="glass-card rounded-lg p-5 border-l-2 border-l-active">
        <p className="text-sm font-semibold mb-1">💡 알고 계셨나요?</p>
        <p className="text-sm text-text-sub leading-relaxed">
          Pro 멤버십이었다면 매칭이 평균 2일 더 빨랐을 거예요.
          풀 검증 리포트와 우선 매칭으로 프로젝트 성공률을 높여보세요.
        </p>
      </div>
    </div>
  );
};

export default MembershipPage;

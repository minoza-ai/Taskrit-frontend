import { useMemo, useState } from 'react';

type ExchangeMode = 'withdraw' | 'deposit';

const MOCK_RATE_KRW_PER_TASK = 1325;

const formatKrw = (value: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatTask = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const ExchangePage = () => {
  const [mode, setMode] = useState<ExchangeMode>('withdraw');
  const [taskAmountInput, setTaskAmountInput] = useState('250');
  const [krwAmountInput, setKrwAmountInput] = useState('300000');
  const [bankName, setBankName] = useState('카카오뱅크');
  const [accountNumber, setAccountNumber] = useState('3333-12-1234567');
  const [depositorName, setDepositorName] = useState('홍길동');

  const taskAmount = Number(taskAmountInput) || 0;
  const krwAmount = Number(krwAmountInput) || 0;

  const withdrawPreview = useMemo(() => {
    const grossKrw = taskAmount * MOCK_RATE_KRW_PER_TASK;
    const fee = Math.round(grossKrw * 0.008);
    const netKrw = Math.max(grossKrw - fee, 0);

    return {
      grossKrw,
      fee,
      netKrw,
    };
  }, [taskAmount]);

  const depositPreview = useMemo(() => {
    const fee = Math.round(krwAmount * 0.005);
    const effectiveKrw = Math.max(krwAmount - fee, 0);
    const task = effectiveKrw / MOCK_RATE_KRW_PER_TASK;

    return {
      fee,
      task,
      effectiveKrw,
    };
  }, [krwAmount]);

  return (
    <div className="animate-in">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">TASK 환전</h1>
          <p className="text-sm text-text-sub">TASK 토큰을 원화(KRW)로 출금하거나, 원화로 입금해 TASK를 충전할 수 있습니다.</p>
        </div>
        <div className="glass-card rounded-xl px-4 py-3 min-w-[220px]">
          <p className="text-xs text-text-hint mb-1">기준 환율</p>
          <p className="text-lg font-semibold">1 TASK = {formatKrw(MOCK_RATE_KRW_PER_TASK)}</p>
          <p className="text-[11px] text-text-hint mt-1">실시간 환율 연동 전 데모 UI입니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass-card rounded-xl p-4 md:p-5">
          <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-1 mb-5">
            <button
              type="button"
              onClick={() => setMode('withdraw')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'withdraw' ? 'bg-surface text-text shadow-sm' : 'text-text-hint hover:text-text-sub'}`}
            >
              원화 출금
            </button>
            <button
              type="button"
              onClick={() => setMode('deposit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'deposit' ? 'bg-surface text-text shadow-sm' : 'text-text-hint hover:text-text-sub'}`}
            >
              원화 입금
            </button>
          </div>

          {mode === 'withdraw' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-xs text-text-sub">
                  출금할 TASK 수량
                  <input
                    value={taskAmountInput}
                    onChange={(e) => setTaskAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="예: 250"
                    className="glass-input rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-text-sub">
                  은행명
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="glass-input rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option>카카오뱅크</option>
                    <option>신한은행</option>
                    <option>국민은행</option>
                    <option>우리은행</option>
                    <option>하나은행</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-xs text-text-sub">
                  출금 계좌번호
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="계좌번호 입력"
                    className="glass-input rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-text-sub">
                  예금주
                  <input
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="예금주명"
                    className="glass-input rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/60 p-4">
                <p className="text-xs text-text-hint mb-3">출금 예상</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-sub">총 환전 금액</span>
                    <span>{formatKrw(withdrawPreview.grossKrw)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-sub">수수료 (0.8%)</span>
                    <span>- {formatKrw(withdrawPreview.fee)}</span>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>실수령액</span>
                    <span>{formatKrw(withdrawPreview.netKrw)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-primary w-full rounded-lg py-3 text-sm"
              >
                출금 신청하기 (데모)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-xs text-text-sub">
                  입금할 원화 금액
                  <input
                    value={krwAmountInput}
                    onChange={(e) => setKrwAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="예: 300000"
                    className="glass-input rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-text-sub">
                  입금자명
                  <input
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="입금자명"
                    className="glass-input rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/60 p-4">
                <p className="text-xs text-text-hint mb-3">입금 예상</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-sub">입금 금액</span>
                    <span>{formatKrw(krwAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-sub">수수료 (0.5%)</span>
                    <span>- {formatKrw(depositPreview.fee)}</span>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>충전 TASK</span>
                    <span>{formatTask(depositPreview.task)} TASK</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/60 p-4 text-sm">
                <p className="text-text-sub mb-1">데모 가상 입금 계좌</p>
                <p className="font-semibold">신한은행 110-555-903412</p>
                <p className="text-xs text-text-hint mt-2">실제 송금은 이뤄지지 않으며, UI 시연용 안내입니다.</p>
              </div>

              <button
                type="button"
                className="btn-primary w-full rounded-lg py-3 text-sm"
              >
                입금 확인 요청 (데모)
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">정산 상태</h2>
            <div className="space-y-2 text-xs text-text-sub">
              <div className="flex items-center justify-between">
                <span>출금 가능 TASK</span>
                <span className="text-text font-medium">1,840.55 TASK</span>
              </div>
              <div className="flex items-center justify-between">
                <span>정산 대기</span>
                <span className="text-text font-medium">{formatKrw(420000)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>오늘 처리 건수</span>
                <span className="text-text font-medium">6건</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">최근 환전 내역</h2>
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-border p-3 bg-surface-2/50">
                <div className="flex justify-between items-center">
                  <span className="text-text-sub">출금</span>
                  <span className="text-emerald-500 font-medium">완료</span>
                </div>
                <p className="mt-1 text-sm font-semibold">{formatKrw(180000)}</p>
                <p className="mt-0.5 text-text-hint">2026-04-04 17:21</p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-surface-2/50">
                <div className="flex justify-between items-center">
                  <span className="text-text-sub">입금</span>
                  <span className="text-amber-500 font-medium">검수중</span>
                </div>
                <p className="mt-1 text-sm font-semibold">{formatKrw(300000)}</p>
                <p className="mt-0.5 text-text-hint">2026-04-04 14:09</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 leading-5">
            본 페이지는 프로토타입 UI입니다. 실제 KRW 입출금, 계좌 검증, 자금세탁방지(AML) 검증은 서버 및 결제/뱅킹 연동 후 활성화됩니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangePage;

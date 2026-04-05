import { useState } from 'react';
import PopupModal from '../components/PopupModal';

interface MarketItem {
  id: string;
  title: string;
  category: string;
  price: string;
  seller: string;
  rating: number;
  sales: number;
}

const MarketplacePage = () => {
  const [activeTab, setActiveTab] = useState<'browse' | 'sell'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Sell form
  const [sellTitle, setSellTitle] = useState('');
  const [sellCategory, setSellCategory] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellDescription, setSellDescription] = useState('');
  const [isSellSuccessOpen, setIsSellSuccessOpen] = useState(false);

  const categories = ['전체', '프롬프트', '워크플로우', '설계 프로세스', '데이터셋', 'API 템플릿'];
  const categoryKeys = ['all', 'prompt', 'workflow', 'process', 'dataset', 'template'];

  const [items] = useState<MarketItem[]>([]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSellSuccessOpen(true);
    setSellTitle('');
    setSellCategory('');
    setSellPrice('');
    setSellDescription('');
  };

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold mb-1">노하우 마켓플레이스</h1>
      <p className="text-text-sub text-sm mb-6">프롬프트, 워크플로우, 설계 프로세스를 거래하세요.</p>

      {/* Tabs */}
      <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-0.5 mb-6">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'browse'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-hint hover:text-text-sub'
            }`}
        >
          둘러보기
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'sell'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-hint hover:text-text-sub'
            }`}
        >
          판매하기
        </button>
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="노하우 검색..."
              className="glass-input w-full px-3.5 py-3 rounded-lg text-sm font-sans"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(categoryKeys[idx])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === categoryKeys[idx]
                    ? 'bg-active text-active-text'
                    : 'bg-surface-2 text-text-sub border border-border hover:border-text-hint'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Items */}
          {filteredItems.length === 0 ? (
            <div className="glass-card rounded-lg p-12 text-center">
              <p className="text-text-sub mb-1">등록된 상품이 없습니다</p>
              <p className="text-text-hint text-xs">첫 번째 노하우 상품을 등록해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map((item) => (
                <button key={item.id} className="glass-card glass-card-hover rounded-lg p-5 text-left transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-[15px]">{item.title}</h3>
                    <span className="text-sm font-bold text-text">{item.price}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-text-hint">
                    <span>{item.seller}</span>
                    <span>⭐ {item.rating}</span>
                    <span>{item.sales}건 판매</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'sell' && (
        <form onSubmit={handleSellSubmit} className="max-w-lg flex flex-col gap-5">
          <div className="glass-card rounded-lg p-5">
            <h2 className="text-base font-semibold mb-4">노하우 상품 등록</h2>
            <p className="text-sm text-text-sub mb-4">
              작업 과정에서 도출된 프롬프트, 워크플로우, 설계 프로세스 등을 상품으로 등록하세요.
              개인키로 암호화되어 안전하게 거래됩니다.
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">상품 제목</label>
                <input
                  type="text"
                  value={sellTitle}
                  onChange={(e) => setSellTitle(e.target.value)}
                  placeholder="예: GPT-4 이미지 분석 프롬프트 템플릿"
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">카테고리</label>
                <div className="flex flex-wrap gap-2">
                  {['프롬프트', '워크플로우', '설계 프로세스', '데이터셋', 'API 템플릿'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSellCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${sellCategory === cat
                          ? 'bg-active text-active-text'
                          : 'bg-surface-2 text-text-sub border border-border'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">가격</label>
                <input
                  type="text"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="예: 10,000원 또는 0.1 SOL"
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">설명</label>
                <textarea
                  value={sellDescription}
                  onChange={(e) => setSellDescription(e.target.value)}
                  placeholder="상품에 대한 상세 설명..."
                  rows={3}
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[80px]"
                />
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <p className="text-sm text-text-sub">파일을 드래그하거나 클릭하세요</p>
                <p className="text-xs text-text-hint mt-1">파일은 개인키로 암호화됩니다</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!sellTitle || !sellCategory || !sellPrice}
            className="btn-primary w-full py-3 rounded-lg text-sm cursor-pointer"
          >
            상품 등록
          </button>
        </form>
      )}

      <PopupModal
        open={isSellSuccessOpen}
        title="상품 등록 완료"
        message="노하우 상품이 등록되었습니다! (백엔드 API 연동 예정)"
        confirmText="확인"
        variant="alert"
        onClose={() => setIsSellSuccessOpen(false)}
        onConfirm={() => setIsSellSuccessOpen(false)}
      />
    </div>
  );
};

export default MarketplacePage;

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface SharedFile {
  name: string;
  size: string;
  uploadedBy: string;
}

const WorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'tasks' | 'schedule'>('chat');
  const [message, setMessage] = useState('');
  const [messages] = useState<ChatMessage[]>([]);
  const [files] = useState<SharedFile[]>([]);

  return (
    <div className="animate-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-text-hint hover:text-text transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">협업 공간</h1>
          <p className="text-xs text-text-hint">프로젝트 #{id}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-6 overflow-x-auto">
        {(['chat', 'files', 'tasks', 'schedule'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-hint hover:text-text-sub'
            }`}
          >
            {tab === 'chat' ? '채팅' : tab === 'files' ? '파일' : tab === 'tasks' ? '역할 분담' : '일정'}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-280px)]">
          <div className="flex-1 glass-card rounded-lg p-4 overflow-y-auto mb-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-text-sub text-sm">아직 메시지가 없습니다</p>
                  <p className="text-text-hint text-xs mt-1">팀원들과 대화를 시작하세요</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">{msg.sender}</span>
                      <span className="text-[10px] text-text-hint">{msg.time}</span>
                    </div>
                    <p className="text-sm text-text-sub">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지 입력..."
              className="glass-input flex-1 px-3.5 py-2.5 rounded-lg text-sm font-sans"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && message.trim()) {
                  setMessage('');
                }
              }}
            />
            <button className="btn-primary px-5 py-2.5 rounded-lg text-sm cursor-pointer">
              전송
            </button>
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">공유 파일</h2>
            <button className="btn-secondary px-3 py-1.5 rounded-md text-xs">
              + 업로드
            </button>
          </div>
          {files.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-text-sub">공유된 파일이 없습니다</p>
              <p className="text-xs text-text-hint mt-1">파일을 드래그하거나 업로드하세요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div key={file.name} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
                  <div>
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-text-hint ml-2">{file.size}</span>
                  </div>
                  <span className="text-xs text-text-hint">{file.uploadedBy}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="glass-card rounded-lg p-5">
          <h2 className="text-base font-semibold mb-4">역할 분담</h2>
          <div className="text-center py-8">
            <p className="text-sm text-text-sub">팀 매칭 확정 후 역할을 분담할 수 있습니다</p>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="glass-card rounded-lg p-5">
          <h2 className="text-base font-semibold mb-4">일정 관리</h2>
          <div className="text-center py-8">
            <p className="text-sm text-text-sub">등록된 일정이 없습니다</p>
            <button className="btn-secondary px-4 py-2 rounded-lg text-sm mt-3">
              + 일정 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspacePage;

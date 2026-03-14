import { useState } from 'react';

interface Message {
  id: string;
  sender: string;
  content: string;
  time: string;
  isMe: boolean;
}

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
}

const MessagesPage = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const conversations: Conversation[] = [
    { id: '1', name: 'Alice K.', lastMessage: '디자인 시안 확인해주세요', time: '2분 전', unread: 2 },
    { id: '2', name: 'Bob L.', lastMessage: '일정 조율 가능할까요?', time: '1시간 전', unread: 0 },
    { id: '3', name: 'Charlie M.', lastMessage: '계약 조건 논의하실래요?', time: '어제', unread: 1 },
  ];

  const messages: Message[] = selectedConversation
    ? [
        { id: '1', sender: 'Alice K.', content: '안녕하세요! 프로젝트 관련 논의 드립니다.', time: '14:20', isMe: false },
        { id: '2', sender: 'Me', content: '네, 안녕하세요. 궁금한 점이 있으시면 말씀하세요.', time: '14:21', isMe: true },
        { id: '3', sender: 'Alice K.', content: '디자인 시안 확인해주세요', time: '14:25', isMe: false },
      ]
    : [];

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setNewMessage('');
  };

  return (
    <div className="animate-in h-[calc(100vh-12rem)]">
      <h1 className="text-2xl font-bold mb-6">메시지</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100%-3rem)]">
        {/* Conversation List */}
        <div className="glass-card rounded-xl p-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-all cursor-pointer ${
                  selectedConversation === conv.id
                    ? 'bg-surface-2 border border-border'
                    : 'hover:bg-surface-2/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{conv.name}</span>
                  <span className="text-[10px] text-text-hint">{conv.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-sub truncate flex-1">{conv.lastMessage}</span>
                  {conv.unread > 0 && (
                    <span className="ml-2 bg-active text-active-text text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {conversations.length === 0 && (
            <div className="text-center py-12 text-text-hint text-sm">
              대화가 없습니다
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="md:col-span-2 glass-card rounded-xl flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border">
                <span className="font-semibold text-sm">
                  {conversations.find((c) => c.id === selectedConversation)?.name}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                        msg.isMe
                          ? 'bg-active text-active-text rounded-br-md'
                          : 'bg-surface-2 text-text rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                      <div
                        className={`text-[10px] mt-1 ${
                          msg.isMe ? 'text-active-text/70' : 'text-text-hint'
                        }`}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="메시지를 입력하세요..."
                    className="glass-input flex-1 py-2.5 px-4 rounded-full text-sm"
                  />
                  <button
                    onClick={handleSend}
                    className="btn-primary px-5 py-2.5 rounded-full text-sm cursor-pointer"
                  >
                    전송
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-hint text-sm">
              대화를 선택해주세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;

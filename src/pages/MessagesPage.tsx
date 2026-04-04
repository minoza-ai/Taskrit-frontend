import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/theme';
import { useChatSettingsStore } from '../lib/chatSettings';
import {
  addRoomMembers,
  createDmRoom,
  deleteRoomMessage,
  editRoomMessage,
  listChatUsers,
  listMyChatRooms,
  listRoomMessages,
  markRoomAsRead,
  sendRoomMessage,
  createTeamRoom,
  toggleRoomMessageReaction,
  uploadRoomFile,
  reportUser,
  updateRoomImage,
  updateRoomName,
  type ChatMessage,
  type ChatRoom,
  type ChatUser,
} from '../lib/api';
import VerifiedIcon from '../components/VerifiedIcon';
const PENDING_INCOMING_CALL_STORAGE_KEY = 'taskrit:pending-incoming-call';
type InviteModalMode = 'create-team-room' | 'invite-into-room';

const MessagesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useThemeStore((s) => s.mode);
  const isLightTheme =
    themeMode === 'light' ||
    (themeMode === 'system' && document.documentElement.getAttribute('data-theme') === 'light');

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [roomListSearchQuery, setRoomListSearchQuery] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setWsConnected] = useState(false);
  const [isComposingMessage, setIsComposingMessage] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showNewMessageNotice, setShowNewMessageNotice] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [actionMenuState, setActionMenuState] = useState<{ messageId: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.innerWidth >= 768);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRoomMembersPopupOpen, setIsRoomMembersPopupOpen] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [isUpdatingRoomName, setIsUpdatingRoomName] = useState(false);
  const [roomNameError, setRoomNameError] = useState<string | null>(null);
  const [isUpdatingRoomImage, setIsUpdatingRoomImage] = useState(false);
  const [roomImageError, setRoomImageError] = useState<string | null>(null);
  
  // Group Chat Invite State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSelectedUsers, setInviteSelectedUsers] = useState<ChatUser[]>([]);
  const [inviteRoomName, setInviteRoomName] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteModalMode, setInviteModalMode] = useState<InviteModalMode>('invite-into-room');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedReportUser, setSelectedReportUser] = useState<ChatUser | null>(null);

  const [isCallConnecting, setIsCallConnecting] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callPeerUserUuid, setCallPeerUserUuid] = useState<string | null>(null);
  const [callStatusText, setCallStatusText] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isHeadsetMuted, setIsHeadsetMuted] = useState(false);
  const [callSpeakerState, setCallSpeakerState] = useState<Record<string, { active: boolean; level: number }>>({});
  const [incomingCallState, setIncomingCallState] = useState<{
    roomId: string;
    callerUserUuid: string;
    callerNickname?: string;
  } | null>(null);
  const [reactionPickerMessage, setReactionPickerMessage] = useState<ChatMessage | null>(null);
  const [reactionViewerState, setReactionViewerState] = useState<{
    messageId: string;
    emoji: string;
    users: string[];
    x: number;
    y: number;
    interactionMode: 'hover' | 'touch';
  } | null>(null);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roomImageInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  const optimizeImage = useChatSettingsStore((s) => s.optimizeUploadedImages);
  const messageStyle = useChatSettingsStore((s) => s.messageStyle);

  const [blinkingMessageId, setBlinkingMessageId] = useState<string | null>(null);
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsRoomRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const rtcPeerRef = useRef<RTCPeerConnection | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const outgoingCallTimeoutRef = useRef<number | null>(null);
  const callAudioMonitorContextRef = useRef<AudioContext | null>(null);
  const callSpeakerMonitorRafRef = useRef<number | null>(null);
  const callElapsedTimerRef = useRef<number | null>(null);
  const callPeerUserUuidRef = useRef<string | null>(null);
  const isCallConnectingRef = useRef(false);
  const isInCallRef = useRef(false);
  const isMicMutedRef = useRef(false);
  const isHeadsetMutedRef = useRef(false);
  const incomingCallStateRef = useRef<{
    roomId: string;
    callerUserUuid: string;
    callerNickname?: string;
  } | null>(null);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollOnNextMessageRef = useRef(false);
  const lastMarkedReadMessageByRoomRef = useRef<Record<string, string>>({});
  const longPressTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const blinkTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartMessageIdRef = useRef<string | null>(null);
  const isSwipeRef = useRef(false);
  const swipeDistanceRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const messageLoadTokenRef = useRef(0);
  const reactionLongPressTimerRef = useRef<number | null>(null);
  const reactionLongPressTriggeredKeyRef = useRef<string | null>(null);
  const reactionTouchStartPosRef = useRef<{ x: number, y: number } | null>(null);


  const appendMessageDedup = (incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === incoming.message_id)) {
        return prev;
      }
      return [...prev, incoming].sort((a, b) => a.seq - b.seq);
    });
  };

  const applyDeletedMessage = (deleted: ChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.message_id === deleted.message_id ? deleted : msg)));
  };

  const applyEditedMessage = (edited: ChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.message_id === edited.message_id ? edited : msg)));
  };

  const getFilteredMessages = () => {
    if (!searchQuery.trim()) {
      return messages;
    }

    // 한글 및 모든 문자 검색 지원
    const normalizedQuery = searchQuery.toLowerCase().trim();

    return messages.filter((msg) => {
      const text = (msg.text || '').toLowerCase();
      return text.includes(normalizedQuery);
    });
  };

  const highlightSearchQuery = (text: string) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const query = searchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const filteredMessages = getFilteredMessages();

  const markMessageAsRead = async (roomId: string, messageId: string) => {
    if (!accessToken) return;
    if (!messageId) return;

    if (lastMarkedReadMessageByRoomRef.current[roomId] === messageId) {
      return;
    }

    try {
      await markRoomAsRead(accessToken, roomId, messageId);
      lastMarkedReadMessageByRoomRef.current[roomId] = messageId;
      await loadRooms();
    } catch {
      // 읽음 표시는 UX 보조 기능이라 실패해도 채팅 흐름은 유지한다.
    }
  };

  const applyReadUpdate = (
    readerUserUuid: string,
    lastReadSeq: number,
    previousLastReadSeq = 0,
  ) => {
    setMessages((prev) => {
      if (!Number.isFinite(lastReadSeq) || lastReadSeq <= 0) {
        return prev;
      }

      const safePreviousSeq = Number.isFinite(previousLastReadSeq) ? Math.max(previousLastReadSeq, 0) : 0;
      if (lastReadSeq <= safePreviousSeq) {
        return prev;
      }

      return prev.map((msg) => {
        if (
          msg.sender_uuid === readerUserUuid
          || msg.seq > lastReadSeq
          || msg.seq <= safePreviousSeq
        ) {
          return msg;
        }

        const nextUnread = Math.max((msg.unread_member_count || 0) - 1, 0);
        return { ...msg, unread_member_count: nextUnread };
      });
    });
  };

  const sendWsEvent = (payload: Record<string, unknown>, requiredRoomId?: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (requiredRoomId && wsRoomRef.current !== requiredRoomId) {
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  };

  const startIncomingCallRingtone = () => {
    window.dispatchEvent(new CustomEvent('taskrit:start-call-ringtone'));
  };

  const stopIncomingCallRingtone = () => {
    window.dispatchEvent(new CustomEvent('taskrit:stop-call-ringtone'));
  };
  
  const clearPendingIncomingCall = () => {
    try {
      sessionStorage.removeItem(PENDING_INCOMING_CALL_STORAGE_KEY);
    } catch {
      // Ignore storage failures
    }
  };
  
  const readPendingIncomingCall = () => {
    try {
      const raw = sessionStorage.getItem(PENDING_INCOMING_CALL_STORAGE_KEY);
      if (!raw) return null;
  
      const parsed = JSON.parse(raw) as {
        roomId?: string;
        callerUserUuid?: string;
        callerNickname?: string;
        createdAt?: number;
      };
  
      if (!parsed.roomId || !parsed.callerUserUuid) {
        return null;
      }
  
      return {
        roomId: parsed.roomId,
        callerUserUuid: parsed.callerUserUuid,
        callerNickname: parsed.callerNickname,
      };
    } catch {
      return null;
    }
  };

  const stopLocalAudioTracks = () => {
    if (!localAudioStreamRef.current) {
      return;
    }

    localAudioStreamRef.current.getTracks().forEach((track) => track.stop());
    localAudioStreamRef.current = null;
  };

  const stopCallSpeakerMonitor = () => {
    if (callSpeakerMonitorRafRef.current) {
      window.cancelAnimationFrame(callSpeakerMonitorRafRef.current);
      callSpeakerMonitorRafRef.current = null;
    }

    if (callAudioMonitorContextRef.current) {
      void callAudioMonitorContextRef.current.close();
      callAudioMonitorContextRef.current = null;
    }

    setCallSpeakerState({});
  };

  const createStreamVolumeSampler = (audioContext: AudioContext, stream: MediaStream) => {
    const sourceNode = audioContext.createMediaStreamSource(stream);
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.86;
    sourceNode.connect(analyserNode);

    const waveformData = new Uint8Array(analyserNode.fftSize);

    return () => {
      analyserNode.getByteTimeDomainData(waveformData);

      let energySum = 0;
      for (let i = 0; i < waveformData.length; i += 1) {
        const centered = (waveformData[i] - 128) / 128;
        energySum += centered * centered;
      }

      const rms = Math.sqrt(energySum / waveformData.length);
      return Math.min(1, rms * 18);
    };
  };

  const startCallSpeakerMonitor = () => {
    if (!user?.user_uuid || !localAudioStreamRef.current) {
      return;
    }

    stopCallSpeakerMonitor();

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const audioContext = new AudioCtx();
    callAudioMonitorContextRef.current = audioContext;

    const localSampler = createStreamVolumeSampler(audioContext, localAudioStreamRef.current);
    const remoteSampler = remoteAudioStreamRef.current
      ? createStreamVolumeSampler(audioContext, remoteAudioStreamRef.current)
      : null;

    let lastEmitTime = 0;

    const tick = () => {
      const localLevel = localSampler();
      const remoteLevel = remoteSampler ? remoteSampler() : 0;
      const peerUserUuid = callPeerUserUuidRef.current;

      // Apply a noise gate to avoid false-positive speaking highlights from ambient noise.
      const localGate = 0.2;
      const remoteGate = 0.16;
      const localSpeakingLevel = Math.max(0, (localLevel - localGate) / (1 - localGate));
      const remoteSpeakingLevel = Math.max(0, (remoteLevel - remoteGate) / (1 - remoteGate));

      const nextSpeakerState: Record<string, { active: boolean; level: number }> = {
        [user.user_uuid]: {
          active: !isMicMutedRef.current && localSpeakingLevel > 0.12,
          level: localSpeakingLevel,
        },
      };

      if (peerUserUuid) {
        nextSpeakerState[peerUserUuid] = {
          active: remoteSpeakingLevel > 0.1,
          level: remoteSpeakingLevel,
        };
      }

      const now = performance.now();
      if (now - lastEmitTime >= 90) {
        setCallSpeakerState(nextSpeakerState);
        lastEmitTime = now;
      }

      callSpeakerMonitorRafRef.current = window.requestAnimationFrame(tick);
    };

    callSpeakerMonitorRafRef.current = window.requestAnimationFrame(tick);
  };

  const getCallTargetUserUuid = () => {
    if (!selectedRoom || !user?.user_uuid || !Array.isArray(selectedRoom.members)) {
      return null;
    }

    return selectedRoom.members.find((memberUuid) => memberUuid !== user.user_uuid) || null;
  };

  const cleanupVoiceCall = (notifyPeer: boolean, toastMessage?: string) => {
    const targetUserUuid = callPeerUserUuid;

    if (outgoingCallTimeoutRef.current) {
      window.clearTimeout(outgoingCallTimeoutRef.current);
      outgoingCallTimeoutRef.current = null;
    }

    stopIncomingCallRingtone();

    if (notifyPeer && targetUserUuid) {
      sendWsEvent({
        type: 'call_end',
        target_user_uuid: targetUserUuid,
      });
    }

    if (rtcPeerRef.current) {
      rtcPeerRef.current.ontrack = null;
      rtcPeerRef.current.onicecandidate = null;
      rtcPeerRef.current.onconnectionstatechange = null;
      rtcPeerRef.current.close();
      rtcPeerRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    stopLocalAudioTracks();
    stopCallSpeakerMonitor();

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1;
    }
    remoteAudioStreamRef.current = null;

    setIsCallConnecting(false);
    setIsInCall(false);
    setCallPeerUserUuid(null);
    setCallStatusText(null);
    setCallStartedAt(null);
    setCallElapsedSeconds(0);
    setIsMicMuted(false);
    setIsHeadsetMuted(false);
    setIncomingCallState(null);
  clearPendingIncomingCall();

    if (callElapsedTimerRef.current) {
      window.clearInterval(callElapsedTimerRef.current);
      callElapsedTimerRef.current = null;
    }
    isCallConnectingRef.current = false;
    isInCallRef.current = false;
    callPeerUserUuidRef.current = null;
    incomingCallStateRef.current = null;

    if (toastMessage) {
      showToast(toastMessage);
    }
  };

  const createPeerConnection = (targetUserUuid: string) => {
    if (rtcPeerRef.current) {
      rtcPeerRef.current.close();
      rtcPeerRef.current = null;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      sendWsEvent({
        type: 'webrtc_ice',
        target_user_uuid: targetUserUuid,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream || !remoteAudioRef.current) {
        return;
      }

      remoteAudioStreamRef.current = remoteStream;
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = isHeadsetMutedRef.current;
      remoteAudioRef.current.volume = isHeadsetMutedRef.current ? 0 : 1;
      void remoteAudioRef.current.play().catch(() => {
        // 브라우저 자동재생 정책에 막힐 수 있다. 사용자가 버튼을 눌렀으므로 대부분 재생 가능하다.
      });

      if (isInCallRef.current || isCallConnectingRef.current) {
        startCallSpeakerMonitor();
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === 'connected') {
        if (outgoingCallTimeoutRef.current) {
          window.clearTimeout(outgoingCallTimeoutRef.current);
          outgoingCallTimeoutRef.current = null;
        }

        setIsCallConnecting(false);
        setIsInCall(true);
        setCallStatusText('음성 통화 중');
        setCallStartedAt(Date.now());
        setCallElapsedSeconds(0);
        return;
      }

      if (state === 'failed' || state === 'disconnected') {
        cleanupVoiceCall(false, '통화 연결이 종료되었습니다.');
      }
    };

    rtcPeerRef.current = peerConnection;
    return peerConnection;
  };

  const ensureLocalAudioStream = async () => {
    if (localAudioStreamRef.current) {
      return localAudioStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    localAudioStreamRef.current = stream;
    setIsMicMuted(false);
    return stream;
  };

  const applyPendingIceCandidates = async () => {
    const peerConnection = rtcPeerRef.current;
    if (!peerConnection || !peerConnection.remoteDescription) {
      return;
    }

    if (!pendingIceCandidatesRef.current.length) {
      return;
    }

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const queuedCandidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(queuedCandidate));
      } catch {
        // 후보 중 일부가 만료될 수 있다. 실패해도 통화 자체는 계속 시도한다.
      }
    }
  };

  const handleIncomingCallSignal = async (payload: any) => {
    try {
      if (!user?.user_uuid) {
        return;
      }

      if (payload.target_user_uuid && payload.target_user_uuid !== user.user_uuid) {
        return;
      }

      if (payload.type === 'call_start' && payload.sender_uuid !== user.user_uuid) {
        if (!payload.sender_uuid) {
          return;
        }

        if (isInCallRef.current || isCallConnectingRef.current || incomingCallStateRef.current) {
          sendWsEvent({
            type: 'call_reject',
            target_user_uuid: payload.sender_uuid,
          });
          return;
        }

        setCallPeerUserUuid(payload.sender_uuid);
        setIncomingCallState({
          roomId: typeof payload.room_id === 'string' ? payload.room_id : selectedConversation || '',
          callerUserUuid: payload.sender_uuid,
        });
        try {
          sessionStorage.setItem(PENDING_INCOMING_CALL_STORAGE_KEY, JSON.stringify({
            roomId: typeof payload.room_id === 'string' ? payload.room_id : selectedConversation || '',
            callerUserUuid: payload.sender_uuid,
            createdAt: Date.now(),
          }));
        } catch {
          // Ignore storage failures
        }
        setCallStatusText('수신 중...');
        startIncomingCallRingtone();
        showToast('음성 통화 요청이 도착했습니다.');
        return;
      }

      if (payload.type === 'call_accept' && payload.sender_uuid !== user.user_uuid) {
        if (!payload.sender_uuid || payload.sender_uuid !== callPeerUserUuidRef.current) {
          return;
        }

        setCallStatusText('통화 연결 중...');

        const stream = await ensureLocalAudioStream();
        const peerConnection = createPeerConnection(payload.sender_uuid);

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendWsEvent({
          type: 'webrtc_offer',
          target_user_uuid: payload.sender_uuid,
          sdp: offer.sdp,
        });
        return;
      }

      if (payload.type === 'call_reject' && payload.sender_uuid !== user.user_uuid) {
        cleanupVoiceCall(false, '상대방이 통화를 거절했습니다.');
        return;
      }

      if (payload.type === 'call_end' && payload.sender_uuid !== user.user_uuid) {
        cleanupVoiceCall(false, '상대방이 통화를 종료했습니다.');
        return;
      }

      if (payload.type === 'webrtc_offer' && payload.sender_uuid !== user.user_uuid) {
        if (typeof payload.sdp !== 'string') {
          return;
        }

        setCallPeerUserUuid(payload.sender_uuid);
        setIsCallConnecting(true);
        setCallStatusText('통화 연결 중...');
        setIncomingCallState(null);
        clearPendingIncomingCall();
        stopIncomingCallRingtone();

        const stream = await ensureLocalAudioStream();
        const peerConnection = createPeerConnection(payload.sender_uuid);
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        await peerConnection.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: payload.sdp,
        }));

        await applyPendingIceCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendWsEvent({
          type: 'webrtc_answer',
          target_user_uuid: payload.sender_uuid,
          sdp: answer.sdp,
        });
        return;
      }

      if (payload.type === 'webrtc_answer' && payload.sender_uuid !== user.user_uuid) {
        if (typeof payload.sdp !== 'string' || !rtcPeerRef.current) {
          return;
        }

        await rtcPeerRef.current.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: payload.sdp,
        }));

        await applyPendingIceCandidates();
        return;
      }

      if (payload.type === 'webrtc_ice' && payload.sender_uuid !== user.user_uuid) {
        if (!payload.candidate) {
          return;
        }

        if (!rtcPeerRef.current) {
          pendingIceCandidatesRef.current.push(payload.candidate as RTCIceCandidateInit);
          return;
        }

        if (rtcPeerRef.current.remoteDescription) {
          await rtcPeerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          pendingIceCandidatesRef.current.push(payload.candidate as RTCIceCandidateInit);
        }
      }
    } catch {
      cleanupVoiceCall(false, '음성 통화 연결 처리 중 오류가 발생했습니다.');
    }
  };

  const handleStartVoiceCall = async () => {
    const targetUserUuid = getCallTargetUserUuid();
    if (!targetUserUuid) {
      showToast('1:1 채팅방에서만 음성 통화를 지원합니다.');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('실시간 연결이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      await ensureLocalAudioStream();

      setCallPeerUserUuid(targetUserUuid);
      setIsCallConnecting(true);
      setCallStatusText('상대방 응답 대기 중...');
      setIncomingCallState(null);

      const sent = sendWsEvent({
        type: 'call_start',
        target_user_uuid: targetUserUuid,
      }, selectedConversation || undefined);

      if (!sent) {
        cleanupVoiceCall(false, '통화 요청 전송에 실패했습니다.');
        return;
      }

      if (outgoingCallTimeoutRef.current) {
        window.clearTimeout(outgoingCallTimeoutRef.current);
      }

      outgoingCallTimeoutRef.current = window.setTimeout(() => {
        cleanupVoiceCall(true, '상대방 응답이 없어 통화를 종료했습니다.');
      }, 30000);
    } catch {
      cleanupVoiceCall(false, '마이크 권한이 필요하거나 통화를 시작할 수 없습니다.');
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCallState) {
      return;
    }

    if (selectedConversation !== incomingCallState.roomId) {
      setSelectedConversation(incomingCallState.roomId);
      setMobileView('chat');
      showToast('채팅방 연결 중입니다. 잠시 후 다시 수락해주세요.');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('실시간 연결이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      await ensureLocalAudioStream();
    } catch {
      sendWsEvent({
        type: 'call_reject',
        target_user_uuid: incomingCallState.callerUserUuid,
      });
      stopIncomingCallRingtone();
      setIncomingCallState(null);
      setCallPeerUserUuid(null);
      setCallStatusText(null);
      showToast('마이크 권한이 없어 통화를 받을 수 없습니다.');
      return;
    }

    const sent = sendWsEvent({
      type: 'call_accept',
      target_user_uuid: incomingCallState.callerUserUuid,
    }, incomingCallState.roomId);

    if (!sent) {
      showToast('채팅방 연결이 아직 준비되지 않았습니다. 잠시 후 다시 수락해주세요.');
      return;
    }

    stopIncomingCallRingtone();
    setCallPeerUserUuid(incomingCallState.callerUserUuid);
    setIncomingCallState(null);
    clearPendingIncomingCall();
    setIsCallConnecting(true);
    setCallStatusText('통화 연결 중...');

    if (outgoingCallTimeoutRef.current) {
      window.clearTimeout(outgoingCallTimeoutRef.current);
    }
    outgoingCallTimeoutRef.current = window.setTimeout(() => {
      cleanupVoiceCall(true, '연결 시간이 초과되어 통화를 종료했습니다.');
    }, 30000);
  };

  const handleRejectIncomingCall = () => {
    if (!incomingCallState) {
      return;
    }

    sendWsEvent({
      type: 'call_reject',
      target_user_uuid: incomingCallState.callerUserUuid,
    }, incomingCallState.roomId);

    stopIncomingCallRingtone();
    setIncomingCallState(null);
    setCallPeerUserUuid(null);
    setCallStatusText(null);
    setIsCallConnecting(false);
    showToast('통화를 거절했습니다.');
  };

  const handleEndVoiceCall = () => {
    cleanupVoiceCall(true);
  };

  const handleToggleMicrophone = () => {
    const localStream = localAudioStreamRef.current;
    if (!localStream) {
      showToast('마이크가 연결되지 않았습니다.');
      return;
    }

    const tracks = localStream.getAudioTracks();
    if (!tracks.length) {
      showToast('사용 가능한 마이크 트랙이 없습니다.');
      return;
    }

    const nextMuted = !isMicMutedRef.current;
    tracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMicMuted(nextMuted);
    showToast(nextMuted ? '마이크를 껐습니다.' : '마이크를 켰습니다.');
  };

  const handleToggleHeadset = () => {
    const nextMuted = !isHeadsetMutedRef.current;
    setIsHeadsetMuted(nextMuted);
    showToast(nextMuted ? '상대방 음성을 끕니다.' : '상대방 음성을 켭니다.');
  };

  const clearSocketResources = () => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    wsRoomRef.current = null;
    reconnectAttemptRef.current = 0;
    setWsConnected(false);
  };

  const selectedRoom = rooms.find((c) => c.room_id === selectedConversation) || null;
  const isVoiceCallOverlayVisible = isCallConnecting || isInCall;

  const formatCallDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const callStatusLabel = isInCall
    ? `${callStatusText || '음성 통화 중'} · ${formatCallDuration(callElapsedSeconds)}`
    : (callStatusText || '통화 연결 중...');

  const isNearMessageBottom = () => {
    const viewport = messageViewportRef.current;
    if (!viewport) return true;

    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return remaining <= 56;
  };

  const scrollMessagesToBottom = (behavior: ScrollBehavior = 'auto') => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    setShowNewMessageNotice(false);
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (!messageElement) return;

    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 스크롤 완료 후 깜빡임 효과 시작
    if (blinkTimerRef.current) {
      clearTimeout(blinkTimerRef.current);
    }

    blinkTimerRef.current = window.setTimeout(() => {
      setBlinkingMessageId(messageId);

      // 애니메이션 완료 후 상태 초기화 (1800ms = 0.6s * 3번 깜빡임)
      const resetTimer = window.setTimeout(() => {
        setBlinkingMessageId(null);
        blinkTimerRef.current = null;
      }, 1800);

      return () => clearTimeout(resetTimer);
    }, 600); // 스크롤 완료 시간 대기
  };

  const focusMessageInput = (placeCursorAtEnd = false) => {
    window.setTimeout(() => {
      const input = messageInputRef.current;
      if (!input) return;

      input.focus();

      if (placeCursorAtEnd) {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleMessageScroll = () => {
    if (isNearMessageBottom()) {
      setShowNewMessageNotice(false);
    }
  };

  useLayoutEffect(() => {
    if (!shouldAutoScrollOnNextMessageRef.current) return;

    scrollMessagesToBottom('smooth');
    shouldAutoScrollOnNextMessageRef.current = false;
  }, [messages]);

  useEffect(() => {
    callPeerUserUuidRef.current = callPeerUserUuid;
  }, [callPeerUserUuid]);

  useEffect(() => {
    isCallConnectingRef.current = isCallConnecting;
  }, [isCallConnecting]);

  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isHeadsetMutedRef.current = isHeadsetMuted;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isHeadsetMuted;
      remoteAudioRef.current.volume = isHeadsetMuted ? 0 : 1;
    }
  }, [isHeadsetMuted]);

  useEffect(() => {
    incomingCallStateRef.current = incomingCallState;
  }, [incomingCallState]);

  useEffect(() => {
    if ((isInCall || isCallConnecting) && localAudioStreamRef.current) {
      startCallSpeakerMonitor();
      return;
    }

    stopCallSpeakerMonitor();
  }, [isInCall, isCallConnecting, callPeerUserUuid, user?.user_uuid]);

  useEffect(() => {
    if (!isInCall || !callStartedAt) {
      if (callElapsedTimerRef.current) {
        window.clearInterval(callElapsedTimerRef.current);
        callElapsedTimerRef.current = null;
      }
      return;
    }

    const updateElapsed = () => {
      setCallElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    };

    updateElapsed();
    callElapsedTimerRef.current = window.setInterval(updateElapsed, 1000);

    return () => {
      if (callElapsedTimerRef.current) {
        window.clearInterval(callElapsedTimerRef.current);
        callElapsedTimerRef.current = null;
      }
    };
  }, [isInCall, callStartedAt]);

  useEffect(() => {
    const onResize = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (reactionLongPressTimerRef.current) {
        window.clearTimeout(reactionLongPressTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (outgoingCallTimeoutRef.current) {
        window.clearTimeout(outgoingCallTimeoutRef.current);
      }
      if (callElapsedTimerRef.current) {
        window.clearInterval(callElapsedTimerRef.current);
        callElapsedTimerRef.current = null;
      }
      stopCallSpeakerMonitor();
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const openActionMenu = (messageId: string) => {
    setActionMenuState({ messageId });
  };

  const closeActionMenu = () => {
    setActionMenuState(null);
  };

  const closeReactionPicker = () => {
    setReactionPickerMessage(null);
  };

  const clearReactionLongPressTimer = () => {
    if (reactionLongPressTimerRef.current) {
      window.clearTimeout(reactionLongPressTimerRef.current);
      reactionLongPressTimerRef.current = null;
    }
  };

  const getReactionUserDisplayName = (userUuid: string) => {
    if (userUuid === user?.user_uuid) {
      return `${user?.nickname || '나'} (나)`;
    }

    const found = chatUsers.find((u) => u.user_uuid === userUuid);
    return found?.nickname || '알 수 없음';
  };

  const getIncomingCallerDisplayName = () => {
    if (!incomingCallState) {
      return '알 수 없음';
    }

    if (incomingCallState.callerNickname) {
      return incomingCallState.callerNickname;
    }

    const found = chatUsers.find((u) => u.user_uuid === incomingCallState.callerUserUuid);
    return found?.nickname || '알 수 없음';
  };

  const showReactionViewer = (
    target: HTMLElement,
    messageId: string,
    emoji: string,
    usersByEmoji: string[],
    interactionMode: 'hover' | 'touch' = 'hover',
  ) => {
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.min(Math.max(centerX, 120), Math.max(window.innerWidth - 120, 120));
    const y = Math.max(rect.top - 8, 72);

    setReactionViewerState({
      messageId,
      emoji,
      users: usersByEmoji,
      x: clampedX,
      y,
      interactionMode,
    });
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageTouchStart = (e: React.TouchEvent<HTMLDivElement>, messageId: string) => {
    if (isDesktopViewport) return;

    touchStartXRef.current = e.touches[0].clientX;
    touchStartMessageIdRef.current = messageId;
    isSwipeRef.current = false;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      if (!isSwipeRef.current) {
        setHoveredMessageId(messageId);
        openActionMenu(messageId);
      }
    }, 450);
  };

  const handleMessageTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartXRef.current || !touchStartMessageIdRef.current) return;

    const currentX = e.touches[0].clientX;
    const deltaX = touchStartXRef.current - currentX;

    if (deltaX > 0) {
      swipeDistanceRef.current = Math.min(deltaX, 100);

      // 새 메시지 ID로 변경되면 state 업데이트
      if (swipingMessageId !== touchStartMessageIdRef.current) {
        setSwipingMessageId(touchStartMessageIdRef.current);
      }

      // 매 프레임마다 DOM 업데이트
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        const msgElement = document.getElementById(`message-${touchStartMessageIdRef.current}`);
        if (msgElement) {
          msgElement.style.transform = `translateX(-${swipeDistanceRef.current}px)`;
          msgElement.style.transition = 'none';
        }
      });
    }

    // 왼쪽으로 50px 이상 이동하면 swipe로 간주
    if (deltaX > 50) {
      isSwipeRef.current = true;
      clearLongPressTimer();
    }
  };

  const handleMessageTouchEnd = (messageId: string) => {
    clearLongPressTimer();

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    if (isSwipeRef.current && touchStartMessageIdRef.current === messageId) {
      const msg = messages.find((m) => m.message_id === messageId);
      if (msg) {
        startReplyMessage(msg);
      }
    }

    // DOM에 transition 추가하고 transform 초기화
    const msgElement = document.getElementById(`message-${touchStartMessageIdRef.current}`);
    if (msgElement) {
      msgElement.style.transition = 'transform 0.3s ease-out';
      msgElement.style.transform = 'translateX(0px)';
    }

    touchStartXRef.current = 0;
    touchStartMessageIdRef.current = null;
    isSwipeRef.current = false;
    swipeDistanceRef.current = 0;
    setSwipingMessageId(null);
  };

  const getOtherUser = (room: ChatRoom): ChatUser | null => {
    if (room.room_type === 'team') return null;

    const myUuid = user?.user_uuid;
    if (!myUuid) return null;

    const otherUuid = room.members.find((memberUuid) => memberUuid !== myUuid);
    if (!otherUuid) return null;

    return chatUsers.find((u) => u.user_uuid === otherUuid) || null;
  };

  const roomName = (room: ChatRoom): string => {
    if (room.room_type === 'team') return room.room_name;

    const otherUser = getOtherUser(room);
    if (!otherUser) return room.room_name || '1:1 채팅';

    return otherUser.nickname;
  };

  const findDmRoomByUserUuid = (targetUserUuid: string): ChatRoom | null => {
    const myUuid = user?.user_uuid;
    if (!myUuid) return null;

    return rooms.find((room) => (
      room.room_type === 'dm'
      && room.members.includes(myUuid)
      && room.members.includes(targetUserUuid)
    )) || null;
  };

  const getUserByUuid = (userUuid: string) => {
    if (userUuid === user?.user_uuid) {
      return {
        nickname: user?.nickname || '나',
        profile_image_url: user?.profile_image_url,
        wallet_address: user?.wallet_address,
      };
    }

    const found = chatUsers.find((u) => u.user_uuid === userUuid);
    return {
      nickname: found?.nickname || '알 수 없음',
      profile_image_url: found?.profile_image_url,
      wallet_address: found?.wallet_address,
    };
  };

  const isWalletVerifiedUser = (userUuid: string) => {
    return !!getUserByUuid(userUuid).wallet_address;
  };

  const getUserByIdentifier = (identifier: string) => {
    if (!identifier) {
      return null;
    }

    if (identifier === user?.user_uuid || identifier === user?.user_id) {
      return {
        user_uuid: user?.user_uuid || identifier,
        user_id: user?.user_id || identifier,
        nickname: user?.nickname || '나',
        wallet_address: user?.wallet_address,
      };
    }

    const found = chatUsers.find(
      (chatUser) => chatUser.user_uuid === identifier || chatUser.user_id === identifier,
    );

    if (found) {
      return {
        user_uuid: found.user_uuid,
        user_id: found.user_id,
        nickname: found.nickname,
        wallet_address: found.wallet_address,
      };
    }

    return {
      user_uuid: identifier,
      user_id: identifier,
      nickname: '알 수 없음',
      wallet_address: null,
    };
  };

  const currentRoomMembers: Array<{
    user_uuid: string;
    user_id: string;
    nickname: string;
    wallet_address: string | null;
    isMe: boolean;
  }> = selectedRoom
    ? Array.from(new Set((selectedRoom.members || []).filter(Boolean)))
      .reduce<Array<{
        user_uuid: string;
        user_id: string;
        nickname: string;
        wallet_address: string | null;
        isMe: boolean;
      }>>((acc, memberIdentifier) => {
        const member = getUserByIdentifier(memberIdentifier);
        if (!member) return acc;

        const isMe = member.user_uuid === user?.user_uuid || member.user_id === user?.user_id;
        acc.push({
          ...member,
          wallet_address: member.wallet_address ?? null,
          isMe,
        });
        return acc;
      }, [])
      .sort((a, b) => Number(b.isMe) - Number(a.isMe))
    : [];

  const toAvatarUrl = (profileImageUrl?: string | null) => {
    if (!profileImageUrl) {
      return null;
    }

    return profileImageUrl.startsWith('http') ? profileImageUrl : `/api${profileImageUrl}`;
  };

  const toChatAssetUrl = (assetUrl?: string | null) => {
    if (!assetUrl) {
      return null;
    }

    if (assetUrl.startsWith('http')) {
      return assetUrl;
    }

    const base = import.meta.env.VITE_CHAT_API_BASE || '/chat-api';
    return `${base}${assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`}`;
  };

  const getRoomAvatarUrl = (room: ChatRoom) => {
    if (room.room_type === 'team') {
      return toChatAssetUrl(room.room_image_url);
    }

    return toAvatarUrl(getOtherUser(room)?.profile_image_url);
  };

  function getCallParticipants() {
    if (!user?.user_uuid) {
      return [] as Array<{
        userUuid: string;
        nickname: string;
        avatarUrl: string | null;
        isMe: boolean;
      }>;
    }

    const sourceUuids = selectedRoom?.members?.length
      ? selectedRoom.members
      : [user.user_uuid, ...(callPeerUserUuid ? [callPeerUserUuid] : [])];

    const uniqueUuids = Array.from(new Set(sourceUuids.filter(Boolean))).slice(0, 4);

    return uniqueUuids
      .map((memberUuid) => {
        const baseInfo = getUserByUuid(memberUuid);
        const isMe = memberUuid === user.user_uuid;

        return {
          userUuid: memberUuid,
          nickname: isMe ? `${user.nickname || '나'} (나)` : baseInfo.nickname,
          avatarUrl: toAvatarUrl(baseInfo.profile_image_url),
          isMe,
        };
      })
      .sort((a, b) => Number(b.isMe) - Number(a.isMe));
  }

  const getSenderDisplayName = (msg: ChatMessage) => {
    if (msg.sender_uuid === user?.user_uuid) return user?.nickname || '나';
    return getUserByUuid(msg.sender_uuid).nickname;
  };

  const getSenderAvatarUrl = (msg: ChatMessage) => {
    const profileImage = getUserByUuid(msg.sender_uuid).profile_image_url;
    if (!profileImage) return null;
    return profileImage.startsWith('http') ? profileImage : `/api${profileImage}`;
  };

  const renderReplyPreview = (msg: ChatMessage, isMe: boolean, style: 'bubble' | 'irc') => {
    if (msg.is_deleted || msg.message_type === 'deleted' || !msg.parent_message) {
      return null;
    }

    const isBubble = style === 'bubble';

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (msg.parent_message) {
            scrollToMessage(msg.parent_message.message_id);
          }
        }}
        className={`mb-2 pb-1 border-l-[3px] pl-2 text-xs w-full text-left opacity-90 hover:opacity-100 transition-opacity flex flex-col ${isBubble
          ? (isMe ? 'border-white/40 text-white/90' : 'border-gray-400 text-text-sub')
          : 'border-border text-text-sub bg-surface-2/60 rounded-r-md py-1'
          }`}
      >
        <span className="font-bold mb-0.5">{(msg.parent_message.sender_uuid === user?.user_uuid) ? '나' : msg.parent_message.sender_name}에게 답장</span>
        <span className="truncate line-clamp-1 block w-full">
          {msg.parent_message.is_deleted ? '(삭제된 메시지)' : (msg.parent_message.text || '파일')}
        </span>
      </button>
    );
  };

  const renderTextWithLinks = (text: string): React.ReactNode => {
    // URL 정규식 (http, https, www 포함)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part && urlRegex.test(part)) {
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline hover:opacity-80 transition-opacity break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderMessageMainContent = (msg: ChatMessage, isMe: boolean, isDeleted: boolean, style: 'bubble' | 'irc') => {
    const isImageFile = !isDeleted && msg.message_type === 'file' && (msg.mime_type?.startsWith('image/') || msg.file_name?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i));

    if (isDeleted) {
      return <span className="italic text-text-hint">삭제된 메시지입니다.</span>;
    }

    if (msg.message_type === 'file') {
      const fileUrl = `${import.meta.env.VITE_CHAT_API_BASE || '/chat-api'}/files/${msg.saved_filename}`;

      if (isImageFile) {
        return (
          <div className="cursor-pointer group relative" onClick={() => setViewingImage(fileUrl)}>
            <img
              src={fileUrl}
              alt={msg.file_name || '첨부 이미지'}
              className="max-w-[240px] max-h-[240px] sm:max-w-[320px] sm:max-h-[320px] rounded-lg object-contain bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5"
              loading="lazy"
            />
          </div>
        );
      }

      return (
        <a
          href={fileUrl}
          download={msg.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 hover:underline ${style === 'bubble' && isMe ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          <span className="truncate underline underline-offset-2">{msg.file_name || '파일 다운로드'}</span>
        </a>
      );
    }

    if (searchQuery && msg.text) {
      return <span>{highlightSearchQuery(msg.text)}</span>;
    }

    return <span>{renderTextWithLinks(msg.text || '')}</span>;
  };

  const formatMessageTime = (iso: string): string => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;

    const now = new Date();
    const sameDay =
      dt.getFullYear() === now.getFullYear()
      && dt.getMonth() === now.getMonth()
      && dt.getDate() === now.getDate();

    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');

    if (sameDay) {
      return `${hh}:${mm}`;
    }

    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${month}/${day} ${hh}:${mm}`;
  };

  const loadRooms = async () => {
    if (!accessToken) return;
    setLoadingRooms(true);
    setError(null);
    try {
      const [roomData, userData] = await Promise.all([
        listMyChatRooms(accessToken),
        listChatUsers(accessToken),
      ]);

      setRooms(roomData);
      setChatUsers(userData);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      setError(err.message || '채팅방 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadMessages = async (roomId: string) => {
    if (!accessToken) return;
    const loadToken = ++messageLoadTokenRef.current;
    setLoadingMessages(true);
    setError(null);
    try {
      const pageSize = 100;
      const initialPageCount = 2;
      let allMessages: ChatMessage[] = [];
      let before: string | undefined;
      let hasMore = true;

      // Load 1-2 newest pages first so users can read immediately.
      for (let i = 0; i < initialPageCount; i += 1) {
        const page = await listRoomMessages(accessToken, roomId, {
          limit: pageSize,
          before,
        });

        if (messageLoadTokenRef.current !== loadToken) {
          return;
        }

        if (!page.length) {
          hasMore = false;
          break;
        }

        allMessages = [...page, ...allMessages];

        if (page.length < pageSize) {
          hasMore = false;
          break;
        }

        before = page[0].message_id;
      }

      if (messageLoadTokenRef.current !== loadToken) {
        return;
      }

      setMessages(allMessages);

      const latest = allMessages[allMessages.length - 1];
      if (latest) {
        void markMessageAsRead(roomId, latest.message_id);
      }

      requestAnimationFrame(() => {
        scrollMessagesToBottom('auto');
      });

      setLoadingMessages(false);

      if (!hasMore || !before) {
        return;
      }

      // Continue loading older history in background.
      void (async () => {
        let cursor = before;

        while (cursor) {
          const page = await listRoomMessages(accessToken, roomId, {
            limit: pageSize,
            before: cursor,
          });

          if (messageLoadTokenRef.current !== loadToken) {
            return;
          }

          if (!page.length) {
            return;
          }

          allMessages = [...page, ...allMessages];
          setMessages(allMessages);

          if (page.length < pageSize) {
            return;
          }

          cursor = page[0].message_id;
        }
      })();
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      setError(err.message || '메시지를 불러오지 못했습니다.');
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [accessToken]);

  useEffect(() => {
    const handleNewChatNotification = (event: Event) => {
      const customEvent = event as CustomEvent<{ roomId?: string; messageId?: string }>;
      const roomId = customEvent.detail?.roomId;

      void loadRooms();

      // 현재 보고 있는 방에 대한 알림이면 메시지 목록도 즉시 동기화한다.
      if (roomId && selectedConversation && roomId === selectedConversation) {
        void loadMessages(selectedConversation);
      }
    };

    window.addEventListener('taskrit:new-chat-notification', handleNewChatNotification as EventListener);

    return () => {
      window.removeEventListener('taskrit:new-chat-notification', handleNewChatNotification as EventListener);
    };
  }, [accessToken, selectedConversation]);

  useEffect(() => {
    const handleIncomingCallNotification = (event: Event) => {
      const customEvent = event as CustomEvent<{
        roomId: string;
        callerUserUuid: string;
        callerNickname?: string;
      }>;

      const detail = customEvent.detail;
      if (!detail || !detail.roomId || !detail.callerUserUuid) {
        return;
      }

      if (detail.callerUserUuid === user?.user_uuid) {
        return;
      }

      if (isInCall || isCallConnecting || incomingCallState) {
        return;
      }

      setSelectedConversation(detail.roomId);
      setMobileView('chat');
      setCallPeerUserUuid(detail.callerUserUuid);
      setIncomingCallState({
        roomId: detail.roomId,
        callerUserUuid: detail.callerUserUuid,
        callerNickname: detail.callerNickname,
      });
      setCallStatusText('수신 중...');
      startIncomingCallRingtone();
    };

    window.addEventListener('taskrit:incoming-call-notification', handleIncomingCallNotification as EventListener);

    return () => {
      window.removeEventListener('taskrit:incoming-call-notification', handleIncomingCallNotification as EventListener);
    };
  }, [incomingCallState, isCallConnecting, isInCall, user?.user_uuid]);
  
  useEffect(() => {
    if (!user?.user_uuid || isInCall || isCallConnecting || incomingCallState) {
      return;
    }
  
    const pendingIncomingCall = readPendingIncomingCall();
    if (!pendingIncomingCall) {
      return;
    }
  
    if (pendingIncomingCall.callerUserUuid === user.user_uuid) {
      clearPendingIncomingCall();
      return;
    }
  
    setSelectedConversation(pendingIncomingCall.roomId);
    setMobileView('chat');
    setCallPeerUserUuid(pendingIncomingCall.callerUserUuid);
    setIncomingCallState({
      roomId: pendingIncomingCall.roomId,
      callerUserUuid: pendingIncomingCall.callerUserUuid,
      callerNickname: pendingIncomingCall.callerNickname,
    });
    setCallStatusText('수신 중...');
    startIncomingCallRingtone();
  }, [incomingCallState, isCallConnecting, isInCall, user?.user_uuid]);

  useEffect(() => {
    const targetRoomId = searchParams.get('room');
    const incomingCallFlag = searchParams.get('incomingCall');
    const callerUserUuid = searchParams.get('callerUserUuid');
    const callerNickname = searchParams.get('callerNickname') || undefined;
    if (!targetRoomId) return;

    setSelectedConversation(targetRoomId);
    setMobileView('chat');

    if (
      incomingCallFlag === '1'
      && callerUserUuid
      && callerUserUuid !== user?.user_uuid
      && !isInCall
      && !isCallConnecting
      && !incomingCallState
    ) {
      setCallPeerUserUuid(callerUserUuid);
      setIncomingCallState({
        roomId: targetRoomId,
        callerUserUuid,
        callerNickname,
      });
      setCallStatusText('수신 중...');
      startIncomingCallRingtone();
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('room');
      next.delete('incomingCall');
      next.delete('callerUserUuid');
      next.delete('callerNickname');
      return next;
    }, { replace: true });
  }, [incomingCallState, isCallConnecting, isInCall, searchParams, setSearchParams, user?.user_uuid]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation, accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedConversation) {
      clearSocketResources();
      return;
    }

    const resolvedWsBase = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const envWsBase = (import.meta.env.VITE_CHAT_WS_BASE as string | undefined)?.trim();
      const envWsTarget = (import.meta.env.VITE_CHAT_WS_TARGET as string | undefined)?.trim();

      // taskr.it 배포에서는 기본값(/chat-ws)일 때 채팅 서브도메인으로 직접 연결해
      // 루트 도메인 프록시의 WS 업그레이드 불안정 구간을 우회한다.
      if (
        (window.location.hostname === 'taskr.it' || window.location.hostname === 'www.taskr.it')
        && (!envWsBase || envWsBase === '/chat-ws')
      ) {
        return `${wsProtocol}://chat.taskr.it/ws`;
      }

      if (envWsBase) {
        return envWsBase;
      }

      if (envWsTarget) {
        return `${envWsTarget}/ws`;
      }

      if (isLocalhost) {
        return 'ws://localhost:3001/ws';
      }

      return `${wsProtocol}://${window.location.host}/chat-ws`;
    };

    const wsBase = resolvedWsBase();
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].message_id : null;

    const toWsUrl = () => {
      const query = new URLSearchParams({ token: accessToken });
      if (lastMessageId) {
        query.set('last_message_id', lastMessageId);
      }

      if (wsBase.startsWith('ws://') || wsBase.startsWith('wss://')) {
        return `${wsBase}/rooms/${selectedConversation}?${query.toString()}`;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${wsProtocol}://${window.location.host}${wsBase}/rooms/${selectedConversation}?${query.toString()}`;
    };

    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const socket = new WebSocket(toWsUrl());
      wsRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        wsRoomRef.current = selectedConversation;
        setWsConnected(true);
        reconnectAttemptRef.current = 0; // Reset attempts on successful connection
      };

      socket.onmessage = (event) => {
        if (disposed) return;

        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'message' && payload.data) {
            const incoming = payload.data as ChatMessage;
            const wasNearBottom = isNearMessageBottom();

            if (incoming.room_id === selectedConversation) {
              shouldAutoScrollOnNextMessageRef.current = incoming.sender_uuid === user?.user_uuid || wasNearBottom;
              appendMessageDedup(incoming);

              if (incoming.sender_uuid !== user?.user_uuid) {
                void markMessageAsRead(selectedConversation, incoming.message_id);
              }

              if (!shouldAutoScrollOnNextMessageRef.current) {
                setShowNewMessageNotice(true);
              }
            }

            void loadRooms();
            return;
          }

          if (
            payload.type === 'read_update'
            && payload.room_id === selectedConversation
            && typeof payload.user_uuid === 'string'
            && typeof payload.last_read_seq === 'number'
          ) {
            applyReadUpdate(
              payload.user_uuid,
              payload.last_read_seq,
              typeof payload.previous_last_read_seq === 'number' ? payload.previous_last_read_seq : 0,
            );
            void loadRooms();
            return;
          }

          if (payload.type === 'room_members_updated' && payload.room_id === selectedConversation) {
            void loadMessages(selectedConversation);
            void loadRooms();
            return;
          }

          if (payload.type === 'message_deleted' && payload.data) {
            const deleted = payload.data as ChatMessage;
            if (deleted.room_id === selectedConversation) {
              applyDeletedMessage(deleted);
            }
            void loadRooms();
            return;
          }

          if (payload.type === 'message_updated' && payload.data) {
            const edited = payload.data as ChatMessage;
            if (edited.room_id === selectedConversation) {
              applyEditedMessage(edited);
            }
            void loadRooms();
            return;
          }

          if (payload.type === 'message_reaction_updated' && payload.data) {
            const updated = payload.data as ChatMessage;
            if (updated.room_id === selectedConversation) {
              applyEditedMessage(updated);
            }
            return;
          }

          if (
            payload.type === 'call_start'
            || payload.type === 'call_end'
            || payload.type === 'call_accept'
            || payload.type === 'call_reject'
            || payload.type === 'webrtc_offer'
            || payload.type === 'webrtc_answer'
            || payload.type === 'webrtc_ice'
          ) {
            void handleIncomingCallSignal(payload);
            return;
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onerror = () => {
        if (disposed) return;
        wsRoomRef.current = null;
        setWsConnected(false);
        console.warn('Chat WebSocket error - will attempt to reconnect');
      };

      socket.onclose = () => {
        if (disposed) return;
        wsRoomRef.current = null;
        setWsConnected(false);
        reconnectAttemptRef.current += 1;

        // Exponential backoff: 1200ms * (2 ^ attempt), max 30s
        const backoffMs = Math.min(1200 * Math.pow(2, reconnectAttemptRef.current - 1), 30000);

        // Max 10 attempts
        if (reconnectAttemptRef.current >= 10) {
          console.error('Chat WebSocket: max reconnection attempts reached');
          return;
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, backoffMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearSocketResources();
    };
  }, [accessToken, selectedConversation, user?.user_uuid]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || !accessToken) return;
    const text = newMessage.trim();

    // 수정 모드: 메시지 편집
    if (editingMessageId) {
      try {
        const result = await editRoomMessage(accessToken, editingMessageId, text);
        applyEditedMessage(result.data);
        setNewMessage('');
        setEditingMessageId(null);
        await loadRooms();
        showToast('메시지가 수정되었습니다.');
      } catch (err: any) {
        setError(err.message || '메시지 수정에 실패했습니다.');
      }
      return;
    }

    // 일반 모드: 메시지 전송
    const parentId = replyingMessage?.message_id;

    setNewMessage('');
    try {
      const sent = await sendRoomMessage(accessToken, selectedConversation, text, parentId);
      appendMessageDedup(sent);
      setReplyingMessage(null);
      requestAnimationFrame(() => {
        scrollMessagesToBottom('smooth');
      });
      await loadRooms();
    } catch (err: any) {
      setError(err.message || '메시지 전송에 실패했습니다.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation || !accessToken) return;

    if (file.size > 10 * 1024 * 1024) {
      setToastMessage('파일 크기는 10MB를 초과할 수 없습니다.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      await uploadRoomFile(accessToken, selectedConversation, file, optimizeImage, (progress) => {
        setUploadProgress(progress);
      });
      await loadRooms();
    } catch (err: any) {
      setToastMessage(err.message || '파일 전송에 실패했습니다.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++;
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (!file || !selectedConversation || !accessToken) return;

    if (file.size > 10 * 1024 * 1024) {
      setToastMessage('파일 크기는 10MB를 초과할 수 없습니다.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      await uploadRoomFile(accessToken, selectedConversation, file, optimizeImage, (progress) => {
        setUploadProgress(progress);
      });
      await loadRooms();
    } catch (err: any) {
      setToastMessage(err.message || '파일 전송에 실패했습니다.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMessageAreaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMessageAreaDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++;
      setIsDraggingFile(true);
    }
  };

  const handleMessageAreaDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleMessageAreaDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (!file || !selectedConversation || !accessToken) return;

    if (file.size > 10 * 1024 * 1024) {
      setToastMessage('파일 크기는 10MB를 초과할 수 없습니다.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      await uploadRoomFile(accessToken, selectedConversation, file, optimizeImage, (progress) => {
        setUploadProgress(progress);
      });
      await loadRooms();
    } catch (err: any) {
      setToastMessage(err.message || '파일 전송에 실패했습니다.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!accessToken) return;
    if (message.sender_uuid !== user?.user_uuid) return;
    if (message.is_deleted || message.message_type === 'deleted') return;

    try {
      const result = await deleteRoomMessage(accessToken, message.message_id);
      applyDeletedMessage(result.data);
      await loadRooms();
      closeActionMenu();
    } catch (err: any) {
      setError(err.message || '메시지 삭제에 실패했습니다.');
    }
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    if (message.is_deleted || message.message_type === 'deleted') {
      showToast('삭제된 메시지는 복사할 수 없습니다.');
      closeActionMenu();
      return;
    }

    try {
      await navigator.clipboard.writeText(message.text || '');
      showToast('복사했습니다.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = message.text || '';
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('복사했습니다.');
    }

    closeActionMenu();
  };

  const toggleMessageReaction = async (message: ChatMessage, emoji: string) => {
    if (!accessToken) return;

    try {
      const result = await toggleRoomMessageReaction(accessToken, message.message_id, emoji);
      applyEditedMessage(result.data);
    } catch (err: any) {
      setError(err.message || '메시지 반응 업데이트에 실패했습니다.');
    }
  };

  const reactionOptions = ['👍', '✅', '❤️', '😂', '😲', '😢'];

  const handleAddReaction = async (message: ChatMessage) => {
    if (message.is_deleted || message.message_type === 'deleted') {
      showToast('삭제된 메시지에는 반응할 수 없습니다.');
      closeActionMenu();
      return;
    }

    setReactionPickerMessage(message);
    closeActionMenu();
  };

  const handleSelectReaction = async (emoji: string) => {
    if (!reactionPickerMessage) return;
    await toggleMessageReaction(reactionPickerMessage, emoji);
    closeReactionPicker();
  };

  const renderMessageReactions = (message: ChatMessage, align: 'left' | 'right') => {
    const reactionMap = message.reactions || {};
    const entries = Object.entries(reactionMap).filter(([, usersByEmoji]) => usersByEmoji.length > 0);

    if (!entries.length) {
      return null;
    }

    return (
      <div className={`mt-1 flex flex-wrap gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {entries.map(([emoji, usersByEmoji]) => {
          const reactedByMe = !!user?.user_uuid && usersByEmoji.includes(user.user_uuid);
          const reactionKey = `${message.message_id}-${emoji}`;

          return (
            <button
              key={`${message.message_id}-${emoji}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (reactionLongPressTriggeredKeyRef.current === reactionKey) {
                  reactionLongPressTriggeredKeyRef.current = null;
                  return;
                }
                setReactionViewerState(null);
                void toggleMessageReaction(message, emoji);
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                showReactionViewer(e.currentTarget, message.message_id, emoji, usersByEmoji, 'hover');
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                setReactionViewerState(null);
              }}
              onContextMenu={(e) => {
                if (!isDesktopViewport) e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (isDesktopViewport) return;
                clearLongPressTimer();
                reactionLongPressTriggeredKeyRef.current = null;
                clearReactionLongPressTimer();
                
                const touchObj = e.touches[0];
                if (touchObj) {
                  reactionTouchStartPosRef.current = { x: touchObj.clientX, y: touchObj.clientY };
                }

                const target = e.currentTarget;
                reactionLongPressTimerRef.current = window.setTimeout(() => {
                  reactionLongPressTriggeredKeyRef.current = reactionKey;
                  showReactionViewer(target, message.message_id, emoji, usersByEmoji, 'touch');
                }, 450);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                clearReactionLongPressTimer();
              }}
              onTouchCancel={(e) => {
                e.stopPropagation();
                clearReactionLongPressTimer();
              }}
              onTouchMove={(e) => {
                e.stopPropagation();
                if (!reactionTouchStartPosRef.current) return;
                const touchObj = e.touches[0];
                if (touchObj) {
                  const dx = touchObj.clientX - reactionTouchStartPosRef.current.x;
                  const dy = touchObj.clientY - reactionTouchStartPosRef.current.y;
                  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    clearReactionLongPressTimer();
                  }
                }
              }}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors select-none ${reactedByMe
                ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                : 'bg-surface border-border text-text-sub hover:bg-surface-2'
                }`}
              title="반응 토글"
            >
              <span>{emoji}</span>
              <span className="ml-1 font-semibold">{usersByEmoji.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const startEditMessage = (message: ChatMessage) => {
    if (message.sender_uuid !== user?.user_uuid) return;
    if (message.is_deleted || message.message_type === 'deleted') return;

    setNewMessage(message.text);
    setEditingMessageId(message.message_id);
    setReplyingMessage(null);
    closeActionMenu();
    focusMessageInput(true);
  };

  const cancelEditMessage = () => {
    setNewMessage('');
    setEditingMessageId(null);
  };

  const startReplyMessage = (message: ChatMessage) => {
    if (message.is_deleted || message.message_type === 'deleted') return;
    setReplyingMessage(message);
    setNewMessage('');
    setEditingMessageId(null);
    closeActionMenu();
    focusMessageInput();
  };

  const cancelReplyMessage = () => {
    setReplyingMessage(null);
  };

  const handleOpenDesktopActionMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    messageId: string,
  ) => {
    e.stopPropagation();
    openActionMenu(messageId);
  };

  const handleMessageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    // 한글 IME 조합 중 Enter는 글자 확정 용도로만 사용하고 전송을 막는다.
    if (isComposingMessage || e.nativeEvent.isComposing) {
      return;
    }

    e.preventDefault();
    void handleSend();
  };

  const openInviteModal = async (mode: InviteModalMode) => {
    setInviteModalMode(mode);
    setInviteSearchQuery('');
    setInviteSelectedUsers([]);
    setInviteRoomName('');
    setIsInviteModalOpen(true);

    try {
      if (accessToken) {
        const updatedUsers = await listChatUsers(accessToken);
        setChatUsers(updatedUsers);
      }
    } catch {
      // Ignore silent errors for now
    }
  };

  const handleCreateTeamGroupRoom = async () => {
    if (!accessToken) return;

    const isDmToTeamUpgrade = inviteModalMode === 'invite-into-room' && selectedRoom?.room_type === 'dm';
    const trimmedInviteRoomName = inviteRoomName.trim();

    if (inviteModalMode === 'create-team-room' && inviteSelectedUsers.length < 2) {
      showToast('단체 채팅방은 2명 이상 선택해야 생성할 수 있습니다.');
      return;
    }

    if (inviteModalMode === 'invite-into-room' && inviteSelectedUsers.length === 0) {
      showToast('초대할 사용자를 1명 이상 선택해주세요.');
      return;
    }

    if (isDmToTeamUpgrade && !trimmedInviteRoomName) {
      showToast('단체방 제목을 입력해주세요.');
      return;
    }

    setIsInviting(true);
    try {
      if (inviteModalMode === 'invite-into-room') {
        if (!selectedConversation) {
          showToast('초대할 대화방을 찾을 수 없습니다.');
          return;
        }

        const uids = inviteSelectedUsers.map((u) => u.user_uuid);
        const updatedRoom = await addRoomMembers(accessToken, selectedConversation, uids);
        const finalRoom = isDmToTeamUpgrade
          ? await updateRoomName(accessToken, updatedRoom.room_id, trimmedInviteRoomName)
          : updatedRoom;
        const invitedNames = inviteSelectedUsers.map((u) => u.nickname).join(', ');
        await sendRoomMessage(accessToken, selectedConversation, `${user?.nickname}님이 ${invitedNames}님을 대화방에 초대했습니다.`);

        setIsInviteModalOpen(false);
        setInviteSelectedUsers([]);
        setInviteRoomName('');
        setInviteSearchQuery('');

        await loadRooms();
        if (isDmToTeamUpgrade) {
          setRoomListSearchQuery('');
        }
        setSelectedConversation(finalRoom.room_id);
        setMobileView('chat');
        await loadMessages(finalRoom.room_id);
        showToast('사용자를 대화방에 초대했습니다.');
        return;
      }

      const uids = inviteSelectedUsers.map((u) => u.user_uuid);
      const defaultRoomName = inviteRoomName.trim() || `${user?.nickname || '나'}, ${inviteSelectedUsers.map(u => u.nickname).join(', ')}의 단체방`;

      const newRoom = await createTeamRoom(accessToken, uids, defaultRoomName);
      
      // Send an initial system message to trigger websocket notification for all members
      const invitedNames = inviteSelectedUsers.map(u => u.nickname).join(', ');
      await sendRoomMessage(accessToken, newRoom.room_id, `${user?.nickname}님이 ${invitedNames}님을 초대하여 단체 채팅방을 개설했습니다.`);

      setIsInviteModalOpen(false);
      setInviteSelectedUsers([]);
      setInviteRoomName('');
      setInviteSearchQuery('');
      setRoomListSearchQuery('');
      
      await loadRooms();
      setSelectedConversation(newRoom.room_id);
      setMobileView('chat');
      await loadMessages(newRoom.room_id);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      showToast(err.message || '단체 채팅방 생성에 실패했습니다.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleOpenOrCreateDmByUser = async (targetUser: ChatUser) => {
    if (!accessToken) return;

    if (targetUser.user_uuid === user?.user_uuid) {
      setError('본인과는 대화를 시작할 수 없습니다.');
      return;
    }

    const existingRoom = findDmRoomByUserUuid(targetUser.user_uuid);
    if (existingRoom) {
      setSelectedConversation(existingRoom.room_id);
      setMobileView('chat');
      return;
    }

    setCreatingRoom(true);
    setError(null);

    try {
      const room = await createDmRoom(accessToken, targetUser.user_uuid, `${targetUser.nickname}님과의 대화`);
      setRoomListSearchQuery('');
      await loadRooms();
      setSelectedConversation(room.room_id);
      setMobileView('chat');
      await loadMessages(room.room_id);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
          logout();
          return;
        }
      }
      setError(err.message || '채팅방 생성에 실패했습니다.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const normalizedRoomListSearchQuery = roomListSearchQuery.trim().toLowerCase();
  const recentChatSearchResults = normalizedRoomListSearchQuery
    ? rooms.filter((room) => {
      if (room.room_type === 'team') {
        return room.room_name.toLowerCase().includes(normalizedRoomListSearchQuery);
      }

      const otherUser = getOtherUser(room);
      if (!otherUser) return false;

      return (
        otherUser.nickname.toLowerCase().includes(normalizedRoomListSearchQuery)
        || otherUser.user_id.toLowerCase().includes(normalizedRoomListSearchQuery)
      );
    })
    : rooms;
  const userSearchResults = normalizedRoomListSearchQuery
    ? chatUsers
      .filter((chatUser) => chatUser.user_uuid !== user?.user_uuid)
      .filter((chatUser) => (
        chatUser.nickname.toLowerCase().includes(normalizedRoomListSearchQuery)
        || chatUser.user_id.toLowerCase().includes(normalizedRoomListSearchQuery)
      ))
      .sort((a, b) => Number(!!findDmRoomByUserUuid(b.user_uuid)) - Number(!!findDmRoomByUserUuid(a.user_uuid)))
    : [];
  const inviteSearchNormalized = inviteSearchQuery.trim().toLowerCase();
  const selectedRoomMemberIdentifiers = new Set((selectedRoom?.members ?? []).filter(Boolean));
  const inviteCandidateUsers = chatUsers
    .filter((chatUser) => chatUser.user_uuid !== user?.user_uuid)
    .filter((chatUser) => {
      if (inviteModalMode !== 'invite-into-room') return true;
      return (
        !selectedRoomMemberIdentifiers.has(chatUser.user_uuid)
        && !selectedRoomMemberIdentifiers.has(chatUser.user_id)
      );
    })
    .filter((chatUser) => {
      if (!inviteSearchNormalized) {
        return inviteModalMode !== 'create-team-room';
      }
      return (
        chatUser.nickname.toLowerCase().includes(inviteSearchNormalized)
        || chatUser.user_id.toLowerCase().includes(inviteSearchNormalized)
      );
    });

  useEffect(() => {
    const originalOverflowHtml = document.documentElement.style.overflow;
    const originalHeightHtml = document.documentElement.style.height;
    const originalOverflowBody = document.body.style.overflow;
    const originalHeightBody = document.body.style.height;
    const originalOverscrollHtml = document.documentElement.style.overscrollBehaviorY;
    const originalOverscrollBody = document.body.style.overscrollBehaviorY;

    // 모바일 등에서 페이지 전체 스크롤을 막고 내부 스크롤만 허용
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100dvh';
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100dvh';
    document.body.style.overscrollBehaviorY = 'none';

    return () => {
      document.documentElement.style.overflow = originalOverflowHtml;
      document.documentElement.style.height = originalHeightHtml;
      document.documentElement.style.overscrollBehaviorY = originalOverscrollHtml;
      document.body.style.overflow = originalOverflowBody;
      document.body.style.height = originalHeightBody;
      document.body.style.overscrollBehaviorY = originalOverscrollBody;
    };
  }, []);

  useEffect(() => {
    setIsRoomMembersPopupOpen(false);
  }, [selectedConversation]);

  useEffect(() => {
    if (!isRoomMembersPopupOpen || selectedRoom?.room_type !== 'team') {
      return;
    }

    setRoomNameDraft(selectedRoom.room_name || '');
    setRoomNameError(null);
    setRoomImageError(null);
  }, [isRoomMembersPopupOpen, selectedRoom?.room_id, selectedRoom?.room_name, selectedRoom?.room_type]);

  const handleUpdateRoomName = async () => {
    if (!accessToken || !selectedRoom || selectedRoom.room_type !== 'team') {
      return;
    }

    const nextRoomName = roomNameDraft.trim();
    if (!nextRoomName) {
      setRoomNameError('대화방 이름을 입력해주세요.');
      return;
    }

    setIsUpdatingRoomName(true);
    setRoomNameError(null);

    try {
      const updatedRoom = await updateRoomName(accessToken, selectedRoom.room_id, nextRoomName);
      setRoomNameDraft(updatedRoom.room_name || nextRoomName);
      await loadRooms();
      setSelectedConversation(updatedRoom.room_id);
      showToast('대화방 이름이 변경되었습니다.');
    } catch (err: any) {
      setRoomNameError(err.message || '대화방 이름 변경에 실패했습니다.');
    } finally {
      setIsUpdatingRoomName(false);
    }
  };

  const handleUpdateRoomImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imageFile = e.target.files?.[0];
    e.target.value = '';

    if (!imageFile) {
      return;
    }

    if (!accessToken || !selectedRoom || selectedRoom.room_type !== 'team') {
      return;
    }

    if (!imageFile.type.startsWith('image/')) {
      setRoomImageError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      setRoomImageError('이미지 크기는 5MB를 초과할 수 없습니다.');
      return;
    }

    setIsUpdatingRoomImage(true);
    setRoomImageError(null);

    try {
      const updatedRoom = await updateRoomImage(accessToken, selectedRoom.room_id, imageFile);
      await loadRooms();
      setSelectedConversation(updatedRoom.room_id);
      showToast('대화방 사진이 변경되었습니다.');
    } catch (err: any) {
      setRoomImageError(err.message || '대화방 사진 변경에 실패했습니다.');
    } finally {
      setIsUpdatingRoomImage(false);
    }
  };

  const isRoomListSearching = normalizedRoomListSearchQuery.length > 0;
  const isInvitingFromDmRoom = inviteModalMode === 'invite-into-room' && selectedRoom?.room_type === 'dm';
  const shouldShowInviteRoomNameInput = inviteModalMode === 'create-team-room' || isInvitingFromDmRoom;
  const isInviteSubmitDisabled = isInviting
    || (inviteModalMode === 'create-team-room' ? inviteSelectedUsers.length < 2 : inviteSelectedUsers.length === 0)
    || (isInvitingFromDmRoom && inviteRoomName.trim().length === 0);
  const popupBackdropClass = isLightTheme
    ? 'absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]'
    : 'absolute inset-0 bg-black/55 backdrop-blur-[1px]';
  const popupCardClass = isLightTheme
    ? 'relative w-full max-w-sm rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl p-5 animate-modal-in overflow-hidden flex flex-col max-h-[80vh]'
    : 'relative w-full max-w-sm glass-card rounded-xl border border-glass-border p-5 animate-modal-in overflow-hidden flex flex-col max-h-[80vh]';
  const popupInputClass = isLightTheme
    ? 'w-full py-2 px-3 rounded-lg text-sm bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-400'
    : 'w-full glass-input py-2 px-3 rounded-lg text-sm';
  const popupInlineInputClass = isLightTheme
    ? 'flex-1 py-2 px-3 rounded-lg text-sm bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-400'
    : 'glass-input flex-1 py-2 px-3 rounded-lg text-sm';
  const popupListClass = isLightTheme
    ? 'flex-1 overflow-y-auto py-2 -mx-2 px-2 min-h-0 mb-4 border-y border-slate-200 bg-slate-50/70'
    : 'flex-1 overflow-y-auto py-2 -mx-2 px-2 min-h-0 mb-4 border-y border-border';
  const popupRowHoverClass = isLightTheme ? 'hover:bg-slate-100' : 'hover:bg-surface-2';
  const popupSelectedRowClass = isLightTheme
    ? 'bg-blue-500/10 border border-blue-200'
    : 'bg-active/20';

  const inviteModalBody = (
    <div className={popupCardClass}>
      <h3 className="text-base font-semibold mb-4">{inviteModalMode === 'create-team-room' ? '단체 채팅방 만들기' : '현재 대화방 사용자 초대'}</h3>

      <div className="mb-4 shrink-0">
        {shouldShowInviteRoomNameInput && (
          <input
            type="text"
            placeholder={isInvitingFromDmRoom ? '단체방 제목 입력' : '채팅방 이름 입력'}
            className={`${popupInputClass} mb-3`}
            value={inviteRoomName}
            onChange={(e) => setInviteRoomName(e.target.value)}
          />
        )}
        <input
          type="text"
          placeholder="사용자 검색"
          className={popupInputClass}
          value={inviteSearchQuery}
          onFocus={async () => {
            try {
              if (accessToken) {
                const updatedUsers = await listChatUsers(accessToken);
                setChatUsers(updatedUsers);
              }
            } catch {
              // Ignore silent errors
            }
          }}
          onChange={(e) => setInviteSearchQuery(e.target.value)}
        />
      </div>

      <div className={popupListClass}>
        {inviteCandidateUsers
          .map((u) => {
            const isSelected = inviteSelectedUsers.some((selected) => selected.user_uuid === u.user_uuid);
            return (
              <button
                key={u.user_uuid}
                className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors border ${isSelected ? popupSelectedRowClass : `border-transparent ${popupRowHoverClass}`}`}
                onClick={() => {
                  if (isSelected) {
                    setInviteSelectedUsers((prev) => prev.filter((p) => p.user_uuid !== u.user_uuid));
                  } else {
                    setInviteSelectedUsers((prev) => [...prev, u]);
                  }
                }}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-border bg-transparent'}`}>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center shrink-0">
                  {u.profile_image_url ? (
                    <img src={u.profile_image_url.startsWith('http') ? u.profile_image_url : `/api${u.profile_image_url}`} alt="profile" className="w-full h-full rounded-full object-cover" />
                  ) : u.nickname[0]}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-sm font-medium">{u.nickname}</span>
                    {u.wallet_address && <VerifiedIcon tooltipPlacement="bottom" />}
                  </div>
                  <div className="truncate text-[11px] text-text-hint">@{u.user_id}</div>
                </div>
              </button>
            );
          })}
        {inviteCandidateUsers.length === 0 && (
          <div className="text-center text-sm text-text-hint py-4">
            {inviteModalMode === 'create-team-room'
              ? (inviteSearchNormalized ? '사용자가 없습니다' : '사용자를 검색해주세요')
              : '초대 가능한 사용자가 없습니다'}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end shrink-0 pt-2">
        <button
          className="btn-secondary px-4 py-2 rounded-md text-sm"
          onClick={() => setIsInviteModalOpen(false)}
        >
          취소
        </button>
        <button
          className="btn-primary px-4 py-2 rounded-md text-sm"
          onClick={() => void handleCreateTeamGroupRoom()}
          disabled={isInviteSubmitDisabled}
        >
          {isInviting ? '처리 중...' : inviteModalMode === 'create-team-room' ? '단체방 만들기' : `${inviteSelectedUsers.length}명 초대`}
        </button>
      </div>
    </div>
  );

  const renderConversationListItem = (conv: ChatRoom) => {
    const targetUser = getOtherUser(conv);
    const profileImageUrl = getRoomAvatarUrl(conv);

    return (
      <button
        key={conv.room_id}
        onClick={() => {
          setSelectedProfileUser(null);
          setSelectedConversation(conv.room_id);
          setMobileView('chat');
        }}
        className={`w-full text-left p-3 rounded-lg transition-all cursor-pointer ${selectedConversation === conv.room_id
          ? 'bg-surface-2 border border-border'
          : 'hover:bg-surface-2/50'
          }`}
      >
        <div className="flex gap-3 items-center">
          <div className="w-10 h-10 rounded-full bg-surface-3 flex-shrink-0 overflow-hidden flex items-center justify-center text-text-sub font-bold text-sm select-none">
            {profileImageUrl ? (
              <>
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.querySelector('.fallback-initial')?.classList.remove('hidden');
                    e.currentTarget.parentElement?.querySelector('.fallback-initial')?.classList.add('flex');
                  }}
                />
                <span className="fallback-initial hidden w-full h-full items-center justify-center bg-surface-3 text-text-sub font-bold">
                  {targetUser?.nickname?.[0] || conv.room_name?.[0] || '?'}
                </span>
              </>
            ) : (targetUser?.nickname?.[0] || conv.room_name?.[0] || '?')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-medium text-sm truncate">{roomName(conv)}</span>
                {targetUser?.user_id && (
                  <span className="text-[11px] text-text-hint truncate">@{targetUser.user_id}</span>
                )}
                {targetUser?.wallet_address && <VerifiedIcon />}
              </div>
              <span className="text-[10px] text-text-hint shrink-0">{conv.last_message_time ? formatMessageTime(conv.last_message_time) : ''}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-sub truncate flex-1">{conv.last_message?.text || '메시지가 없습니다'}</span>
              {(conv.unread_count || 0) > 0 && (
                <span className="ml-2 bg-active text-active-text text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shrink-0">
                  {conv.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const renderUserSearchItem = (chatUser: ChatUser) => {
    const profileImageUrl = chatUser.profile_image_url
      ? (chatUser.profile_image_url.startsWith('http') ? chatUser.profile_image_url : `/api${chatUser.profile_image_url}`)
      : null;
    const existingRoom = findDmRoomByUserUuid(chatUser.user_uuid);
    const lastMessagePreview = existingRoom?.last_message?.text || '메시지가 없습니다';
    const unreadCount = existingRoom?.unread_count || 0;

    return (
      <button
        key={chatUser.user_uuid}
        onClick={() => {
          setSelectedConversation(null);
          setSelectedProfileUser(chatUser);
          if (!isDesktopViewport) {
            setMobileView('chat');
          }
        }}
        className="w-full text-left p-3 rounded-lg transition-all cursor-pointer hover:bg-surface-2/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-3 flex-shrink-0 overflow-hidden flex items-center justify-center text-text-sub font-bold text-sm select-none">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt={chatUser.nickname} className="w-full h-full object-cover" />
            ) : (chatUser.nickname?.[0] || '?')}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm truncate">{chatUser.nickname}</span>
              <span className="text-[11px] text-text-hint truncate">@{chatUser.user_id}</span>
              {chatUser.wallet_address && <VerifiedIcon tooltipPlacement="bottom" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-sub truncate flex-1">{lastMessagePreview}</span>
              {unreadCount > 0 && (
                <span className="ml-2 bg-active text-active-text text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shrink-0">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="animate-in h-[calc(100dvh-7.375rem-1px-max(env(safe-area-inset-bottom),0.5rem))] md:h-[calc(100dvh-8.25rem)] flex flex-col overflow-hidden -mx-4 md:mx-0 -my-4 md:my-0">
      <h1 className={`text-2xl font-bold mb-4 md:mb-6 pt-3 md:pt-0 px-4 md:px-0 ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>메시지</h1>
      {error && <p className="mb-3 text-sm text-error px-4 md:px-0">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-4 flex-1 min-h-0">
        {/* Conversation List */}
        <div className={`px-4 bg-surface/50 border border-border md:glass-card rounded-xl md:p-3 overflow-y-auto min-h-[22rem] md:min-h-0 ${mobileView === 'chat' ? 'hidden md:block' : 'block'} md:block`}>
          <div className="mt-3 md:mt-0 mb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={roomListSearchQuery}
                onChange={(e) => setRoomListSearchQuery(e.target.value)}
                onFocus={async () => {
                  try {
                    if (accessToken) {
                      const updatedUsers = await listChatUsers(accessToken);
                      setChatUsers(updatedUsers);
                    }
                  } catch {
                    // Ignore silent errors
                  }
                }}
                placeholder="닉네임 또는 아이디로 검색"
                className="glass-input flex-1 min-w-0 py-2.5 px-4 rounded-md text-sm"
              />
              <button
                type="button"
                onClick={() => void openInviteModal('create-team-room')}
                className="shrink-0 p-2.5 rounded-md border border-border bg-surface hover:bg-surface-2 transition-colors"
                aria-label="단체 채팅방 만들기"
                title="단체 채팅방 만들기"
              >
                <svg className="w-5 h-5 text-text-hint hover:text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9v4m-2-2h4" />
                </svg>
              </button>
            </div>
            {creatingRoom && (
              <div className="mt-1 text-[11px] text-text-hint">대화방 생성 중...</div>
            )}
          </div>

          {isRoomListSearching ? (
            <div className="space-y-4">
              <div>
                <div className="px-1 mb-1 text-base font-bold tracking-wide text-white">최근 채팅</div>
                <div className="flex flex-col gap-1">
                  {recentChatSearchResults.map((conv) => renderConversationListItem(conv))}
                  {recentChatSearchResults.length === 0 && (
                    <div className="text-xs text-text-hint py-3 px-2">최근 채팅 검색 결과가 없습니다.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="px-1 mb-1 text-base font-bold tracking-wide text-white">사용자 검색</div>
                <div className="flex flex-col gap-1">
                  {userSearchResults.map((chatUser) => renderUserSearchItem(chatUser))}
                  {userSearchResults.length === 0 && (
                    <div className="text-xs text-text-hint py-3 px-2">사용자 검색 결과가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {rooms.map((conv) => renderConversationListItem(conv))}
              </div>

              {loadingRooms && <div className="text-center py-8 text-text-hint text-sm">불러오는 중...</div>}
              {!loadingRooms && rooms.length === 0 && (
                <div className="text-center py-12 text-text-hint text-sm">
                  대화가 없습니다
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat Area */}
        <div
          ref={chatAreaRef}
          onDragEnter={handleMessageAreaDragEnter}
          onDragOver={handleMessageAreaDragOver}
          onDragLeave={handleMessageAreaDragLeave}
          onDrop={handleMessageAreaDrop}
          className={`md:col-span-2 bg-surface/50 border-t border-border md:border md:glass-card md:rounded-xl flex flex-col min-h-[22rem] md:min-h-0 relative ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}
        >
          {/* Drag and Drop Overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl pointer-events-none">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-3 text-blue-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-lg font-bold text-white mb-1">이곳에 드래그 앤 드롭하여</p>
                <p className="text-lg font-bold text-white">파일 업로드</p>
              </div>
            </div>
          )}
          {selectedProfileUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-1/50 overflow-y-auto relative">
              {/* Mobile Back Button */}
              {!isDesktopViewport && (
                <button
                  onClick={() => {
                    setMobileView('list');
                    setSelectedProfileUser(null);
                  }}
                  className="absolute top-4 left-4 btn-ghost px-2 py-1 rounded-md flex items-center gap-1 text-text-sub"
                  aria-label="채팅방 목록으로 돌아가기"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  목록
                </button>
              )}
              
              <div className="glass-panel max-w-md w-full rounded-2xl p-8 flex flex-col items-center shadow-lg">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-3 flex-shrink-0 flex items-center justify-center text-4xl text-text-sub font-bold mb-6 ring-4 ring-primary/20 shadow-inner">
                  {selectedProfileUser.profile_image_url ? (
                    <img 
                      src={selectedProfileUser.profile_image_url.startsWith('http') ? selectedProfileUser.profile_image_url : `/api${selectedProfileUser.profile_image_url}`} 
                      alt={selectedProfileUser.nickname} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    selectedProfileUser.nickname?.[0] || '?'
                  )}
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                  {selectedProfileUser.nickname}
                  {selectedProfileUser.wallet_address && <VerifiedIcon />}
                </h2>
                
                <p className="text-text-sub mb-8 font-medium">@{selectedProfileUser.user_id}</p>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button
                    className="btn-primary w-full py-3 rounded-xl font-bold tracking-wide flex items-center justify-center gap-2"
                    onClick={() => {
                      setSelectedProfileUser(null);
                      void handleOpenOrCreateDmByUser(selectedProfileUser);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    채팅하기
                  </button>
                  <button
                    className="glass-panel w-full py-3 rounded-xl font-bold text-white tracking-wide transition-colors flex items-center justify-center gap-2 hover:bg-surface-2"
                    onClick={() => {
                      setSelectedProfileUser(null);
                      void handleOpenOrCreateDmByUser(selectedProfileUser).then(() => {
                        setTimeout(() => handleStartVoiceCall(), 500);
                      });
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    음성통화하기
                  </button>
                  <button
                    className="glass-panel w-full py-3 rounded-xl font-bold text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all border border-transparent flex items-center justify-center gap-2"
                    onClick={() => {
                      setSelectedReportUser(selectedProfileUser);
                      setIsReportModalOpen(true);
                      setReportReason('');
                      setReportError(null);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    신고하기
                  </button>
                </div>
              </div>

              {isReportModalOpen && selectedReportUser && (
                <div className="absolute inset-0 z-50 backdrop-blur-2xl animate-fade-in flex items-center justify-center p-4 rounded-2xl">
                  <div className="animate-modal-in rounded-2xl p-8 max-w-md w-full shadow-2xl border border-border bg-surface opacity-100">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-3 flex items-center justify-center text-lg font-bold text-text-sub">
                        {selectedReportUser.profile_image_url ? (
                          <img 
                            src={selectedReportUser.profile_image_url.startsWith('http') ? selectedReportUser.profile_image_url : `/api${selectedReportUser.profile_image_url}`} 
                            alt={selectedReportUser.nickname} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          selectedReportUser.nickname?.[0] || '?'
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{selectedReportUser.nickname}</h3>
                        <p className="text-text-sub text-sm">@{selectedReportUser.user_id}</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-white mb-3">신고 사유 (선택사항)</label>
                      <textarea
                        value={reportReason}
                        onChange={(e) => {
                          setReportReason(e.target.value);
                          setReportError(null);
                        }}
                        placeholder="문제가 되는 행동이나 이유를 설명해주세요..."
                        className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        rows={4}
                      />
                    </div>

                    {reportError && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-500 text-sm">{reportError}</p>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        className="btn-secondary px-4 py-2 rounded-lg text-sm font-bold transition-all"
                        onClick={() => {
                          setIsReportModalOpen(false);
                          setReportReason('');
                          setReportError(null);
                          setSelectedReportUser(null);
                        }}
                        disabled={isReporting}
                      >
                        취소
                      </button>
                      <button
                        className="btn-danger px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (!selectedReportUser) return;
                          setIsReporting(true);
                          reportUser(accessToken!, selectedReportUser.user_uuid, reportReason || 'Inappropriate behavior')
                            .then(() => {
                              showToast('신고가 접수되었습니다.');
                              setIsReportModalOpen(false);
                              setReportReason('');
                              setReportError(null);
                              setSelectedReportUser(null);
                            })
                            .catch((e) => {
                              setReportError(e.message || '신고 제출에 실패했습니다.');
                            })
                            .finally(() => {
                              setIsReporting(false);
                            });
                        }}
                        disabled={isReporting}
                      >
                        {isReporting ? '신고 중...' : '신고하기'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-3 md:p-4 border-b border-border relative z-10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => {
                        setMobileView('list');
                        setSelectedConversation(null);
                      }}
                      className="md:hidden btn-ghost px-2 py-1 rounded-md"
                      aria-label="채팅방 목록으로 돌아가기"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {selectedRoom && (
                      <div className="w-7 h-7 rounded-full bg-surface-3 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-text-sub shrink-0">
                        {getRoomAvatarUrl(selectedRoom) ? (
                          <img
                            src={getRoomAvatarUrl(selectedRoom) || undefined}
                            alt={roomName(selectedRoom)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          roomName(selectedRoom)?.[0] || '채'
                        )}
                      </div>
                    )}
                    <span className="font-semibold text-sm truncate">
                      {selectedRoom ? roomName(selectedRoom) : '채팅'}
                    </span>
                    {selectedRoom && getOtherUser(selectedRoom)?.wallet_address && <VerifiedIcon tooltipPlacement="bottom" />}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                  {selectedRoom?.room_type === 'team' && (
                    <button
                      type="button"
                      onClick={() => setIsRoomMembersPopupOpen(true)}
                      className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                      aria-label="현재 채팅방 참여자 보기"
                      title="현재 채팅방 참여자 보기"
                    >
                      <svg className="w-5 h-5 text-text-hint hover:text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 21v-2a4 4 0 00-3-3.87" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                    </button>
                  )}
                  {selectedRoom && (
                    <button
                      onClick={() => void openInviteModal('invite-into-room')}
                      className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                      aria-label="현재 대화방에 사용자 초대"
                      title="현재 대화방에 사용자 초대"
                    >
                      <svg className="w-5 h-5 text-text-hint hover:text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSearchOpen(!searchOpen);
                      if (searchOpen) setSearchQuery('');
                    }}
                    className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                    aria-label="메시지 검색"
                    title="메시지 검색"
                  >
                    <svg className="w-5 h-5 text-text-hint hover:text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (incomingCallState) {
                        return;
                      }

                      if (isInCall || isCallConnecting) {
                        handleEndVoiceCall();
                        return;
                      }

                      void handleStartVoiceCall();
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${isInCall || isCallConnecting ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-surface-2'} ${incomingCallState ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-label={isInCall || isCallConnecting ? '음성 통화 종료' : '음성 통화 시작'}
                    title={isInCall || isCallConnecting ? '음성 통화 종료' : '음성 통화 시작'}
                    disabled={!!incomingCallState}
                  >
                    {isInCall || isCallConnecting ? (
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.68 13.31a16 16 0 002.72 2.72a1 1 0 001.09-.16l2.2-2.2a1 1 0 011.14-.2a12.14 12.14 0 003.48.54a1 1 0 011 1V19a1 1 0 01-1 1A19 19 0 014 3a1 1 0 011-1h3.5a1 1 0 011 1a12.14 12.14 0 00.54 3.48a1 1 0 01-.2 1.14l-2.2 2.2a1 1 0 00-.16 1.09" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L2 22" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-text-hint hover:text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.25C3 4.56 3.56 4 4.25 4h2.12a1.5 1.5 0 011.47 1.21l.6 2.86a1.5 1.5 0 01-.4 1.35l-1.03 1.03a14 14 0 006.03 6.03l1.03-1.03a1.5 1.5 0 011.35-.4l2.86.6A1.5 1.5 0 0120 17.13v2.12c0 .69-.56 1.25-1.25 1.25h-.5C10.94 20.5 3.5 13.06 3.5 3.75v-.5z" />
                      </svg>
                    )}
                  </button>
                </div>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ${isVoiceCallOverlayVisible ? 'max-h-80 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}
                  aria-hidden={!isVoiceCallOverlayVisible}
                >
                  <div className="w-full rounded-2xl border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-text-sub min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isInCall ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="truncate">{callStatusLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleToggleMicrophone}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isMicMuted ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' : 'bg-surface-2 border-border text-text hover:bg-surface-3'}`}
                          title={isMicMuted ? '마이크 켜기' : '마이크 끄기'}
                          aria-label={isMicMuted ? '마이크 켜기' : '마이크 끄기'}
                        >
                          {isMicMuted ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9v2a3 3 0 004.74 2.43" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v1a7 7 0 01-1.6 4.5" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v1a7 7 0 0011.22 5.62" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.73 10.73A3 3 0 0015 9V5a3 3 0 00-5.66-1.4" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v3" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v1a7 7 0 01-14 0v-1" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18v4" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleToggleHeadset}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isHeadsetMuted ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' : 'bg-surface-2 border-border text-text hover:bg-surface-3'}`}
                          title={isHeadsetMuted ? '상대 음성 듣기 켜기' : '상대 음성 듣기 끄기'}
                          aria-label={isHeadsetMuted ? '상대 음성 듣기 켜기' : '상대 음성 듣기 끄기'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 13a8 8 0 0116 0v4a2 2 0 01-2 2h-2v-6h3" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 13v6H6a2 2 0 002-2v-4H4z" />
                            {isHeadsetMuted && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5l14 14" />}
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 overflow-x-auto pt-4 pb-2">
                      {getCallParticipants().map((participant) => {
                        const speaker = callSpeakerState[participant.userUuid];
                        const isSpeaking = !!speaker?.active;
                        const level = speaker?.level || 0;
                        const glowOpacity = isSpeaking ? Math.min(0.5, 0.16 + level * 0.3) : 0;

                        return (
                          <div key={participant.userUuid} className="w-20 shrink-0 flex flex-col items-center text-center">
                            <div className="relative">
                              {isSpeaking && (
                                <span
                                  className="absolute inset-0 rounded-full bg-emerald-400 blur-md transition-opacity duration-200"
                                  style={{ opacity: glowOpacity }}
                                />
                              )}
                              <div
                                className="relative w-14 h-14 rounded-full overflow-hidden border border-white/20 bg-surface-3 transition-all duration-200"
                                style={{
                                  filter: isSpeaking ? 'brightness(1.12) saturate(1.08)' : 'brightness(0.45) saturate(0.75)',
                                  transform: isSpeaking ? 'scale(1.03)' : 'scale(1)',
                                }}
                              >
                                {participant.avatarUrl ? (
                                  <img
                                    src={participant.avatarUrl}
                                    alt={participant.nickname}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-text-sub">
                                    {participant.nickname?.[0] || '?'}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`mt-1 text-[11px] truncate w-full ${isSpeaking ? 'text-emerald-500 font-semibold' : 'text-text-sub'}`}>
                              {participant.nickname}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {isRoomMembersPopupOpen && selectedRoom?.room_type === 'team' && (
                <div className="absolute inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="채팅방 참여자 목록">
                  <button
                    type="button"
                    className={popupBackdropClass}
                    onClick={() => setIsRoomMembersPopupOpen(false)}
                    aria-label="참여자 목록 닫기"
                  />
                  <div className={popupCardClass}>
                    <h3 className="text-base font-semibold mb-4">대화 참여자</h3>

                    <div className="mb-4 shrink-0">
                      <label className="block text-xs text-text-hint mb-2">대화방 사진</label>
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-surface-3 overflow-hidden flex items-center justify-center text-text-sub font-semibold text-lg shrink-0">
                          {selectedRoom?.room_image_url ? (
                            <img
                              src={toChatAssetUrl(selectedRoom.room_image_url) || undefined}
                              alt="Room"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (selectedRoom?.room_name?.[0] || '팀')
                          )}
                        </div>

                        <input
                          ref={roomImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleUpdateRoomImage(e)}
                        />
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 rounded-md text-sm disabled:opacity-50"
                          onClick={() => roomImageInputRef.current?.click()}
                          disabled={isUpdatingRoomImage}
                        >
                          {isUpdatingRoomImage ? '업로드 중...' : '사진 변경'}
                        </button>
                      </div>
                      {roomImageError && <div className="mt-2 text-xs text-red-500">{roomImageError}</div>}
                    </div>

                    <div className="mb-4 shrink-0">
                      <label className="block text-xs text-text-hint mb-2">대화방 이름</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={roomNameDraft}
                          onChange={(e) => {
                            setRoomNameDraft(e.target.value);
                            if (roomNameError) setRoomNameError(null);
                          }}
                          className={popupInlineInputClass}
                          placeholder="대화방 이름 입력"
                          disabled={isUpdatingRoomName}
                        />
                        <button
                          type="button"
                          className="btn-primary px-3 py-2 rounded-md text-sm shrink-0 disabled:opacity-50"
                          onClick={() => void handleUpdateRoomName()}
                          disabled={isUpdatingRoomName}
                        >
                          {isUpdatingRoomName ? '변경 중...' : '변경'}
                        </button>
                      </div>
                      {roomNameError && <div className="mt-2 text-xs text-red-500">{roomNameError}</div>}
                    </div>

                    <div className={popupListClass}>
                      {currentRoomMembers.map((member) => (
                        <div key={`${member.user_uuid}-${member.user_id}`} className={`flex items-center justify-between gap-3 w-full p-2 rounded-lg transition-colors ${popupRowHoverClass}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-semibold truncate">
                                {member.isMe ? `${member.nickname} (나)` : member.nickname}
                              </span>
                              {member.wallet_address && <VerifiedIcon tooltipPlacement="bottom" />}
                            </div>
                            <div className="text-xs text-text-hint truncate">@{member.user_id}</div>
                          </div>
                        </div>
                      ))}
                      {currentRoomMembers.length === 0 && (
                        <div className="text-center text-sm text-text-hint py-4">표시할 참여자 정보가 없습니다.</div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end shrink-0 pt-2">
                      <button
                        className="btn-secondary px-4 py-2 rounded-md text-sm"
                        onClick={() => setIsRoomMembersPopupOpen(false)}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isInviteModalOpen && inviteModalMode === 'invite-into-room' && (
                <div className="absolute inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="현재 대화방 사용자 초대">
                  <button
                    type="button"
                    className={popupBackdropClass}
                    onClick={() => setIsInviteModalOpen(false)}
                    aria-label="초대 팝업 닫기"
                  />
                  {inviteModalBody}
                </div>
              )}

              {incomingCallState && (
                <div className="px-3 md:px-4 py-3 border-b border-border bg-emerald-500/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{getIncomingCallerDisplayName()}님이 음성 통화를 요청했습니다.</p>
                    <p className="text-xs text-text-sub">수락을 누르면 마이크로 연결됩니다.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleRejectIncomingCall}
                      className="text-xs px-3 py-1.5 rounded-md bg-surface-3 text-text hover:bg-surface-2 transition-colors"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => void handleAcceptIncomingCall()}
                      className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      수락
                    </button>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              {searchOpen && (
                <div className="px-3 md:px-4 py-2 border-b border-border">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchOpen(false);
                        setSearchQuery('');
                      }
                    }}
                    placeholder="메시지 검색..."
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {searchQuery && (
                    <div className="text-xs text-text-hint mt-1">
                      검색 결과: {filteredMessages.length}개
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="relative flex-1 min-h-0">
                <div
                  ref={messageViewportRef}
                  onScroll={handleMessageScroll}
                  onDragEnter={handleMessageAreaDragEnter}
                  onDragOver={handleMessageAreaDragOver}
                  onDragLeave={handleMessageAreaDragLeave}
                  onDrop={handleMessageAreaDrop}
                  className={`h-full p-3 md:p-4 overflow-y-auto flex flex-col ${messageStyle === 'irc' ? 'gap-0' : 'gap-3'}`}
                >
                  {searchQuery && filteredMessages.length === 0 && (
                    <div className="text-center py-8 text-text-hint text-sm">검색 결과가 없습니다</div>
                  )}
                  {filteredMessages.map((msg, index) => {
                    const isMe = msg.sender_uuid === user?.user_uuid;
                    const isDeleted = msg.is_deleted || msg.message_type === 'deleted';
                    const menuVisible = hoveredMessageId === msg.message_id || actionMenuState?.messageId === msg.message_id;
                    const isReplyingTarget = replyingMessage?.message_id === msg.message_id;
                    const isImageFile = !isDeleted && msg.message_type === 'file' && (msg.mime_type?.startsWith('image/') || msg.file_name?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i));
                    const isPreviousSameSender = index > 0 && filteredMessages[index - 1].sender_uuid === msg.sender_uuid;
                    const showUnreadCount = (msg.unread_member_count || 0) > 0 && (isMe || selectedRoom?.room_type === 'team');

                    if (messageStyle === 'irc') {
                      const senderName = getSenderDisplayName(msg);
                      const senderAvatarUrl = getSenderAvatarUrl(msg);

                      return (
                        <div
                          key={msg.message_id}
                          id={`message-${msg.message_id}`}
                          onMouseEnter={() => setHoveredMessageId(msg.message_id)}
                          onMouseLeave={() => setHoveredMessageId((prev) => (prev === msg.message_id ? null : prev))}
                          onTouchStart={(e) => handleMessageTouchStart(e, msg.message_id)}
                          onTouchEnd={() => handleMessageTouchEnd(msg.message_id)}
                          onTouchMove={handleMessageTouchMove}
                          className={`group flex w-full gap-3 rounded-lg px-2 py-0 ${!isPreviousSameSender && index > 0 ? 'mt-2' : ''} ${blinkingMessageId === msg.message_id ? 'animate-blink' : ''} ${isReplyingTarget ? 'bg-yellow-100/50 dark:bg-yellow-900/30' : 'hover:bg-surface-2/50'
                            }`}
                        >
                          {isPreviousSameSender ? (
                            <div className="w-10 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-surface-3 shrink-0 overflow-hidden flex items-center justify-center text-text-sub font-bold text-sm select-none">
                              {senderAvatarUrl ? (
                                <img
                                  src={senderAvatarUrl}
                                  alt={senderName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement?.querySelector('.sender-fallback-initial')?.classList.remove('hidden');
                                    e.currentTarget.parentElement?.querySelector('.sender-fallback-initial')?.classList.add('flex');
                                  }}
                                />
                              ) : null}
                              <span className={`sender-fallback-initial w-full h-full items-center justify-center bg-surface-3 text-text-sub font-bold ${senderAvatarUrl ? 'hidden' : 'flex'}`}>
                                {senderName?.[0] || '?'}
                              </span>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {!isPreviousSameSender && (
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[15px] font-semibold truncate ${isMe ? 'text-blue-500 dark:text-blue-400' : 'text-text'}`}>
                                  {senderName}
                                </span>
                                {isWalletVerifiedUser(msg.sender_uuid) && <VerifiedIcon tooltipPlacement="bottom" />}
                                <span className="text-[11px] text-text-hint shrink-0">{formatMessageTime(msg.created_at)}</span>
                                {msg.is_edited && <span className="text-[10px] text-text-hint shrink-0">수정됨</span>}
                              </div>
                            )}

                            <div className={`flex items-center justify-between ${isPreviousSameSender ? 'gap-2' : 'gap-2'}`}>
                              <div className="flex-1 min-w-0 text-[15px] leading-6 text-text whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                {renderReplyPreview(msg, isMe, 'irc')}
                                {renderMessageMainContent(msg, isMe, isDeleted, 'irc')}
                                {renderMessageReactions(msg, 'left')}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isPreviousSameSender && (
                                  <span
                                    className={`text-[10px] text-text-hint whitespace-nowrap transition-opacity ${menuVisible
                                      ? 'opacity-100'
                                      : 'opacity-0 pointer-events-none group-hover:opacity-100'
                                      }`}
                                  >
                                    {formatMessageTime(msg.created_at)}
                                  </span>
                                )}
                                {showUnreadCount && (
                                  <span className="text-[10px] font-semibold text-amber-500">{msg.unread_member_count}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenDesktopActionMenu(e, msg.message_id)}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-text-hint hover:text-text hover:bg-surface-2 text-lg transition-colors transition-opacity shrink-0 ${menuVisible
                                    ? 'opacity-100 pointer-events-auto'
                                    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                                    }`}
                                  aria-label="메시지 액션 열기"
                                >
                                  ⋯
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.message_id}
                        id={`message-${msg.message_id}`}
                        onMouseEnter={() => setHoveredMessageId(msg.message_id)}
                        onMouseLeave={() => setHoveredMessageId((prev) => (prev === msg.message_id ? null : prev))}
                        onTouchStart={(e) => handleMessageTouchStart(e, msg.message_id)}
                        onTouchEnd={() => handleMessageTouchEnd(msg.message_id)}
                        onTouchMove={handleMessageTouchMove}
                        className={`flex w-full mb-1 items-end ${isMe ? 'justify-end pl-10' : 'justify-start pr-10'
                          } ${blinkingMessageId === msg.message_id ? 'animate-blink' : ''} ${isReplyingTarget ? 'bg-yellow-100/50 dark:bg-yellow-900/30 rounded-lg px-1 py-1 -mx-1' : ''
                          }`}
                      >
                        {/* 내가 보낸 메시지의 시간 및 읽음표시 */}
                        {isMe && (
                          <div className="relative shrink-0 flex flex-col items-end justify-end text-[10px] leading-tight mr-1.5 pb-[2px]">
                            {menuVisible && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenDesktopActionMenu(e, msg.message_id)}
                                className="absolute -top-6 right-0 w-7 h-7 rounded-full flex items-center justify-center text-text-hint hover:text-text hover:bg-surface-2 text-lg transition-colors"
                                aria-label="메시지 액션 열기"
                              >
                                ⋯
                              </button>
                            )}
                            {showUnreadCount && (
                              <span className="font-semibold text-amber-500 mb-[2px]">
                                {msg.unread_member_count}
                              </span>
                            )}
                            <span className="text-text-hint">{formatMessageTime(msg.created_at)}</span>
                            {msg.is_edited && <span className="text-text-hint text-[8px]">수정됨</span>}
                          </div>
                        )}

                        {/* 메시지 내용 (말풍선) */}
                        {(() => {
                          return (
                            <div
                              className={`relative leading-relaxed whitespace-pre-wrap min-w-[2rem] max-w-full ${isImageFile
                                  ? 'bg-transparent text-left'
                                  : `px-4 py-2.5 rounded-2xl shadow-sm ${isMe
                                    ? 'bg-blue-500 text-white rounded-br-sm text-left'
                                    : isLightTheme
                                      ? 'bg-[#F7F7F8] text-black rounded-bl-sm text-left border border-[#E3E3E6]'
                                      : 'bg-[#2C2C2E] text-gray-200 rounded-bl-sm text-left border border-gray-700'
                                  }`
                                }`}
                              // break-word를 CSS로 강제 적용하여 아주 긴 영문/숫자가 영역을 뚫지 못하게 합니다.
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {!isMe && (
                                <div className="mb-1 flex items-center gap-1.5 min-w-0">
                                  <span className="text-[12px] font-semibold text-text truncate">
                                    {getSenderDisplayName(msg)}
                                  </span>
                                  {isWalletVerifiedUser(msg.sender_uuid) && <VerifiedIcon tooltipPlacement="bottom" />}
                                </div>
                              )}
                              {renderReplyPreview(msg, isMe, 'bubble')}

                              {/* 말풍선 꼬리 (이미지가 아닐 때만 표시) */}
                              {!isImageFile && isMe && (
                                <svg
                                  className="absolute bottom-0 -right-2 w-3 h-4 text-blue-500"
                                  viewBox="0 0 12 16"
                                  fill="currentColor"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path d="M0 16C5 16 12 12 12 0C12 8 8 16 0 16Z" />
                                </svg>
                              )}
                              {!isImageFile && !isMe && (
                                <svg
                                  className={`absolute bottom-0 -left-2 w-3 h-4 ${isLightTheme ? 'text-[#F7F7F8]' : 'text-[#2C2C2E]'
                                    }`}
                                  viewBox="0 0 12 16"
                                  fill="currentColor"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path d="M12 16C7 16 0 12 0 0C0 8 4 16 12 16Z" />
                                </svg>
                              )}
                              {renderMessageMainContent(msg, isMe, isDeleted, 'bubble')}
                              {renderMessageReactions(msg, isMe ? 'right' : 'left')}
                            </div>
                          );
                        })()}

                        {/* 상대가 보낸 메시지의 시간 */}
                        {!isMe && (
                          <div className="relative shrink-0 flex flex-col justify-end text-[10px] leading-tight ml-1.5 pb-[2px] text-text-hint">
                            {menuVisible && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenDesktopActionMenu(e, msg.message_id)}
                                className="absolute -top-6 left-0 w-7 h-7 rounded-full flex items-center justify-center text-text-hint hover:text-text hover:bg-surface-2 text-lg transition-colors"
                                aria-label="메시지 액션 열기"
                              >
                                ⋯
                              </button>
                            )}
                            <div className="flex flex-col items-start">
                              {showUnreadCount && (
                                <span className="font-semibold text-amber-500 mb-[2px]">
                                  {msg.unread_member_count}
                                </span>
                              )}
                              <span>{formatMessageTime(msg.created_at)}</span>
                              {msg.is_edited && <span className="text-[8px]">수정됨</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {actionMenuState && (() => {
                  const activeMessage = messages.find((m) => m.message_id === actionMenuState.messageId) || null;
                  const canDelete = !!activeMessage
                    && activeMessage.sender_uuid === user?.user_uuid
                    && !activeMessage.is_deleted
                    && activeMessage.message_type !== 'deleted';
                  const canReact = !!activeMessage
                    && !activeMessage.is_deleted
                    && activeMessage.message_type !== 'deleted';
                  const hasFile = !!activeMessage && (!!activeMessage.file_url || !!activeMessage.saved_filename);

                  if (!activeMessage) {
                    return null;
                  }

                  return (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={closeActionMenu}
                      role="presentation"
                      style={{
                        animation: 'fadeIn 0.15s ease-out',
                      }}
                    >
                      <style>{`
                        @keyframes fadeIn {
                          from { opacity: 0; }
                          to { opacity: 1; }
                        }
                        @keyframes popIn {
                          from { opacity: 0; transform: scale(0.95); }
                          to { opacity: 1; transform: scale(1); }
                        }
                        @keyframes slideUp {
                          from { opacity: 0; transform: translateY(10px); }
                          to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes slideOut {
                          from { opacity: 1; transform: translateY(0); }
                          to { opacity: 0; transform: translateY(10px); }
                        }
                      `}</style>
                      <div className="absolute inset-0 z-50 flex items-center justify-center">
                        <div
                          className="w-56 rounded-lg border border-border bg-surface shadow-2xl py-2"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          }}
                        >
                          {searchQuery ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  closeActionMenu();
                                  requestAnimationFrame(() => {
                                    scrollToMessage(activeMessage.message_id);
                                  });
                                }}
                                className="w-full text-left px-4 py-3 text-base hover:bg-surface-2 transition-colors"
                              >
                                메시지로 이동
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={hasFile}
                                onClick={() => void handleCopyMessage(activeMessage)}
                                className="w-full text-left px-4 py-3 text-base hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                복사
                              </button>
                              <button
                                type="button"
                                onClick={() => startReplyMessage(activeMessage)}
                                className="w-full text-left px-4 py-3 text-base hover:bg-surface-2 transition-colors"
                              >
                                답장
                              </button>
                              <button
                                type="button"
                                disabled={!canReact}
                                onClick={() => void handleAddReaction(activeMessage)}
                                className="w-full text-left px-4 py-3 text-base hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                반응
                              </button>
                              <button
                                type="button"
                                disabled={!canDelete || hasFile}
                                onClick={() => {
                                  if (activeMessage && activeMessage.sender_uuid === user?.user_uuid) {
                                    startEditMessage(activeMessage);
                                  }
                                }}
                                className="w-full text-left px-4 py-3 text-base hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                disabled={!canDelete}
                                onClick={() => void handleDeleteMessage(activeMessage)}
                                className="w-full text-left px-4 py-3 text-base text-red-500 hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {reactionPickerMessage && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={closeReactionPicker}
                    role="presentation"
                  >
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 z-50 flex items-center justify-center px-4">
                      <div
                        className="w-full max-w-xs rounded-2xl border border-border bg-surface shadow-2xl p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-sm font-semibold mb-2">반응 선택</div>
                        <div className="grid grid-cols-6 gap-2">
                          {reactionOptions.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => void handleSelectReaction(emoji)}
                              className="h-11 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors text-2xl flex items-center justify-center"
                              title={`반응 ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reactionViewerState && (
                  <div 
                    className={`fixed inset-0 z-50 ${(isDesktopViewport || reactionViewerState.interactionMode === 'hover') ? 'pointer-events-none' : 'pointer-events-auto'}`}
                    role="presentation"
                    onClick={(e) => {
                      if (!isDesktopViewport && reactionViewerState.interactionMode === 'touch') {
                        e.stopPropagation();
                        setReactionViewerState(null);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (!isDesktopViewport && reactionViewerState.interactionMode === 'touch') {
                        e.stopPropagation();
                        setReactionViewerState(null);
                      }
                    }}
                  >
                    <div
                      className="absolute w-[14rem] max-w-[70vw] rounded-xl border border-border bg-surface shadow-2xl p-2"
                      style={{
                        left: reactionViewerState.x,
                        top: reactionViewerState.y,
                        transform: 'translate(-50%, -100%)',
                      }}
                    >
                      <div className="text-xs font-semibold text-text mb-1">
                        {reactionViewerState.emoji} 반응 {reactionViewerState.users.length}명
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-text-sub">
                        {reactionViewerState.users.map((userUuid) => (
                          <div key={`${reactionViewerState.messageId}-${reactionViewerState.emoji}-${userUuid}`} className="truncate">
                            {getReactionUserDisplayName(userUuid)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {showNewMessageNotice && (
                  <button
                    onClick={() => scrollMessagesToBottom('smooth')}
                    className="absolute right-3 bottom-3 btn-primary px-3 py-2 rounded-full text-xs shadow-lg flex items-center gap-1.5"
                  >
                    <span aria-hidden="true">●</span>
                    <span>새 메시지</span>
                  </button>
                )}
              </div>

              {/* Input */}
              <div
                className="p-3 border-t border-border bg-surface transition-all"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {editingMessageId && (
                  <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between border border-blue-200 dark:border-blue-800/30">
                    <span className="text-xs text-text font-medium">메시지 수정 중</span>
                    <button
                      type="button"
                      onClick={cancelEditMessage}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                      title="수정 취소"
                    >
                      <svg className="w-4 h-4 text-text-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                {replyingMessage && (
                  <div className="mb-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-between border-l-4 border-purple-500">
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 truncate">
                        {replyingMessage.sender_uuid === user?.user_uuid ? '나' : (chatUsers.find((u) => u.user_uuid === replyingMessage.sender_uuid)?.nickname || '알 수 없음')}에게 답장 중
                      </span>
                      <span className="text-xs text-text-hint truncate">
                        {replyingMessage.is_deleted ? '삭제된 메시지' : (replyingMessage.text || (replyingMessage.message_type === 'file' ? '파일' : '메시지'))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={cancelReplyMessage}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                      title="답장 취소"
                    >
                      <svg className="w-4 h-4 text-text-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                {isUploading && (
                  <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text font-medium">파일 업로드 중</span>
                      <span className="text-xs text-text-hint">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 rounded-full text-text-hint hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-50"
                    title="파일 첨부"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>

                  <input
                    ref={messageInputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onCompositionStart={() => setIsComposingMessage(true)}
                    onCompositionEnd={() => setIsComposingMessage(false)}
                    onKeyDown={handleMessageInputKeyDown}
                    placeholder={isUploading ? "파일 업로드 중..." : "메시지를 입력하세요..."}
                    readOnly={isUploading}
                    className="glass-input flex-1 py-2.5 px-4 rounded-full text-sm"
                  />
                  <button
                    onClick={handleSend}
                    className="btn-primary px-5 py-2.5 rounded-full text-sm cursor-pointer"
                  >
                    {editingMessageId ? '수정' : '전송'}
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
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setViewingImage(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img
            src={viewingImage}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            alt="Full size preview"
            onClick={(e) => e.stopPropagation()}
            loading="lazy"
          />
        </div>
      )}
      {isInviteModalOpen && inviteModalMode === 'create-team-room' && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm ${isLightTheme ? 'bg-slate-900/35' : 'bg-black/70'}`} role="dialog" aria-modal="true" aria-label="단체 채팅방 만들기">
          {inviteModalBody}
        </div>
      )}
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[110] px-4 py-3 text-sm rounded-lg bg-black/90 text-white shadow-lg"
          style={{
            animation: toastMessage ? 'slideUp 0.2s ease-out forwards' : 'slideOut 0.2s ease-out forwards',
            transform: 'translateX(-50%)',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;

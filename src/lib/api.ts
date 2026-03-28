const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const CHAT_API_BASE = import.meta.env.VITE_CHAT_API_BASE || '/chat-api';

function translateError(message: string): string {
  const errorMap: Record<string, string> = {
    'User not found': '사용자를 찾을 수 없습니다',
    'Invalid credentials': '아이디 또는 비밀번호가 잘못되었습니다',
    'Invalid user_id or password': '아이디 또는 비밀번호가 잘못되었습니다',
    'User ID already exists': '이미 사용 중인 아이디입니다',
    'User already exists': '이미 가입된 사용자입니다',
    'Password is required': '비밀번호를 입력해주세요',
    'User ID is required': '아이디를 입력해주세요',
    'Nickname is required': '닉네임을 입력해주세요',
    'Invalid token': '유효하지 않은 토큰입니다',
    'Token expired': '토큰이 만료되었습니다',
    'Refresh token not found': '새로고침 토큰을 찾을 수 없습니다',
    'Unauthorized': '인증이 필요합니다',
    'Forbidden': '접근 권한이 없습니다',
    'Not found': '찾을 수 없습니다',
    'Conflict': '이미 존재하는 정보입니다',
    'Too many requests': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
    'Internal server error': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
    'Bad request': '요청이 잘못되었습니다',
    'Wallet already connected': '이미 연결된 지갑입니다',
    'Invalid signature': '서명이 유효하지 않습니다',
    'Nonce mismatch': 'Nonce가 일치하지 않습니다',
    'No account linked to this wallet': '이 지갑에 연결된 계정이 없습니다',
    'Invalid or expired nonce': 'Nonce가 유효하지 않거나 만료되었습니다',
    '사용할 수 없는 문자열이 포함되어 있습니다': '아이디는 영문, 숫자, 언더스코어, 하이픈만 사용 가능하며 3-32자여야 합니다',
  };

  return errorMap[message] || message;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = translateError(body.error || `Request failed: ${res.status}`);
    const err = new Error(errorMessage);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

async function chatRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${CHAT_API_BASE}${path}`;
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('채팅 서버에 연결할 수 없습니다. 서버 주소/포트와 실행 상태를 확인해주세요.');
  }

  if (!res.ok) {
    const body = await res.json().catch(async () => {
      const text = await res.text().catch(() => '');
      if (/^\s*<!doctype html>/i.test(text)) {
        return {
          detail: '채팅 API 경로가 프론트 HTML로 라우팅되고 있습니다. VITE_CHAT_API_BASE 또는 프록시 설정을 확인해주세요.',
        };
      }
      return { detail: text || 'Unknown error' };
    });
    const raw = body.detail || body.error || `Request failed: ${res.status}`;
    const normalizedRaw = typeof raw === 'string' ? raw : JSON.stringify(raw);

    if (
      res.status >= 500
      && /ECONNREFUSED|proxy error|connect to server|connect ECONNREFUSED/i.test(normalizedRaw)
    ) {
      throw new Error('채팅 서버에 연결할 수 없습니다. 백엔드가 실행 중인지, VITE_CHAT_API_TARGET 설정이 맞는지 확인해주세요.');
    }

    const errorMessage = translateError(raw);
    const err = new Error(errorMessage);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/* SHA-256 hash for client-side password preprocessing */
async function sha256(message: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(message));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ====== Auth ====== */

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  otp_required?: boolean;
}

export interface RegisterResponse {
  message: string;
  user_uuid: string;
}

export async function register(
  user_id: string,
  nickname: string,
  password: string,
  wallet_address?: string,
): Promise<RegisterResponse> {
  const hashed = await sha256(password);
  return request('/user/register', {
    method: 'POST',
    body: JSON.stringify({
      user_id,
      nickname,
      password: hashed,
      ...(wallet_address ? { wallet_address } : {}),
    }),
  });
}

export async function login(
  user_id: string,
  password: string,
  otp_code?: string,
): Promise<TokenResponse> {
  const hashed = await sha256(password);
  return request('/user/login', {
    method: 'POST',
    body: JSON.stringify({ user_id, password: hashed, ...(otp_code ? { otp_code } : {}) }),
  });
}

export async function refreshToken(
  refresh_token: string,
): Promise<TokenResponse> {
  return request('/user/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

/* ====== User ====== */

export interface UserProfile {
  user_uuid: string;
  user_id: string;
  nickname: string;
  wallet_address: string | null;
  profile_image_url?: string;
  otp_enabled?: boolean;
  created_at: number;
}

export interface OtpStatusResponse {
  otp_enabled: boolean;
  otp_pending: boolean;
}

export interface OtpSetupResponse {
  secret: string;
  otpauth_url: string;
  qr_code_data_url: string;
}

export async function getMe(token: string): Promise<UserProfile> {
  return request('/user/me', {
    headers: authHeaders(token),
  });
}

export async function updateMe(
  token: string,
  data: { nickname?: string; password?: string },
): Promise<{ message: string }> {
  const body: Record<string, string> = {};
  if (data.nickname) body.nickname = data.nickname;
  if (data.password) body.password = await sha256(data.password);
  return request('/user/me', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function uploadProfileImage(token: string, file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append('profile_image', file);
  return request('/user/me/profile-image', {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
}

export async function deleteMe(
  token: string,
): Promise<{ message: string }> {
  return request('/user/me', {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

/* ====== Wallet ====== */

export interface NonceResponse {
  nonce: string;
  message: string;
}

export async function walletConnectRequest(
  wallet_address: string,
): Promise<NonceResponse> {
  return request('/wallets/connect/request', {
    method: 'POST',
    body: JSON.stringify({ wallet_address }),
  });
}

export async function walletConnectConfirm(
  token: string,
  wallet_address: string,
  signature: string,
  nonce: string,
  message?: string,
  signature_encoding?: 'base58' | 'base64' | 'hex',
): Promise<{ message: string }> {
  const body: Record<string, string> = { wallet_address, signature, nonce };
  if (message) body.message = message;
  if (signature_encoding) body.signature_encoding = signature_encoding;
  return request('/wallets/connect/confirm', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function walletLogin(
  wallet_address: string,
  signature: string,
  nonce: string,
  message?: string,
  signature_encoding?: 'base58' | 'base64' | 'hex',
  otp_code?: string,
): Promise<TokenResponse> {
  const body: Record<string, string> = { wallet_address, signature, nonce };
  if (message) body.message = message;
  if (signature_encoding) body.signature_encoding = signature_encoding;
  if (otp_code) body.otp_code = otp_code;

  return request('/wallets/login/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function walletDisconnect(
  token: string,
): Promise<void> {
  await request('/wallets', {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export async function getOtpStatus(token: string): Promise<OtpStatusResponse> {
  return request('/user/me/otp/status', {
    headers: authHeaders(token),
  });
}

export async function setupOtp(token: string): Promise<OtpSetupResponse> {
  return request('/user/me/otp/setup', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function enableOtp(token: string, code: string): Promise<{ message: string }> {
  return request('/user/me/otp/enable', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  });
}

export async function disableOtp(token: string, code: string): Promise<{ message: string }> {
  return request('/user/me/otp/disable', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  });
}

/* ====== Projects ====== */

export interface Project {
  project_uuid: string;
  owner_user_uuid: string;
  name: string;
  category: string | null;
  budget: number | null;
  deadline: number | null;
  team_requirements: string | null;
  detailed_description: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface TeamingMatchCandidate {
  accountId: string;
  accountType: string;
  abilityText: string;
  similarity: number;
  score: number;
  linkedAssetId?: string | null;
}

export interface TeamingMatchResult {
  taskId: string;
  requiredAbility: string;
  candidates: TeamingMatchCandidate[];
}

export async function suggestProjectMatches(
  token: string,
  data: {
    request: string;
    requiredDate?: number;
    requiredElo?: number;
    requiredCost?: number;
    requireHuman?: boolean;
    maxCost?: number;
  },
): Promise<{ matches: TeamingMatchResult[] }> {
  return request('/projects/match/suggest', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function createProject(
  token: string,
  data: {
    name: string;
    category?: string | null;
    budget?: number | null;
    deadline?: number | null;
    team_requirements?: string | null;
    detailed_description?: string | null;
  },
): Promise<{ message: string; project: Project }> {
  return request('/projects', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function listProjects(token: string): Promise<{ projects: Project[] }> {
  return request('/projects', {
    headers: authHeaders(token),
  });
}

export async function getProject(token: string, project_uuid: string): Promise<Project> {
  return request(`/projects/${project_uuid}`, {
    headers: authHeaders(token),
  });
}

export async function updateProject(
  token: string,
  project_uuid: string,
  data: {
    name?: string;
    category?: string | null;
    budget?: number | null;
    deadline?: number | null;
    team_requirements?: string | null;
    detailed_description?: string | null;
  },
): Promise<{ message: string; project: Project }> {
  return request(`/projects/${project_uuid}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function deleteProject(token: string, project_uuid: string): Promise<void> {
  await request(`/projects/${project_uuid}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

/* ====== Health ====== */

export async function healthCheck(): Promise<{ status: string }> {
  return request('/health');
}

/* ====== Chat ====== */

export interface ChatRoom {
  room_id: string;
  room_type: 'dm' | 'team';
  room_name: string;
  members: string[];
  created_at: string;
  created_by: string;
  unread_count?: number;
  last_message_time?: string | null;
  last_message?: {
    message_id: string;
    text: string;
    message_type: string;
    sender_uuid: string;
    seq: number;
  } | null;
}

export interface ChatUser {
  user_uuid: string;
  user_id: string;
  nickname: string;
  profile_image_url?: string;
  wallet_address?: string;
}

export interface ChatMessage {
  message_id: string;
  room_id: string;
  seq: number;
  sender_uuid: string;
  text: string;
  message_type: string;
  is_deleted: boolean;
  is_edited?: boolean;
  file_name?: string | null;
  saved_filename?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  created_at: string;
  edited_at?: string;
  unread_member_count?: number;
  reactions?: Record<string, string[]>;
  parent_id?: string | null;
  parent_message?: {
    message_id: string;
    text: string;
    sender_uuid: string;
    sender_name: string;
    is_deleted: boolean;
  } | null;
}

export async function listMyChatRooms(token: string): Promise<ChatRoom[]> {
  return chatRequest('/users/me/rooms', token);
}

export async function uploadRoomFile(
  token: string,
  roomId: string,
  file: File,
  optimize: boolean = true
): Promise<{ message: string; message_data: ChatMessage }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // optimize is a query param
    const path = `/rooms/${roomId}/files?optimize=${optimize}`;

    return await chatRequest(path, token, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
}

export async function listChatUsers(token: string): Promise<ChatUser[]> {
  return chatRequest('/users', token);
}

export async function createDmRoom(
  token: string,
  target_user_uuid: string,
  room_name: string,
): Promise<ChatRoom> {
  return chatRequest('/dm/rooms', token, {
    method: 'POST',
    body: JSON.stringify({ target_user_uuid, room_name }),
  });
}

export async function listRoomMessages(
  token: string,
  roomId: string,
  params?: { limit?: number; before?: string; after?: string }
): Promise<ChatMessage[]> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.before) query.set('before', params.before);
  if (params?.after) query.set('after', params.after);

  const qs = query.toString();
  const path = qs ? `/rooms/${roomId}/messages?${qs}` : `/rooms/${roomId}/messages`;
  return chatRequest(path, token);
}

export async function sendRoomMessage(token: string, roomId: string, text: string, parentId?: string): Promise<ChatMessage> {
  return chatRequest(`/rooms/${roomId}/messages`, token, {
    method: 'POST',
    body: JSON.stringify({ text, parent_id: parentId }),
  });
}

export async function deleteRoomMessage(
  token: string,
  messageId: string,
): Promise<{ message: string; data: ChatMessage }> {
  return chatRequest(`/messages/${messageId}`, token, {
    method: 'DELETE',
  });
}

export async function editRoomMessage(
  token: string,
  messageId: string,
  text: string,
): Promise<{ message: string; data: ChatMessage }> {
  return chatRequest(`/messages/${messageId}`, token, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  });
}

export async function toggleRoomMessageReaction(
  token: string,
  messageId: string,
  emoji: string,
): Promise<{ message: string; data: ChatMessage }> {
  return chatRequest(`/messages/${messageId}/reactions`, token, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
}

export async function markRoomAsRead(
  token: string,
  roomId: string,
  last_read_message_id: string,
): Promise<{ message: string; room_id: string; user_uuid: string; last_read_message_id: string; last_read_seq: number }> {
  return chatRequest(`/rooms/${roomId}/read`, token, {
    method: 'POST',
    body: JSON.stringify({ last_read_message_id }),
  });
}

/* ====== Assets ====== */

export interface Asset {
  asset_uuid: string;
  name: string;
  description: string;
  file_url: string;
  created_at: string;
}

export async function createAsset(
  token: string,
  data: { name: string; description: string; file: File }
): Promise<Asset> {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('description', data.description);
  formData.append('file', data.file);
  // request handles adding Authorization header, but clears Content-Type for FormData
  return request('/assets', {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
}

export async function getMyAssets(token: string): Promise<Asset[]> {
  return request('/assets/my', {
    method: 'GET',
    headers: authHeaders(token),
  });
}

export async function deleteAsset(token: string, asset_uuid: string): Promise<void> {
  return request(`/assets/${asset_uuid}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

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
  };

  return errorMap[message] || message;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
): Promise<TokenResponse> {
  const hashed = await sha256(password);
  return request('/user/login', {
    method: 'POST',
    body: JSON.stringify({ user_id, password: hashed }),
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
  created_at: number;
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

export async function walletDisconnect(
  token: string,
): Promise<void> {
  await request('/wallets', {
    method: 'DELETE',
    headers: authHeaders(token),
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

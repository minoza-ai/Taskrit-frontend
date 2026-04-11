import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../lib/store';
import {
  approveProjectSubmission,
  createProjectSubmission,
  createTeamRoom,
  deleteProject,
  getProject,
  listProjectSubmissions,
  listChatUsers,
  updateProject,
  uploadProjectSubmissionArtifact,
  type Project,
  type ProjectSubmission,
} from '../lib/api';
import PopupModal from '../components/PopupModal';

interface MatchedCandidate {
  ability: string;
  name: string;
  type: 'human' | 'ai' | 'robot' | 'asset';
  score: number;
  info?: string;
}

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const tryRefresh = useAuthStore((s) => s.tryRefresh);
  const logout = useAuthStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'submissions'>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [teamRequirements, setTeamRequirements] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingNegotiationRoom, setIsCreatingNegotiationRoom] = useState(false);
  const [isStartingProject, setIsStartingProject] = useState(false);
  const [isEditingRoles, setIsEditingRoles] = useState(false);
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [approvingSubmissionUuid, setApprovingSubmissionUuid] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [teamActionStatus, setTeamActionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editableTeam, setEditableTeam] = useState<MatchedCandidate[]>([]);
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [approveAmounts, setApproveAmounts] = useState<Record<string, string>>({});

  const typeIcons: Record<string, string> = {
    human: '👤',
    ai: '🤖',
    robot: '⚙️',
    asset: '🔗',
  };

  const typeLabel: Record<string, string> = {
    human: '인간 전문가',
    ai: 'AI 에이전트',
    robot: '로봇',
    asset: '자산',
  };

  const parseMatchingResults = (description: string): MatchedCandidate[] => {
    const matchingSection = description.split('[AI 매칭 제안]')[1];
    if (!matchingSection) return [];

    const candidates: MatchedCandidate[] = [];
    const lines = matchingSection.trim().split('\n');

    for (const line of lines) {
      const match = line.match(/^-\s+([^:]+):\s+([^(]+)\s+\(([^,]+),\s+score\s+([\d.]+)\)/);
      if (match) {
        const [, ability, name, typeStr, scoreStr] = match;
        const typeMap: Record<string, 'human' | 'ai' | 'robot' | 'asset'> = {
          'human': 'human',
          'agent': 'ai',
          'robot': 'robot',
          'asset': 'asset',
        };

        candidates.push({
          ability: ability.trim(),
          name: name.trim(),
          type: typeMap[typeStr.trim()] || 'human',
          score: parseFloat(scoreStr),
        });
      }
    }

    return candidates;
  };

  const matchedCandidates = useMemo(() => {
    return detailedDescription ? parseMatchingResults(detailedDescription) : [];
  }, [detailedDescription]);

  useEffect(() => {
    if (isEditingRoles) return;
    setEditableTeam(matchedCandidates.map((candidate) => ({ ...candidate })));
  }, [matchedCandidates, isEditingRoles]);

  const isProjectOwner = useMemo(() => {
    return !!(project && user && project.owner_user_uuid === user.user_uuid);
  }, [project, user]);

  const parseRequirementCandidates = (requirements: string): MatchedCandidate[] => {
    if (!requirements.trim()) return [];

    const rows = requirements.split('\n');
    const parsed: MatchedCandidate[] = [];

    for (const raw of rows) {
      const line = raw.trim();
      if (!line) continue;

      const [left, ...rightParts] = line.split(' - ');
      if (!left || rightParts.length === 0) continue;

      const typeToken = left.replace(/^\d+\)\s*/, '').split('/')[0]?.trim().toLowerCase();
      const displayName = rightParts.join(' - ').replace(/\s*\(조종사:\s*[^)]+\)\s*$/i, '').trim();

      if (!displayName) continue;

      let type: MatchedCandidate['type'] = 'human';
      if (typeToken === 'agent' || typeToken === 'ai') type = 'ai';
      if (typeToken === 'robot') type = 'robot';
      if (typeToken === 'asset') type = 'asset';

      parsed.push({
        ability: '',
        name: displayName,
        type,
        score: 0,
      });
    }

    return parsed;
  };

  const getNegotiationTargets = (): string[] => {
    const merged = [...matchedCandidates, ...parseRequirementCandidates(teamRequirements)];
    const dedup = new Map<string, string>();

    merged.forEach((candidate) => {
      if (candidate.type === 'asset') return;

      const name = candidate.name.trim();
      if (!name) return;

      const key = name.toLowerCase();
      if (!dedup.has(key)) {
        dedup.set(key, name);
      }
    });

    return Array.from(dedup.values());
  };

  const resolveTargetUserUuids = async (token: string, targets: string[]): Promise<string[]> => {
    const myUserUuid = user?.user_uuid;
    const resolvedUserUuids = new Set<string>();

    await Promise.all(targets.map(async (targetName) => {
      const users = await listChatUsers(token, { query: targetName, limit: 10 });
      const normalized = targetName.trim().toLowerCase();

      const exact = users.filter((chatUser) => (
        chatUser.nickname?.trim().toLowerCase() === normalized
        || chatUser.user_id?.trim().toLowerCase() === normalized
      ));

      const exactNickname = exact.filter((chatUser) => chatUser.nickname?.trim().toLowerCase() === normalized);
      const chosen = exactNickname.length === 1
        ? exactNickname[0]
        : exact.length === 1
          ? exact[0]
          : users.length === 1
            ? users[0]
            : null;

      if (chosen && chosen.user_uuid !== myUserUuid) {
        resolvedUserUuids.add(chosen.user_uuid);
      }
    }));

    return Array.from(resolvedUserUuids);
  };

  const handleNegotiateWithTeam = async () => {
    if (!accessToken || isCreatingNegotiationRoom) return;

    const targetNames = getNegotiationTargets();
    if (targetNames.length === 0) {
      setError('협상할 추천 인원을 찾지 못했습니다. AI 추천 팀을 먼저 생성해 주세요.');
      return;
    }

    const roomTitle = (name || project?.name || '').trim() || '프로젝트 협상방';

    setIsCreatingNegotiationRoom(true);
    setError(null);

    const createAndNavigate = async (token: string) => {
      const memberUserUuids = await resolveTargetUserUuids(token, targetNames);

      if (memberUserUuids.length === 0) {
        throw new Error('추천 인원 중 채팅 가능한 사용자를 찾지 못했습니다.');
      }

      const newRoom = await createTeamRoom(token, memberUserUuids, roomTitle);
      navigate(`/messages?room=${encodeURIComponent(newRoom.room_id)}`);
    };

    try {
      await createAndNavigate(accessToken);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await createAndNavigate(token);
          } catch (retryErr: any) {
            setError(retryErr.message || '협상 채팅방 생성에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '협상 채팅방 생성에 실패했습니다');
      }
    } finally {
      setIsCreatingNegotiationRoom(false);
    }
  };

  const toRequirementType = (type: MatchedCandidate['type']): string => {
    if (type === 'ai') return 'ai';
    return type;
  };

  const accountTypeLabel = (type: MatchedCandidate['type']): string => {
    if (type === 'human') return 'human';
    if (type === 'ai') return 'agent';
    if (type === 'robot') return 'robot';
    return 'asset';
  };

  const formatScore = (value: number): string => value.toFixed(2);

  const sanitizeTeamCandidates = (candidates: MatchedCandidate[]): MatchedCandidate[] => {
    return candidates
      .map((candidate) => ({
        ...candidate,
        ability: candidate.ability.trim(),
        name: candidate.name.trim(),
      }))
      .filter((candidate) => candidate.ability && candidate.name);
  };

  const stripAiMatchSection = (description: string): string => {
    const [base] = description.split('[AI 매칭 제안]');
    return base.trimEnd();
  };

  const buildTeamRequirements = (candidates: MatchedCandidate[]): string | null => {
    if (candidates.length === 0) return null;

    return candidates
      .map((candidate, idx) => {
        const role = candidate.ability.trim() || '역할 미정';
        return `${idx + 1}) ${toRequirementType(candidate.type)}/1개/${role} - ${candidate.name.trim()}`;
      })
      .join('\n');
  };

  const buildAiSummary = (candidates: MatchedCandidate[]): string => {
    if (candidates.length === 0) return '';

    return `[AI 매칭 제안]\n${candidates
      .map((candidate) => (
        `- ${candidate.ability}: ${candidate.name} (${accountTypeLabel(candidate.type)}, score ${formatScore(candidate.score)})`
      ))
      .join('\n')}`;
  };

  const handleRoleEditToggle = () => {
    if (!isEditingRoles) {
      setEditableTeam(matchedCandidates.map((candidate) => ({ ...candidate })));
      setTeamActionStatus(null);
      setIsEditingRoles(true);
      return;
    }

    const sanitized = sanitizeTeamCandidates(editableTeam);
    if (sanitized.length === 0) {
      setError('최소 1개 이상의 역할과 담당자를 입력해주세요.');
      return;
    }

    setEditableTeam(sanitized);
    setIsEditingRoles(false);
    setTeamActionStatus('역할 편집이 적용되었습니다. "이 팀으로 프로젝트 시작하기"를 눌러 저장하세요.');
  };

  const handleRoleFieldChange = (idx: number, key: 'ability' | 'name', value: string) => {
    setEditableTeam((prev) => prev.map((candidate, i) => (i === idx ? { ...candidate, [key]: value } : candidate)));
  };

  const handleStartProjectWithTeam = async () => {
    if (!accessToken || !id || isStartingProject) return;

    const source = isEditingRoles ? editableTeam : (editableTeam.length > 0 ? editableTeam : matchedCandidates);
    const finalizedCandidates = sanitizeTeamCandidates(source);

    if (finalizedCandidates.length === 0) {
      setError('저장할 팀 구성이 없습니다. AI 추천 팀을 먼저 확인하거나 역할을 입력해주세요.');
      return;
    }

    const serializedRequirements = buildTeamRequirements(finalizedCandidates);
    const aiSummary = buildAiSummary(finalizedCandidates);
    const baseDescription = stripAiMatchSection(detailedDescription || '');
    const updatedDescription = [baseDescription, aiSummary].filter(Boolean).join('\n\n');

    setIsStartingProject(true);
    setError(null);
    setTeamActionStatus(null);

    const runStart = async (token: string) => {
      const response = await updateProject(token, id, {
        name: name.trim(),
        category: category.trim() || null,
        budget: parseBudgetToNumber(budget),
        deadline: parseDeadlineToUnix(deadline),
        team_requirements: serializedRequirements,
        detailed_description: updatedDescription || null,
      });

      setProject(response.project);
      setTeamRequirements(response.project.team_requirements || '');
      setDetailedDescription(response.project.detailed_description || '');
      setEditableTeam(finalizedCandidates);
      setIsEditingRoles(false);
      setTeamActionStatus('팀 구성이 저장되었습니다. 결과물 탭에서 제출을 진행하세요.');
      setActiveTab('submissions');
    };

    try {
      await runStart(accessToken);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await runStart(token);
          } catch (retryErr: any) {
            setError(retryErr.message || '프로젝트 시작 처리에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '프로젝트 시작 처리에 실패했습니다');
      }
    } finally {
      setIsStartingProject(false);
    }
  };

  const formatBudget = (value: number | null): string => {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('ko-KR');
  };

  const parseBudgetToNumber = (value: string): number | null => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return null;
    return Number(digits);
  };

  const formatUnixToDateInput = (unix: number | null): string => {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDeadlineToUnix = (value: string): number | null => {
    if (!value) return null;
    const unix = Math.floor(new Date(`${value}T23:59:59`).getTime() / 1000);
    return Number.isNaN(unix) ? null : unix;
  };

  useEffect(() => {
    let ignore = false;

    const load = async (token: string) => {
      if (!id) throw new Error('잘못된 프로젝트 ID입니다');
      const result = await getProject(token, id);
      if (!ignore) {
        setProject(result);
        setName(result.name);
        setCategory(result.category || '');
        setBudget(formatBudget(result.budget));
        setDeadline(formatUnixToDateInput(result.deadline));
        setTeamRequirements(result.team_requirements || '');
        setDetailedDescription(result.detailed_description || '');
        setError(null);
      }
    };

    const run = async () => {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await load(accessToken);
      } catch (err: any) {
        if (err.status === 401) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            try {
              await load(useAuthStore.getState().accessToken!);
            } catch (retryErr: any) {
              setError(retryErr.message || '프로젝트를 불러오지 못했습니다');
            }
          } else {
            logout();
          }
        } else {
          setError(err.message || '프로젝트를 불러오지 못했습니다');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [accessToken, id, logout, tryRefresh]);

  const handleSave = async () => {
    if (!accessToken || !id || !name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await updateProject(accessToken, id, {
        name: name.trim(),
        category: category.trim() || null,
        budget: parseBudgetToNumber(budget),
        deadline: parseDeadlineToUnix(deadline),
        team_requirements: teamRequirements.trim() || null,
        detailed_description: detailedDescription.trim() || null,
      });
      setProject(response.project);
      setCategory(response.project.category || '');
      setBudget(formatBudget(response.project.budget));
      setDeadline(formatUnixToDateInput(response.project.deadline));
      setTeamRequirements(response.project.team_requirements || '');
      setDetailedDescription(response.project.detailed_description || '');
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            const response = await updateProject(token, id, {
              name: name.trim(),
              category: category.trim() || null,
              budget: parseBudgetToNumber(budget),
              deadline: parseDeadlineToUnix(deadline),
              team_requirements: teamRequirements.trim() || null,
              detailed_description: detailedDescription.trim() || null,
            });
            setProject(response.project);
            setCategory(response.project.category || '');
            setBudget(formatBudget(response.project.budget));
            setDeadline(formatUnixToDateInput(response.project.deadline));
            setTeamRequirements(response.project.team_requirements || '');
            setDetailedDescription(response.project.detailed_description || '');
          } catch (retryErr: any) {
            setError(retryErr.message || '프로젝트 수정에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '프로젝트 수정에 실패했습니다');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !id || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      await deleteProject(accessToken, id);
      navigate('/projects');
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await deleteProject(token, id);
            navigate('/projects');
          } catch (retryErr: any) {
            setError(retryErr.message || '프로젝트 삭제에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setError(err.message || '프로젝트 삭제에 실패했습니다');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const formatUnixTime = (unix: number): string => {
    return new Date(unix * 1000).toLocaleString('ko-KR');
  };

  const statusLabel = (status: ProjectSubmission['status']): string => {
    if (status === 'submitted') return '제출됨';
    if (status === 'approved') return '승인됨';
    return '반려됨';
  };

  const statusColor = (status: ProjectSubmission['status']): string => {
    if (status === 'submitted') return 'text-text-sub bg-surface-2';
    if (status === 'approved') return 'text-success bg-success/10';
    return 'text-error bg-error-bg';
  };

  const resolveArtifactHref = (value: string): string => {
    if (value.startsWith('/uploads/')) {
      return `/api${value}`;
    }

    return value;
  };

  const loadSubmissions = async (token: string) => {
    if (!id) return;
    const result = await listProjectSubmissions(token, id);
    setSubmissions(result.submissions || []);
  };

  useEffect(() => {
    if (activeTab !== 'submissions' || !accessToken || !id) return;

    let ignore = false;

    const run = async () => {
      setIsLoadingSubmissions(true);
      setSubmissionError(null);
      try {
        await loadSubmissions(accessToken);
      } catch (err: any) {
        if (err.status === 401) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            try {
              const token = useAuthStore.getState().accessToken;
              if (!token) throw new Error('로그인이 필요합니다');
              await loadSubmissions(token);
            } catch (retryErr: any) {
              if (!ignore) setSubmissionError(retryErr.message || '결과물 목록을 불러오지 못했습니다');
            }
          } else {
            logout();
          }
        } else {
          if (!ignore) setSubmissionError(err.message || '결과물 목록을 불러오지 못했습니다');
        }
      } finally {
        if (!ignore) setIsLoadingSubmissions(false);
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [activeTab, accessToken, id, logout, tryRefresh]);

  const handleSubmitResult = async () => {
    if (!accessToken || !id || isSubmittingResult) return;

    const title = submissionTitle.trim();
    if (!title) {
      setSubmissionError('결과물 제목을 입력해주세요.');
      return;
    }

    setIsSubmittingResult(true);
    setSubmissionError(null);
    setSubmissionStatus(null);

    const runSubmit = async (token: string) => {
      let resolvedArtifactUrl = artifactUrl.trim() || null;

      if (submissionFile) {
        const uploaded = await uploadProjectSubmissionArtifact(token, id, submissionFile);
        resolvedArtifactUrl = uploaded.artifact_url;
      }

      await createProjectSubmission(token, id, {
        title,
        description: submissionDescription.trim() || null,
        artifact_url: resolvedArtifactUrl,
      });
      await loadSubmissions(token);
    };

    try {
      await runSubmit(accessToken);
      setSubmissionTitle('');
      setSubmissionDescription('');
      setArtifactUrl('');
      setSubmissionFile(null);
      setSubmissionStatus('결과물이 제출되었습니다.');
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await runSubmit(token);
            setSubmissionTitle('');
            setSubmissionDescription('');
            setArtifactUrl('');
            setSubmissionFile(null);
            setSubmissionStatus('결과물이 제출되었습니다.');
          } catch (retryErr: any) {
            setSubmissionError(retryErr.message || '결과물 제출에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setSubmissionError(err.message || '결과물 제출에 실패했습니다');
      }
    } finally {
      setIsSubmittingResult(false);
    }
  };

  const handleApproveSubmission = async (submissionUuid: string) => {
    if (!accessToken || !id || approvingSubmissionUuid) return;

    const rawAmount = approveAmounts[submissionUuid]?.trim() || '';
    const settlementAmount = rawAmount ? Number(rawAmount) : undefined;

    if (rawAmount && (!Number.isFinite(settlementAmount) || (settlementAmount ?? 0) <= 0)) {
      setSubmissionError('정산 금액은 0보다 큰 숫자여야 합니다.');
      return;
    }

    setApprovingSubmissionUuid(submissionUuid);
    setSubmissionError(null);
    setSubmissionStatus(null);

    const runApprove = async (token: string) => {
      const result = await approveProjectSubmission(token, id, submissionUuid, settlementAmount);
      setProject(result.project);
      setSubmissions((prev) => prev.map((submission) => (
        submission.submission_uuid === submissionUuid
          ? result.submission
          : submission.status === 'submitted'
            ? { ...submission, status: 'rejected', updated_at: result.submission.updated_at }
            : submission
      )));
      setSubmissionStatus(`정산 완료: ${result.settlement.amount.toLocaleString('ko-KR')} TASK`);
    };

    try {
      await runApprove(accessToken);
    } catch (err: any) {
      if (err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const token = useAuthStore.getState().accessToken;
            if (!token) throw new Error('로그인이 필요합니다');
            await runApprove(token);
          } catch (retryErr: any) {
            setSubmissionError(retryErr.message || '결과물 승인에 실패했습니다');
          }
        } else {
          logout();
        }
      } else {
        setSubmissionError(err.message || '결과물 승인에 실패했습니다');
      }
    } finally {
      setApprovingSubmissionUuid(null);
    }
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

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-error-bg text-error text-sm">
          {error}
        </div>
      )}

      {teamActionStatus && (
        <div className="mb-4 px-4 py-3 rounded-md bg-success/12 text-success text-sm">
          {teamActionStatus}
        </div>
      )}

      {isLoading ? (
        <div className="glass-card rounded-lg p-5 text-center py-12 mb-6">
          <p className="text-text-sub">프로젝트를 불러오는 중입니다</p>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-0.5 mb-6">
        {(['overview', 'team', 'submissions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab
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
          {!project ? (
            <div className="glass-card rounded-lg p-5 text-center py-12">
              <p className="text-text-sub">프로젝트 데이터가 없습니다</p>
              <p className="text-xs text-text-hint mt-1">프로젝트가 삭제되었거나 접근 권한이 없습니다</p>
            </div>
          ) : (
            <>
              <div className="glass-card rounded-lg p-5">
                <h2 className="text-base font-semibold mb-4">기본 정보</h2>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-sub">프로젝트 제목</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="glass-input px-3.5 py-3 rounded-md text-[15px] font-sans"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">카테고리</label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                        placeholder="예: 소프트웨어 개발"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">예산</label>
                      <input
                        type="text"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                        placeholder="예: 500000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">마감일</label>
                      <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-sub">팀 요구사항</label>
                      <textarea
                        value={teamRequirements}
                        onChange={(e) => setTeamRequirements(e.target.value)}
                        rows={3}
                        className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[90px]"
                        placeholder={'1) human/1명/프론트엔드 개발\n2) ai/1명/테스트 자동화'}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-sub">상세 설명</label>
                    <textarea
                      value={detailedDescription}
                      onChange={(e) => setDetailedDescription(e.target.value)}
                      rows={6}
                      className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[120px]"
                    />
                  </div>
                  <div className="text-xs text-text-hint flex flex-col gap-1">
                    <span>생성일: {formatUnixTime(project.created_at)}</span>
                    <span>수정일: {formatUnixTime(project.updated_at)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !name.trim()}
                      className="btn-primary flex-1 py-2.5 rounded-lg text-sm cursor-pointer"
                    >
                      {isSaving ? '저장 중...' : '수정 저장'}
                    </button>
                    <button
                      onClick={requestDelete}
                      disabled={isDeleting}
                      className="btn-secondary py-2.5 px-4 rounded-lg text-sm text-error"
                    >
                      {isDeleting ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="flex flex-col gap-6">
          {/* Hero Section */}
          <div className="glass-card rounded-lg p-6 border border-active/20 bg-gradient-to-br from-active/10 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-sub mb-2">이런 프로젝트를 계획 중이신가요?</p>
                <p className="text-sm italic text-text-hint">
                  "{name && name.length > 30 ? `${name.substring(0, 30)}...` : name}"
                </p>
              </div>
              <button
                onClick={() => navigate(`/projects/new`)}
                className="btn-primary px-5 py-2.5 rounded-lg text-sm whitespace-nowrap"
              >
                팀 구성하기
              </button>
            </div>
          </div>

          {/* Matching Results */}
          {matchedCandidates.length > 0 ? (
            <>
              <div>
                <h2 className="text-base font-bold mb-1">
                  AI 분석 결과: <span className="text-active">{name}</span>
                </h2>
                <p className="text-sm text-text-sub">
                  필요 역할 <span className="font-semibold text-text">{matchedCandidates.length}개</span> 도출
                </p>
              </div>

              {/* Candidate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(isEditingRoles ? editableTeam : matchedCandidates).map((candidate, idx) => (
                  <div
                    key={`${candidate.ability}-${idx}`}
                    className="glass-card rounded-lg p-5 flex flex-col items-center text-center hover:shadow-md transition-shadow"
                  >
                    {/* Type Badge */}
                    <div className="text-[10px] font-semibold text-text-hint uppercase tracking-wider mb-2">
                      {typeLabel[candidate.type]}
                    </div>

                    {/* Role Title */}
                    {isEditingRoles ? (
                      <input
                        type="text"
                        value={candidate.ability}
                        onChange={(e) => handleRoleFieldChange(idx, 'ability', e.target.value)}
                        className="glass-input w-full px-2.5 py-2 rounded-md text-xs font-semibold mb-4 text-center"
                      />
                    ) : (
                      <h3 className="text-sm font-bold mb-4 text-text line-clamp-2 min-h-10">
                        {candidate.ability}
                      </h3>
                    )}

                    {/* Icon */}
                    <div className="text-4xl mb-4">{typeIcons[candidate.type]}</div>

                    {/* Name */}
                    {isEditingRoles ? (
                      <input
                        type="text"
                        value={candidate.name}
                        onChange={(e) => handleRoleFieldChange(idx, 'name', e.target.value)}
                        className="glass-input w-full px-2.5 py-2 rounded-md text-xs mb-1 text-center"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-text mb-1">{candidate.name}</p>
                    )}

                    {/* Info */}
                    <div className="text-xs text-text-sub mb-4 min-h-10">
                      {candidate.type === 'asset' ? (
                        <p>자동 배정</p>
                      ) : candidate.type === 'ai' ? (
                        <p>자동 배정</p>
                      ) : (
                        <p>검증 완료</p>
                      )}
                    </div>

                    {/* Score/Match Bar */}
                    <div className="w-full">
                      <div className="mb-2">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[9px] text-text-hint">매칭</span>
                          <span className="text-xs font-bold text-active">
                            {Math.round(candidate.score * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-active to-success transition-all"
                            style={{ width: `${Math.min(candidate.score * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Footer */}
              <div className="glass-card rounded-lg p-5 bg-surface-2 flex items-center justify-between gap-6">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-text-hint">총 필요 자원</p>
                    <p className="text-sm font-bold text-text">{matchedCandidates.length}개 충족</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-hint">예상 기간</p>
                    <p className="text-sm font-bold text-text">{Math.ceil(matchedCandidates.length * 1.5)}주</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-hint">예상 비용</p>
                    <p className="text-sm font-bold text-text">
                      {(matchedCandidates.length * 1375000).toLocaleString('ko-KR')}원
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRoleEditToggle}
                    className="text-xs px-3 py-2 rounded-lg bg-surface text-text-sub hover:bg-surface-2 transition-colors"
                  >
                    {isEditingRoles ? '역할 수정 완료' : '역할 수정'}
                  </button>
                  <button
                    onClick={handleStartProjectWithTeam}
                    disabled={isStartingProject}
                    className="btn-primary px-4 py-2 rounded-lg text-xs whitespace-nowrap cursor-pointer"
                  >
                    {isStartingProject ? '프로젝트 시작 중...' : '이 팀으로 프로젝트 시작하기'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-lg p-12 text-center">
              <p className="text-sm text-text-sub mb-2">아직 AI 분석 결과가 없습니다</p>
              <p className="text-xs text-text-hint mb-4">프로젝트를 생성하거나 수정할 때 팀 추천을 받을 수 있습니다</p>
              <button
                onClick={() => navigate(`/projects/new`)}
                className="btn-primary px-5 py-2.5 rounded-lg text-sm"
              >
                프로젝트 생성하기
              </button>
            </div>
          )}

          <button
            onClick={handleNegotiateWithTeam}
            disabled={isCreatingNegotiationRoom}
            className="glass-card glass-card-hover rounded-lg p-4 text-left transition-all cursor-pointer"
          >
            <span className="text-sm font-medium">
              {isCreatingNegotiationRoom ? '💬 협상 채팅방 생성 중...' : '💬 팀원과 협상하기'}
            </span>
            <p className="text-xs text-text-sub mt-1">메시지로 역할과 조건을 조율하세요</p>
          </button>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="flex flex-col gap-4">
          <div className="glass-card rounded-lg p-5">
            <h2 className="text-base font-semibold mb-3">결과물 제출</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">제목</label>
                <input
                  type="text"
                  value={submissionTitle}
                  onChange={(e) => setSubmissionTitle(e.target.value)}
                  placeholder="예: 최종 코드 및 테스트 결과"
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">설명</label>
                <textarea
                  value={submissionDescription}
                  onChange={(e) => setSubmissionDescription(e.target.value)}
                  placeholder="이번 제출에 포함된 내용과 확인 방법을 적어주세요"
                  rows={4}
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans resize-y min-h-[110px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">결과물 URL (선택)</label>
                <input
                  type="url"
                  value={artifactUrl}
                  onChange={(e) => setArtifactUrl(e.target.value)}
                  placeholder="https://..."
                  className="glass-input px-3.5 py-3 rounded-md text-sm font-sans"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-sub">파일 첨부 (선택)</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSubmissionFile(file);
                    if (file) {
                      setArtifactUrl('');
                    }
                  }}
                  className="glass-input px-3.5 py-2.5 rounded-md text-sm font-sans"
                />
                {submissionFile && (
                  <p className="text-xs text-text-sub">
                    선택된 파일: {submissionFile.name} ({Math.ceil(submissionFile.size / 1024)} KB)
                  </p>
                )}
                <p className="text-xs text-text-hint">파일을 첨부하면 URL 대신 업로드된 파일 경로가 자동 저장됩니다.</p>
              </div>

              <button
                onClick={handleSubmitResult}
                disabled={isSubmittingResult}
                className="btn-primary w-full py-3 rounded-lg text-sm"
              >
                {isSubmittingResult ? '제출 중...' : '결과물 제출하기'}
              </button>
            </div>
          </div>

          <div className="glass-card rounded-lg p-5">
            <h2 className="text-base font-semibold mb-3">제출 내역</h2>

            {submissionStatus && (
              <div className="mb-3 px-3 py-2 rounded-md bg-success/12 text-success text-sm">
                {submissionStatus}
              </div>
            )}

            {submissionError && (
              <div className="mb-3 px-3 py-2 rounded-md bg-error-bg text-error text-sm">
                {submissionError}
              </div>
            )}

            {isLoadingSubmissions ? (
              <p className="text-sm text-text-sub">제출 내역을 불러오는 중입니다...</p>
            ) : submissions.length === 0 ? (
              <p className="text-sm text-text-sub">아직 제출된 결과물이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {submissions.map((submission) => (
                  <div key={submission.submission_uuid} className="rounded-lg border border-border bg-surface-2 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-text">{submission.title}</p>
                        <p className="text-xs text-text-hint mt-1">
                          제출자: {submission.submitter_user_uuid} · {formatUnixTime(submission.created_at)}
                        </p>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${statusColor(submission.status)}`}>
                        {statusLabel(submission.status)}
                      </span>
                    </div>

                    {submission.description && (
                      <p className="text-sm text-text-sub whitespace-pre-wrap mb-2">{submission.description}</p>
                    )}

                    {submission.artifact_url && (
                      <a
                        href={resolveArtifactHref(submission.artifact_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-active underline break-all"
                      >
                        {submission.artifact_url}
                      </a>
                    )}

                    {submission.status === 'approved' && submission.settlement_amount !== null && (
                      <p className="text-xs text-success mt-2">
                        정산 완료: {submission.settlement_amount.toLocaleString('ko-KR')} TASK
                      </p>
                    )}

                    {isProjectOwner && submission.status === 'submitted' && (
                      <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={approveAmounts[submission.submission_uuid] || ''}
                          onChange={(e) => setApproveAmounts((prev) => ({
                            ...prev,
                            [submission.submission_uuid]: e.target.value,
                          }))}
                          placeholder="정산 금액(선택, 미입력 시 기본값)"
                          className="glass-input px-3 py-2 rounded-md text-xs font-sans"
                        />
                        <button
                          onClick={() => handleApproveSubmission(submission.submission_uuid)}
                          disabled={approvingSubmissionUuid === submission.submission_uuid}
                          className="btn-primary py-2 rounded-md text-xs"
                        >
                          {approvingSubmissionUuid === submission.submission_uuid ? '승인/정산 중...' : '승인하고 자동 정산'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-lg p-5">
            <h2 className="text-base font-semibold mb-3">블록체인 정산 상태</h2>
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${submissions.some((s) => s.status === 'approved') ? 'bg-success' : 'bg-text-hint'}`} />
              <span className="text-sm text-text-sub">
                {submissions.some((s) => s.status === 'approved') ? '정산 완료된 제출이 있습니다' : '아직 정산이 완료되지 않았습니다'}
              </span>
            </div>
          </div>
        </div>
      )}

      <PopupModal
        open={isDeleteConfirmOpen}
        title="프로젝트 삭제"
        message="정말 이 프로젝트를 삭제하시겠습니까?"
        confirmText={isDeleting ? '삭제 중...' : '삭제'}
        cancelText="취소"
        variant="confirm"
        destructive
        busy={isDeleting}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await handleDelete();
          setIsDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
};

export default ProjectDetailPage;

export type Id = string | number
export type Role = 'LEADER' | 'MEMBER'
export interface User {
  userId: Id
  name: string
  email: string
}
export interface Capabilities {
  canViewOwnData: boolean
  canViewTeamMetrics: boolean
  canEditSettings: boolean
  canEditGoals: boolean
  canManageMembers: boolean
  canManageSharedCases: boolean
}
export interface Team {
  capabilities?: Capabilities
  teamId: Id
  name: string
  description?: string
  myRole: Role
  memberCount?: number
}
export interface Tokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}
export interface LoginResult extends Tokens {
  user: User
}
export interface TaskType {
  taskTypeId: Id
  name: string
  successConditions: string[]
  failureConditions: string[]
  unknownConditions: string[]
}
export interface Settings {
  version: number
  taskType: TaskType | null
  targetFrom: string | null
  targetTo: string | null
  onboardingStartDate: string | null
  targetCount: number | null
  policies: {
    policyVersion: number
    minSampleSize: number
    minTeamContributors: number
    minOutcomeConfirmationRate: number
    uploadRetentionMinutes: number
    maxSelectionsPerRequest: number
  }
}
export interface SettingsInput {
  expectedVersion: number
  taskType: Omit<TaskType, 'taskTypeId'>
  targetFrom: string
  targetTo: string
  onboardingStartDate: string | null
  targetCount: number | null
}
export interface Member {
  userId: Id
  name: string
  email: string
  role: Role
  submitted: boolean
}
export interface FilterOptions {
  settingsVersions?: number[]
  allowedUnits?: string[]
  availableWeeks?: { weekStart: string; weekEnd: string }[]
  settingsVersion?: number

  taskTypes: { id: Id; name: string }[]
  models: string[]
  dataFrom: string | null
  dataTo: string | null
}
export interface Metric {
  value: number | null
  status?: string
  assessmentSource?: string
  valueSource?: string
  sampleSize?: number | null
  reasonCodes?: string[]
  prevValue?: number | null
  estimated?: boolean
}
export interface Kpis {
  from: string
  to: string
  cohortCoverage?: {
    selectedCount: number
    inScopeCount: number
    excludedCount: number
    pendingCount: number
    failedCount: number
    outcomeConfirmedCount: number
    reworkConfirmedCount: number
    tokenMeasuredCount: number
  } | null
  tokensPerSuccess: Metric
  reworkRate: Metric
  successRate: Metric
  conversationCount: Metric
  humanTime?: Metric
  coverage?: {
    submittedMembers: number
    totalMembers: number
    analyzedConversations: number
    targetCount: number | null
    coverageRate: number | null
  }
}
export interface Trends {
  metric: string
  estimated: boolean
  points: {
    date: string
    value: number | null
    conversationCount: number | null
    status?: string
    insufficientSample: boolean
  }[]
}
export interface Candidate {
  externalId: string
  title: string
  startedAt: string
  isDuplicate: boolean
}
export interface Upload {
  uploadId: Id
  conversations?: Candidate[]
  settingsVersion?: number
  expiresAt?: string
}
export interface CandidatePage {
  items: {
    selectionId: string
    title: string
    startedAt: string
    externalId: string
    duplicateType: 'NONE' | 'SAME_CONTENT' | 'CONTENT_UPDATED'
    selectable: boolean
    validationCode: string | null
  }[]
  page: number
  size: number
  total: number
}
export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIALLY_SUCCEEDED' | 'FAILED'
export interface AnalysisStart {
  analysisId: Id
  uploadId: Id
  status: RunStatus
  selectedCount: number
  pollAfterSeconds: number
}
export interface AnalysisRun extends AnalysisStart {
  settingsVersion: number
  stage: string | null
  completedCount: number
  succeededCount: number
  failedCount: number
  progressPercent: number
}
export interface AnalysisItems {
  items: {
    itemId: Id
    conversationId: Id
    conversationVersionId: Id
    status: string
    scopeClassification: string | null
    failureCode: string | null
    feedbackIds: Id[]
  }[]
  page: number
  size: number
  total: number
}
export type UploadStatus =
  'UPLOADED' | 'ANALYZING' | 'DONE' | 'FAILED' | 'CONSUMED' | 'READY' | 'EXPIRED' | RunStatus
export interface AnalysisStatus {
  status: UploadStatus
  analysisId?: Id | null
  progress: number
  failReason?: string | null
  savedCount?: number
  skippedDuplicateCount?: number
}
export interface UploadHistory {
  content: {
    uploadId: Id
    analysisId?: Id | null
    uploadedAt: string
    analyzedCount: number | null
    period: { from: string; to: string } | null
    status: UploadStatus
  }[]
  page: number
  size: number
  totalElements: number
}
export type Reaction = 'HELPFUL' | 'NOT_APPLICABLE'
export interface Example {
  before: string
  after: string
}
export interface FeedbackItem {
  conversationVersionId?: Id | null
  feedbackId: Id
  type: string
  title: string
  occurrenceCount: number
  myReaction: Reaction | null
  isShared: boolean
  date?: string
}
export interface FeedbackList {
  days: { date: string; feedbacks: FeedbackItem[] }[]
}
export interface TeamGoals {
  version: number
  successRateMin: number | null
  errorReworkRateMax: number | null
  tokensPerSuccessMax: number | null
  updatedAt: string | null
}
export interface SharePreview {
  previewId: Id
  previewVersion: number
  expiresAt: string
  redactionStatus: string
  content: {
    title: string
    type: string
    problem: string
    improvement: string
    example: Example
  }
}
export interface FeedbackDetail {
  itemId?: Id | null
  conversationVersionId: Id | null
  feedbackId: Id
  type: string
  title: string
  problem: string
  causes: string[]
  improvement: string
  example: Example
  reaction?: Reaction | null
  sharing?: { status: string; version: number; sharedCaseId: Id | null }
  limitations?: string[]
  evidences: { conversationVersionId: Id; turnIndexes: number[] }[]
}
export interface Conversation {
  title: string
  startedAt: string
  model: string
  messages: { idx: number; role: string; content: string; isRework?: boolean }[]
  highlightIndexes: number[]
}
export interface SharedCase {
  sharedCaseId?: Id
  shareVersion?: number
  feedbackId: Id
  taskType: string
  type: string
  title: string
  problem: string
  improvement: string
  example: Example
  isGuide: boolean
}
export interface Guide {
  sharedCaseId?: Id
  feedbackId: Id
  title: string
  problem: string
  improvement: string
  example: Example
  guideAddedAt: string
}
export interface Guides {
  groups: { type: string; guides: Guide[] }[]
}

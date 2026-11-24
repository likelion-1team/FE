export type Id = string | number
export type Role = 'LEADER' | 'MEMBER'
export interface User {
  userId: Id
  name: string
  email: string
}
export interface Team {
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
  id?: Id
  taskTypeId?: Id
  name: string
  successDefinition: string
}
export interface Settings {
  taskTypes: TaskType[]
  targetFrom: string | null
  targetTo: string | null
  onboardingStartDate: string | null
  targetCount: number | null
  minDailyConversations?: number
  hourlyLaborCost?: number
}
export interface SettingsInput {
  taskTypes: { name: string; successDefinition: string }[]
  targetFrom: string
  targetTo: string
  onboardingStartDate: string
  targetCount?: number | null
}
export interface Member {
  userId: Id
  name: string
  email: string
  role: Role
  submitted: boolean
}
export interface FilterOptions {
  taskTypes: { id: Id; name: string }[]
  models: string[]
  dataFrom: string | null
  dataTo: string | null
}
export interface Metric {
  value: number | null
  prevValue?: number | null
  estimated?: boolean
}
export interface Kpis {
  from: string
  to: string
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
    conversationCount: number
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
  conversations: Candidate[]
}
export type UploadStatus = 'UPLOADED' | 'ANALYZING' | 'DONE' | 'FAILED'
export interface AnalysisStatus {
  status: UploadStatus
  progress: number
  failReason?: string | null
  savedCount?: number
  skippedDuplicateCount?: number
}
export interface UploadHistory {
  content: {
    uploadId: Id
    uploadedAt: string
    analyzedCount: number
    period: { from: string; to: string }
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
export interface FeedbackDetail {
  feedbackId: Id
  type: string
  title: string
  problem: string
  causes: string[]
  improvement: string
  example: Example
  evidences: { conversationId: Id; turnIndexes: number[] }[]
}
export interface Conversation {
  title: string
  startedAt: string
  model: string
  messages: { idx: number; role: string; content: string; isRework?: boolean }[]
  highlightIndexes: number[]
}
export interface SharedCase {
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

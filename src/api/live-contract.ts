import { z } from 'zod'
import * as old from './schemas'
const id = z.union([z.string().min(1), z.number().int().nonnegative().safe()])
const count = z.number().int().nonnegative()
const page = { page: z.number().int().positive(), size: z.number().int().positive(), total: count }
export const teamPage = z.object({ items: old.teamsSchema, ...page })
export const memberPage = z.object({ items: old.membersSchema, ...page })
export const options = z.object({
  scope: z.enum(['ME', 'TEAM']),
  taskTypes: z.array(z.object({ taskTypeId: id, name: z.string() })),
  settingsVersions: z.array(count),
  allowedUnits: z.array(z.enum(['DAY', 'WEEK'])),
  availableWeeks: z.array(z.object({ weekStart: z.string(), weekEnd: z.string() })),
  allowedModels: z.array(z.string()),
})
export const metric = z.object({
  code: z.string(),
  value: z.number().nullable(),
  status: z.enum([
    'AVAILABLE',
    'SUPPRESSED',
    'NOT_COMPARABLE',
    'NO_DATA',
    'NOT_MEASURED',
    'ZERO_DENOMINATOR',
    'INSUFFICIENT_SAMPLE',
    'INSUFFICIENT_CONFIRMATION',
  ]),
  assessmentSource: z.string(),
  valueSource: z.string(),
  sampleSize: count.nullable(),
  reasonCodes: z.array(z.string()),
})
export const kpis = z.object({
  scope: z.enum(['ME', 'TEAM']),
  metrics: z.array(metric),
  coverage: z
    .object({
      selectedCount: count,
      inScopeCount: count,
      excludedCount: count,
      pendingCount: count,
      failedCount: count,
      outcomeConfirmedCount: count,
      reworkConfirmedCount: count,
      tokenMeasuredCount: count,
    })
    .nullable(),
})
export const trends = z.object({
  scope: z.enum(['ME', 'TEAM']),
  points: z.array(z.object({ periodStart: z.string(), metric })),
})
const lifecycle = z.enum(['READY', 'CONSUMED', 'EXPIRED'])
export const upload = z.object({
  uploadId: id,
  status: lifecycle,
  settingsVersion: count,
  expiresAt: z.string(),
  conversationCount: count,
  eligibleConversationCount: count,
})
export const uploadStatus = z.object({
  uploadId: id,
  status: lifecycle,
  analysisId: id.nullable(),
  expiresAt: z.string(),
  settingsVersion: count.nullable(),
})
export const history = z.object({
  items: z.array(
    z.object({
      uploadId: id,
      createdAt: z.string(),
      status: lifecycle,
      analysisId: id.nullable(),
      analysisStatus: z
        .enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED'])
        .nullable(),
      selectedCount: count.nullable(),
      succeededCount: count.nullable(),
      failedCount: count.nullable(),
      targetFrom: z.string().nullable(),
      targetTo: z.string().nullable(),
    }),
  ),
  ...page,
})
export const feedbacks = z.object({
  items: z.array(
    z.object({
      feedbackId: id,
      itemId: id.nullable(),
      conversationId: id.nullable(),
      conversationVersionId: id.nullable(),
      type: z.string(),
      title: z.string(),
      occurrenceCount: count,
      createdAt: z.string(),
      reaction: z.enum(['HELPFUL', 'NOT_APPLICABLE']).nullable(),
      sharingStatus: z.string(),
    }),
  ),
  ...page,
})
export const feedback = z.object({
  feedbackId: id,
  itemId: id.nullable(),
  conversationId: id.nullable(),
  conversationVersionId: id.nullable(),
  type: z.string(),
  title: z.string(),
  problem: z.string(),
  causes: z.array(z.string()),
  improvement: z.string(),
  example: z.object({ before: z.string(), after: z.string() }),
  evidenceMessageIds: z.array(z.string()),
  limitations: z.array(z.string()),
  reaction: z.enum(['HELPFUL', 'NOT_APPLICABLE']).nullable(),
  sharing: z.object({ status: z.string(), version: count, sharedCaseId: id.nullable() }),
  outcomeAssessment: z
    .object({
      outcome: z.enum(['SUCCESS', 'FAILURE', 'UNKNOWN']),
      source: z.string(),
      version: count,
      assessedAt: z.string(),
    })
    .nullable()
    .optional(),
  reworkAssessment: z
    .object({
      type: z.enum([
        'ERROR_CORRECTION',
        'REQUIREMENT_CHANGE',
        'EXPRESSION_REFINEMENT',
        'EXPLORATION',
        'NONE',
        'UNKNOWN',
      ]),
      source: z.string(),
      version: count,
      assessedAt: z.string(),
    })
    .nullable()
    .optional(),
  aiAssessment: z
    .object({ outcome: z.string().nullable(), reworkType: z.string().nullable() })
    .nullable()
    .optional(),
})
export const conversation = z.object({
  conversationVersionId: id,
  title: z.string(),
  startedAt: z.string(),
  highlightMessageIds: z.array(z.string()),
  messages: z.array(z.object({ messageId: z.string(), role: z.string(), content: z.string() })),
})
export const shared = z.object({
  items: z.array(
    z.object({
      sharedCaseId: id,
      shareVersion: count,
      taskTypeId: id,
      type: z.string(),
      title: z.string(),
      problem: z.string(),
      improvement: z.string(),
      example: z.object({ before: z.string(), after: z.string() }),
      isGuide: z.boolean(),
    }),
  ),
  ...page,
})
export const share = z.object({
  shared: z.boolean(),
  shareVersion: count,
  sharedCaseId: id.nullable(),
})
export const submissions = z.object({
  settingsVersion: count.nullable(),
  submittedMembers: count,
  totalMembers: count,
  analyzedConversations: count.nullable(),
  targetCount: count.nullable(),
  coverageRatio: z.number().nullable(),
  status: z.enum(['AVAILABLE', 'SUPPRESSED']),
})
export const goals = z.object({
  version: count,
  successRateMin: z.number().nullable(),
  errorReworkRateMax: z.number().nullable(),
  tokensPerSuccessMax: z.number().nullable(),
  updatedAt: z.string().nullable(),
})
export const sharePreview = z.object({
  previewId: id,
  previewVersion: count,
  expiresAt: z.string(),
  redactionStatus: z.string(),
  content: z.object({
    title: z.string(),
    type: z.string(),
    problem: z.string(),
    improvement: z.string(),
    example: z.object({ before: z.string(), after: z.string() }),
  }),
})
export const outcome = z.object({
  itemId: id,
  version: count,
  outcome: z.enum(['SUCCESS', 'FAILURE', 'UNKNOWN']),
  source: z.string(),
  assessedAt: z.string(),
})
export const reworkTypes = [
  'ERROR_CORRECTION',
  'REQUIREMENT_CHANGE',
  'EXPRESSION_REFINEMENT',
  'EXPLORATION',
  'NONE',
  'UNKNOWN',
] as const
export const rework = z.object({
  itemId: id,
  version: count,
  type: z.enum(reworkTypes),
  source: z.string(),
  assessedAt: z.string(),
})

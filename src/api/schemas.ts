import { z } from 'zod'

const id = z.union([z.string().min(1), z.number().int().nonnegative().safe()])
const count = z.number().int().nonnegative()
const nullableNumber = z
  .number()
  .finite()
  .nullish()
  .transform((value) => value ?? null)
const nullableDate = z
  .string()
  .nullish()
  .transform((value) => value ?? null)
const role = z.enum(['LEADER', 'MEMBER'])
const reaction = z.enum(['HELPFUL', 'NOT_APPLICABLE'])
const status = z.enum(['UPLOADED', 'ANALYZING', 'DONE', 'FAILED', 'CONSUMED'])
const example = z.object({ before: z.string(), after: z.string() })
export const tokensSchema = z.object({
  accessToken: z.string().trim().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresIn: z.number().positive().optional(),
})
export const userSchema = z.object({ userId: id, name: z.string(), email: z.string() })
export const loginSchema = tokensSchema.extend({ user: userSchema })
export const teamsSchema = z.array(
  z.object({
    teamId: id,
    name: z.string(),
    myRole: role,
    description: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
    memberCount: count.optional(),
  }),
)
export const emailCheckSchema = z.object({ available: z.boolean() })
export const settingsSchema = z.object({
  version: count,
  taskType: z
    .object({
      taskTypeId: id,
      name: z.string(),
      successConditions: z.array(z.string()),
      failureConditions: z.array(z.string()),
      unknownConditions: z.array(z.string()),
    })
    .nullable(),
  targetFrom: nullableDate,
  targetTo: nullableDate,
  onboardingStartDate: nullableDate,
  targetCount: nullableNumber,
  policies: z.object({
    policyVersion: count,
    minSampleSize: count,
    minTeamContributors: count,
    minOutcomeConfirmationRate: z.number().min(0).max(1),
    uploadRetentionMinutes: z.number().int().positive(),
    maxSelectionsPerRequest: z.number().int().positive(),
  }),
})
export const membersSchema = z.array(
  z.object({ userId: id, name: z.string(), email: z.string(), role, submitted: z.boolean() }),
)
export const optionsSchema = z.object({
  taskTypes: z.array(z.object({ id, name: z.string() })),
  models: z.array(z.string()),
  dataFrom: nullableDate,
  dataTo: nullableDate,
})
const metric = z.object({
  value: nullableNumber,
  prevValue: nullableNumber.optional(),
  estimated: z.boolean().optional(),
})
export const kpisSchema = z.object({
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  tokensPerSuccess: metric,
  reworkRate: metric,
  successRate: metric,
  conversationCount: metric,
  humanTime: metric.optional(),
  coverage: z
    .object({
      submittedMembers: count,
      totalMembers: count,
      analyzedConversations: count,
      targetCount: nullableNumber,
      coverageRate: nullableNumber,
    })
    .nullish()
    .transform((value) => value ?? undefined),
})
export const trendsSchema = z.object({
  metric: z.string(),
  estimated: z.boolean(),
  points: z.array(
    z.object({
      date: z.string(),
      value: nullableNumber,
      conversationCount: count,
      insufficientSample: z.boolean().optional().default(false),
    }),
  ),
})
export const uploadSchema = z.object({
  uploadId: id,
  conversations: z.array(
    z.object({
      externalId: z.string(),
      title: z.string(),
      startedAt: z.string(),
      isDuplicate: z.boolean(),
    }),
  ),
})
const runStatus = z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED'])
export const analysisStartSchema = z.object({
  analysisId: id,
  uploadId: id,
  status: runStatus,
  selectedCount: count,
  pollAfterSeconds: z.number().int().positive(),
})
export const analysisRunSchema = analysisStartSchema.extend({
  settingsVersion: count,
  stage: z.string().nullable(),
  completedCount: count,
  succeededCount: count,
  failedCount: count,
  progressPercent: z.number().int().min(0).max(100),
})
export const candidatesSchema = z.object({
  items: z.array(
    z.object({
      selectionId: z.string().min(1),
      externalId: z.string(),
      title: z.string(),
      startedAt: z.string(),
      duplicateType: z.enum(['NONE', 'SAME_CONTENT', 'CONTENT_UPDATED']),
      selectable: z.boolean(),
      validationCode: z.string().nullable(),
    }),
  ),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: count,
})
export const analysisItemsSchema = z.object({
  items: z.array(
    z.object({
      itemId: id,
      conversationId: id,
      conversationVersionId: id,
      status: z.string(),
      scopeClassification: z.string().nullable(),
      failureCode: z.string().nullable(),
      feedbackIds: z.array(id),
    }),
  ),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: count,
})
export const analysisStatusSchema = z.object({
  status,
  progress: z.number().finite(),
  failReason: z.string().nullish(),
  savedCount: count.nullish().transform((value) => value ?? undefined),
  skippedDuplicateCount: count.nullish().transform((value) => value ?? undefined),
})
export const historySchema = z.object({
  content: z.array(
    z.object({
      uploadId: id,
      uploadedAt: z.string(),
      analyzedCount: count,
      period: z
        .object({ from: z.string(), to: z.string() })
        .nullish()
        .transform((value) => value ?? null),
      status,
    }),
  ),
  page: count,
  size: count.positive(),
  totalElements: count,
})
export const feedbackListSchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      feedbacks: z.array(
        z.object({
          feedbackId: id,
          type: z.string(),
          title: z.string(),
          occurrenceCount: count,
          myReaction: reaction.nullish().transform((value) => value ?? null),
          isShared: z.boolean(),
        }),
      ),
    }),
  ),
})
export const feedbackSchema = z.object({
  feedbackId: id,
  type: z.string(),
  title: z.string(),
  problem: z.string(),
  causes: z.array(z.string()),
  improvement: z.string(),
  example,
  evidences: z.array(z.object({ conversationId: id, turnIndexes: z.array(count) })),
})
export const conversationSchema = z.object({
  title: z.string(),
  startedAt: z.string(),
  model: z.string(),
  messages: z.array(
    z.object({
      idx: count,
      role: z.string(),
      content: z.string(),
      isRework: z.boolean().optional(),
    }),
  ),
  highlightIndexes: z.array(count),
})
export const sharedCasesSchema = z.object({
  items: z.array(
    z.object({
      feedbackId: id,
      taskType: z.string(),
      type: z.string(),
      title: z.string(),
      problem: z.string(),
      improvement: z.string(),
      example,
      isGuide: z.boolean(),
    }),
  ),
})
export const guidesSchema = z.object({
  groups: z.array(
    z.object({
      type: z.string(),
      guides: z.array(
        z.object({
          feedbackId: id,
          title: z.string(),
          problem: z.string(),
          improvement: z.string(),
          example,
          guideAddedAt: z.string(),
        }),
      ),
    }),
  ),
})
export const shareSchema = z.object({ isShared: z.boolean() })

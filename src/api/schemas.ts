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
const status = z.enum(['UPLOADED', 'ANALYZING', 'DONE', 'FAILED'])
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
  taskTypes: z.array(
    z.object({
      id: id.optional(),
      taskTypeId: id.optional(),
      name: z.string(),
      successDefinition: z.string(),
    }),
  ),
  targetFrom: nullableDate,
  targetTo: nullableDate,
  onboardingStartDate: nullableDate,
  targetCount: nullableNumber,
  minDailyConversations: count.optional(),
  hourlyLaborCost: count.optional(),
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
export const analysisStartSchema = z.object({ uploadId: id, status })
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

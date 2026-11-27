import { z } from 'zod'
import { request } from './client'

export const taskLimit = 6000
export const promptLimit = 4000

export interface PromptComparisonInput {
  task: string
  baselinePrompt: string
  improvedPrompt: string
}

const configuration = z.object({ configured: z.boolean(), model: z.string() })
const tokenCount = z.number().int().nonnegative()
const usage = z
  .object({
    inputTokens: tokenCount,
    outputTokens: tokenCount,
    totalTokens: tokenCount,
    cachedInputTokens: tokenCount.nullable(),
  })
  .refine(
    (value) =>
      value.inputTokens + value.outputTokens === value.totalTokens &&
      (value.cachedInputTokens == null || value.cachedInputTokens <= value.inputTokens),
  )
const run = z
  .object({
    status: z.enum(['COMPLETED', 'INCOMPLETE', 'REFUSED', 'FAILED']),
    model: z.string().nullable(),
    output: z.string().nullable(),
    usage: usage.nullable(),
    message: z.string().nullable(),
    providerIds: z
      .object({ requestId: z.string().nullable(), responseId: z.string().nullable() })
      .nullish(),
  })
  .refine(
    (value) =>
      value.status !== 'COMPLETED' || Boolean(value.model && value.output?.trim() && value.usage),
  )
const comparison = z.object({ baseline: run, improved: run })

export type PromptRun = z.infer<typeof run>
export type PromptComparisonResult = z.infer<typeof comparison>

export const promptComparisonApi = {
  configuration: (teamId: string, signal?: AbortSignal) =>
    request(`/teams/${teamId}/prompt-comparison`, { signal, validate: configuration.parse }),
  compare: (teamId: string, input: PromptComparisonInput) =>
    request(`/teams/${teamId}/prompt-comparison`, {
      method: 'POST',
      json: input,
      timeoutMs: 25000,
      validate: comparison.parse,
    }),
}

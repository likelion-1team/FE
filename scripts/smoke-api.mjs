// Public documentation and an unauthenticated GET only. Does not create server data.
const origin = (process.env.API_ORIGIN || 'https://t0k1.duckdns.org').replace(/\/$/, '')
const response = await fetch(`${origin}/v3/api-docs`)
if (!response.ok) throw new Error(`OpenAPI: ${response.status}`)
const schema = await response.json()
const emailCheckMethod = (process.env.VITE_EMAIL_CHECK_METHOD || 'GET').toLowerCase()
if (!['post', 'get'].includes(emailCheckMethod))
  throw new Error('VITE_EMAIL_CHECK_METHOD must be POST or GET')
const required = [
  ['post', '/api/v1/auth/login'],
  [emailCheckMethod, '/api/v1/auth/email-check'],
  ['post', '/api/v1/auth/refresh'],
  ['get', '/api/v1/teams'],
  ['get', '/api/v1/teams/{teamId}/settings'],
  ['put', '/api/v1/teams/{teamId}/settings'],
  ['get', '/api/v1/uploads/{uploadId}/conversations'],
  ['get', '/api/v1/analyses/{analysisId}'],
  ['get', '/api/v1/analyses/{analysisId}/items'],
  ['post', '/api/v1/teams/{teamId}/uploads'],
  ['post', '/api/v1/uploads/{uploadId}/analyses'],
  ['get', '/api/v1/teams/{teamId}/feedbacks'],
  ['delete', '/api/v1/feedbacks/{feedbackId}/reaction'],
]
for (const [method, path] of required) {
  if (!schema.paths[path]?.[method])
    throw new Error(`Contract missing: ${method.toUpperCase()} ${path}`)
}
for (const [name, fields] of [
  ['TeamSettingsResponse', ['version', 'taskType', 'policies']],
  ['TeamSettingsUpdateRequest', ['expectedVersion', 'taskType']],
  ['AnalysisStartRequest', ['settingsVersion', 'selections']],
  ['CandidateSelection', ['selectionId', 'taskTypeId']],
  ['AnalysisStartResponse', ['analysisId', 'status', 'pollAfterSeconds']],
]) {
  for (const field of fields) {
    if (!schema.components?.schemas?.[name]?.properties?.[field])
      throw new Error(`Contract missing: ${name}.${field}`)
  }
}
const protectedResponse = await fetch(`${origin}/api/v1/users/me`)
if (protectedResponse.status !== 401)
  throw new Error(`Expected unauthenticated 401, got ${protectedResponse.status}`)
console.log(`PASS: HTTPS OpenAPI, ${required.length} required operations, protected endpoint 401.`)
console.log(
  'Authentication, mutations, and personal data were not exercised against the live server.',
)

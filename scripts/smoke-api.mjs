// Public documentation and an unauthenticated GET only. Does not create server data.
const origin = (process.env.API_ORIGIN || 'https://t0k1.duckdns.org').replace(/\/$/, '')
const response = await fetch(`${origin}/v3/api-docs`)
if (!response.ok) throw new Error(`OpenAPI: ${response.status}`)
const schema = await response.json()
const required = [
  ['post', '/api/v1/auth/login'],
  ['post', '/api/v1/auth/email-check'],
  ['post', '/api/v1/auth/refresh'],
  ['get', '/api/v1/teams'],
  ['post', '/api/v1/teams/{teamId}/uploads'],
  ['post', '/api/v1/uploads/{uploadId}/analyses'],
  ['get', '/api/v1/teams/{teamId}/feedbacks'],
  ['delete', '/api/v1/feedbacks/{feedbackId}/reaction'],
]
for (const [method, path] of required) {
  if (!schema.paths[path]?.[method])
    throw new Error(`Contract missing: ${method.toUpperCase()} ${path}`)
}
const protectedResponse = await fetch(`${origin}/api/v1/users/me`)
if (protectedResponse.status !== 401)
  throw new Error(`Expected unauthenticated 401, got ${protectedResponse.status}`)
console.log(`PASS: HTTPS OpenAPI, ${required.length} required operations, protected endpoint 401.`)
console.log(
  'Authentication, mutations, and personal data were not exercised against the live server.',
)

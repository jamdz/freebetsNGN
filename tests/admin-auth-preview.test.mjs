import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import bcrypt from 'bcryptjs'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export%20%7B%7D', shortCircuit: true }
    if (specifier === 'next/headers') {
      return {
        url: 'data:text/javascript,export%20const%20cookies%3Dasync()%3D%3Eundefined;export%20const%20headers%3Dasync()%3D%3Enew%20Headers()',
        shortCircuit: true,
      }
    }
    return nextResolve(specifier, context)
  },
})

const auth = await import('../lib/admin-auth.ts')

function setEnvironment(values) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

test('admin preview environment detection and sessions stay out of Production', async (t) => {
  const names = ['VERCEL_ENV', 'NODE_ENV', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'ADMIN_PATH']
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  t.after(() => setEnvironment(previous))

  process.env.NODE_ENV = 'development'
  process.env.VERCEL_ENV = 'production'
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://project.v0.build')), false)

  process.env.NODE_ENV = 'production'
  process.env.VERCEL_ENV = 'preview'
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://production.example.com')), true)

  delete process.env.VERCEL_ENV
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://project.v0.build')), true)
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://production.example.com', { headers: { 'x-forwarded-host': 'project.v0.build' } })), false)
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://project.v0.app')), true)
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://project.v0.dev')), true)
  assert.equal(auth.isNonProductionAdminEnv(new Request('https://project.vusercontent.net')), true)

  process.env.ADMIN_EMAIL = 'preview-admin@example.test'
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('preview-test-password', 4)
  process.env.ADMIN_SESSION_SECRET = 'test-only-session-secret-with-more-than-32-chars'
  process.env.ADMIN_PATH = 'internal/admin'

  const previewRequest = new Request('https://project.v0.build/api/admin/login')
  const credentials = await auth.verifyAdminCredentials('PREVIEW-ADMIN@example.test', 'preview-test-password', previewRequest)
  assert.equal(credentials.valid, true)
  assert.equal(credentials.admin, null)
  assert.equal(credentials.adminUsersRowCount, null)
  const session = await auth.createAdminSession(credentials.email, previewRequest)
  assert.equal(session.stateless, true)
  assert.equal(await auth.verifyAdminSession(session.cookie, previewRequest), true)

  process.env.VERCEL_ENV = 'production'
  const productionRequest = new Request('https://project.v0.build/api/admin/session')
  assert.equal(await auth.verifyAdminSession(session.cookie, productionRequest), false)
})

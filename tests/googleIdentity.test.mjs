import { test } from 'node:test'
import assert from 'node:assert/strict'

let moduleId = 0
async function fixture(t) {
  const scripts = []
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  globalThis.window = {}
  globalThis.document = {
    createElement: () => ({ remove() { scripts.splice(scripts.indexOf(this), 1) } }),
    head: { appendChild(script) { scripts.push(script) } },
  }
  t.after(() => {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
  })
  const { loadGoogleIdentity } = await import(`../src/lib/googleIdentity.ts?test=${moduleId++}`)
  const loaded = () => {
    window.google = { accounts: { id: { renderButton() {} } } }
    scripts.at(-1).onload()
    return window.google.accounts.id
  }
  return { scripts, loadGoogleIdentity, loaded }
}

test('route remounts share a request and slow SDK loads still resolve after 10 seconds', async (t) => {
  const { scripts, loadGoogleIdentity, loaded } = await fixture(t)
  const first = loadGoogleIdentity()
  assert.equal(loadGoogleIdentity(), first)
  assert.equal(scripts.length, 1)
  t.mock.timers.tick(12_000)
  const id = loaded()
  assert.equal(await first, id)
  assert.equal(await loadGoogleIdentity(), id)
  assert.equal(scripts.length, 1)
})

test('network failure removes the failed script and allows a successful retry', async (t) => {
  const { scripts, loadGoogleIdentity, loaded } = await fixture(t)
  const first = loadGoogleIdentity()
  const rejected = assert.rejects(first, /failed to load/)
  scripts[0].onerror()
  await rejected
  assert.equal(scripts.length, 0)
  const retry = loadGoogleIdentity()
  assert.equal(scripts.length, 1)
  const id = loaded()
  assert.equal(await retry, id)
})

test('a blocked SDK times out and does not poison subsequent attempts', async (t) => {
  const { scripts, loadGoogleIdentity, loaded } = await fixture(t)
  const first = loadGoogleIdentity()
  const rejected = assert.rejects(first, /timed out/)
  t.mock.timers.tick(30_000)
  await rejected
  assert.equal(scripts.length, 0)
  const retry = loadGoogleIdentity()
  const id = loaded()
  assert.equal(await retry, id)
})

test('a load event without the Google API is reported as a recoverable failure', async (t) => {
  const { scripts, loadGoogleIdentity } = await fixture(t)
  const first = loadGoogleIdentity()
  const rejected = assert.rejects(first, /unavailable/)
  scripts[0].onload()
  await rejected
  assert.equal(scripts.length, 0)
})

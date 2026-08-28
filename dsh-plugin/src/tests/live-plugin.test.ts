import assert from 'node:assert/strict'
import test from 'node:test'
import { bindLoaderHost, loaderHost, setLivePluginDisabled, type LoaderEntry } from '../live-plugin.js'

function entry(name: string, opts?: { fiber?: unknown; fail?: boolean }): LoaderEntry & { calls: unknown[] } {
  const rec: LoaderEntry & { calls: unknown[] } = {
    options: { name },
    fiber: opts?.fiber,
    calls: [],
    async update(patch) {
      rec.calls.push(patch)
      if (opts?.fail) throw new Error('nope')
      rec.options = { ...rec.options, disabled: patch.disabled }
      rec.fiber = patch.disabled ? undefined : rec.fiber ?? {}
    },
  }
  return rec
}

test('setLivePluginDisabled returns false without a loader', async () => {
  bindLoaderHost(undefined)
  assert.equal(loaderHost(), undefined)
  assert.equal(await setLivePluginDisabled('whale-girl', true), false)
  assert.equal(await setLivePluginDisabled('whale-girl', true, {}), false)
})

test('setLivePluginDisabled flips matching entries and skips others', async () => {
  const whale = entry('whale-girl', { fiber: {} })
  const other = entry('other', { fiber: {} })
  const host = { loader: { entries: () => [whale, other, { options: { name: 'whale-girl' } }] } }
  assert.equal(await setLivePluginDisabled('whale-girl', true, host), true)
  assert.deepEqual(whale.calls, [{ disabled: true }])
  assert.equal(whale.fiber, undefined)
  assert.equal(other.calls.length, 0)
})

test('setLivePluginDisabled re-enables and uses the bound host', async () => {
  const whale = entry('whale-girl', { fiber: undefined })
  whale.fiber = undefined
  bindLoaderHost({ loader: { entries: () => [whale] } })
  assert.equal(await setLivePluginDisabled('whale-girl', false), true)
  assert.deepEqual(whale.calls, [{ disabled: null }])
  assert.ok(whale.fiber)
})

test('setLivePluginDisabled returns false when update throws', async () => {
  const whale = entry('whale-girl', { fiber: {}, fail: true })
  assert.equal(await setLivePluginDisabled('whale-girl', true, { loader: { entries: () => [whale] } }), false)
})

test('setLivePluginDisabled retries while the fiber is still live', async () => {
  let n = 0
  const rec: LoaderEntry = {
    options: { name: 'whale-girl' },
    fiber: {},
    async update(patch) {
      n += 1
      rec.options = { ...rec.options, disabled: patch.disabled }
      if (n >= 2) rec.fiber = undefined
    },
  }
  const ok = await setLivePluginDisabled('whale-girl', true, { loader: { entries: () => [rec] } })
  assert.equal(ok, true)
  assert.equal(n, 2)
  assert.equal(rec.fiber, undefined)
})

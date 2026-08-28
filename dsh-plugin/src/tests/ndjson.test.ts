import assert from 'node:assert/strict'
import test from 'node:test'
import { createProgressTracker } from '../ndjson.js'

function feed(lines: string[]) {
  const tracker = createProgressTracker()
  for (const line of lines) tracker.feed(line)
  return tracker.snapshot
}

test('tracks stage to phase transitions', () => {
  const snap = feed([
    '{"time":1,"name":"pnpm:stage","prefix":"p","stage":"resolution_started"}',
    '{"time":2,"name":"pnpm:stage","prefix":"p","stage":"resolution_done"}',
    '{"time":3,"name":"pnpm:stage","prefix":"p","stage":"importing_started"}',
    '{"time":4,"name":"pnpm:stage","prefix":"p","stage":"importing_done"}',
  ])
  assert.equal(snap.seen, true)
  assert.equal(snap.phase, 'linking')
})

test('counts distinct packages and follows fetch progress', () => {
  const snap = feed([
    '{"time":1,"name":"pnpm:progress","packageId":"file:../pkg","status":"resolved"}',
    '{"time":2,"name":"pnpm:progress","packageId":"is-odd@3.0.1","status":"resolved"}',
    '{"time":3,"name":"pnpm:progress","packageId":"is-odd@3.0.1","status":"fetched"}',
    '{"time":4,"name":"pnpm:fetching-progress","packageId":"esbuild@0.25.0","status":"started","size":10123456}',
    '{"time":5,"name":"pnpm:fetching-progress","packageId":"esbuild@0.25.0","status":"in_progress","downloaded":5000000}',
  ])
  assert.equal(snap.phase, 'downloading')
  assert.equal(snap.done, 3)
  assert.equal(snap.currentPackage, 'esbuild@0.25.0')
  assert.equal(snap.size, 10123456)
  assert.equal(snap.downloaded, 5000000)
})

test('lifecycle events switch to building and name the package', () => {
  const snap = feed([
    JSON.stringify({
      time: 1,
      name: 'pnpm:lifecycle',
      depPath: 'esbuild@0.25.0',
      wd: 'C:\\app\\node_modules\\.pnpm\\esbuild@0.25.0\\node_modules\\esbuild',
    }),
  ])
  assert.equal(snap.phase, 'building')
  assert.match(String(snap.currentPackage), /esbuild/)
})

test('stats events mark linking; errors and junk are tolerated', () => {
  const tracker = createProgressTracker()
  tracker.feed('not json')
  tracker.feed('{"name":"pnpm:stats","added":1}')
  tracker.feed('{"name":"pnpm","level":"error","err":{"message":"boom"}}')
  tracker.feed('{"name":"other"}')
  assert.equal(tracker.snapshot.phase, 'linking')
  assert.equal(tracker.snapshot.error, 'boom')
  tracker.reset()
  assert.equal(tracker.snapshot.seen, false)
  assert.equal(tracker.snapshot.phase, null)
})

test('found_in_store counts as a download and empty ids are ignored', () => {
  const snap = feed([
    '{"name":"pnpm:progress","packageId":"left-pad@1","status":"found_in_store"}',
    '{"name":"pnpm:progress","status":"resolved"}',
    'null',
    '{"name":1}',
  ])
  assert.equal(snap.phase, 'downloading')
  assert.equal(snap.done, 1)
})

test('covers remaining stage, lifecycle, stats, and error branches', () => {
  const tracker = createProgressTracker()
  tracker.feed('{"name":"pnpm:stage","stage":"resolution_started"}')
  assert.equal(tracker.snapshot.phase, 'resolving')
  tracker.feed('{"name":"pnpm:stage","stage":"other"}')
  assert.equal(tracker.snapshot.phase, 'resolving')
  tracker.feed('{"name":"pnpm:progress","packageId":"a@1","status":"resolved"}')
  assert.equal(tracker.snapshot.done, 1)
  tracker.feed('{"name":"pnpm:fetching-progress"}')
  tracker.feed('{"name":"pnpm:lifecycle","depPath":"esbuild@1"}')
  assert.equal(tracker.snapshot.phase, 'building')
  assert.equal(tracker.snapshot.currentPackage, 'esbuild@1')
  tracker.feed('{"name":"pnpm:lifecycle"}')
  assert.equal(tracker.snapshot.currentPackage, 'esbuild@1')
  tracker.feed('{"name":"pnpm:stats"}')
  assert.equal(tracker.snapshot.phase, 'building')
  tracker.feed('{"name":"pnpm","level":"error","err":{}}')
  assert.equal(tracker.snapshot.error, null)
})

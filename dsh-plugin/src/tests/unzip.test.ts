import assert from 'node:assert/strict'
import test from 'node:test'
import { unzipToFiles } from '../unzip.js'
import { makeDeflatedZip, makeDescriptorZip, makeStoredZip } from './helpers/zip.js'

test('unzipToFiles reads stored entries', () => {
  const files = unzipToFiles(makeStoredZip({ 'SKILL.md': '# skill', 'refs/a.md': 'a' }))
  assert.equal(files['SKILL.md'].toString(), '# skill')
  assert.equal(files['refs/a.md'].toString(), 'a')
})

test('unzipToFiles skips directory entries', () => {
  const files = unzipToFiles(makeStoredZip({ 'docs/': '', 'docs/a.md': 'ok' }))
  assert.equal(files['docs/'], undefined)
  assert.equal(files['docs/a.md'].toString(), 'ok')
})

test('unzipToFiles rejects garbage', () => {
  assert.throws(() => unzipToFiles(Buffer.alloc(40, 7)), /不是有效的 zip 包/)
})

test('unzipToFiles rejects truncated local data', () => {
  const zip = makeDeflatedZip({ 'a.txt': 'hello world' })
  assert.throws(() => unzipToFiles(zip.subarray(0, 40)), /截断|不是有效/)
})

test('unzipToFiles reads data-descriptor zip from central directory', () => {
  const files = unzipToFiles(makeDescriptorZip({
    'SKILL.md': '---\nname: report\n---\nbody',
    'references/t.md': 'tpl',
  }))
  assert.equal(files['SKILL.md'].toString(), '---\nname: report\n---\nbody')
  assert.equal(files['references/t.md'].toString(), 'tpl')
})

test('unzipToFiles rejects unsupported compression method', () => {
  const name = Buffer.from('x.txt')
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(12, 8)
  header.writeUInt32LE(1, 18)
  header.writeUInt32LE(1, 22)
  header.writeUInt16LE(name.length, 26)
  const zip = Buffer.concat([header, name, Buffer.from('z'), Buffer.from([0x50, 0x4b, 0x01, 0x02])])
  assert.throws(() => unzipToFiles(zip), /不支持的 zip 压缩方法/)
})

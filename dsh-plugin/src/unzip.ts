import { inflateRawSync } from 'node:zlib'

const LOCAL = 0x04034b50
const CENTRAL = 0x02014b50
const EOCD = 0x06054b50

export function unzipToFiles(buf: Buffer): Record<string, Buffer> {
  const eocd = findEocd(buf)
  return eocd >= 0 ? unzipFromCentral(buf, eocd) : unzipFromLocal(buf)
}

function unzipFromCentral(buf: Buffer, eocd: number): Record<string, Buffer> {
  const count = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  const out: Record<string, Buffer> = {}
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CENTRAL) throw new Error('不是有效的 zip 包')
    const method = buf.readUInt16LE(offset + 10)
    const compSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localOff = buf.readUInt32LE(offset + 42)
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')
    offset += 46 + nameLen + extraLen + commentLen
    if (!name || name.endsWith('/')) continue
    out[name] = readEntry(buf, localOff, method, compSize, name)
  }
  return out
}

function unzipFromLocal(buf: Buffer): Record<string, Buffer> {
  const out: Record<string, Buffer> = {}
  let offset = 0
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset)
    if (sig === CENTRAL || sig === EOCD) break
    if (sig !== LOCAL) throw new Error('不是有效的 zip 包')
    const gp = buf.readUInt16LE(offset + 6)
    const method = buf.readUInt16LE(offset + 8)
    const compSize = buf.readUInt32LE(offset + 18)
    const nameLen = buf.readUInt16LE(offset + 26)
    const extraLen = buf.readUInt16LE(offset + 28)
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8')
    const dataStart = offset + 30 + nameLen + extraLen
    if (gp & 0x8) throw new Error('zip 包缺少中央目录')
    const dataEnd = dataStart + compSize
    if (dataEnd > buf.length) throw new Error('zip 包已截断')
    if (name && !name.endsWith('/')) out[name] = inflateEntry(buf.subarray(dataStart, dataEnd), method, name)
    offset = dataEnd
  }
  return out
}

function readEntry(buf: Buffer, localOff: number, method: number, compSize: number, name: string): Buffer {
  if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== LOCAL) throw new Error(`zip 条目损坏: ${name}`)
  const nameLen = buf.readUInt16LE(localOff + 26)
  const extraLen = buf.readUInt16LE(localOff + 28)
  const dataStart = localOff + 30 + nameLen + extraLen
  const dataEnd = dataStart + compSize
  if (dataEnd > buf.length) throw new Error('zip 包已截断')
  return inflateEntry(buf.subarray(dataStart, dataEnd), method, name)
}

function inflateEntry(compressed: Buffer, method: number, name: string): Buffer {
  if (method === 0) return Buffer.from(compressed)
  if (method !== 8) throw new Error(`不支持的 zip 压缩方法 ${method}`)
  try {
    return inflateRawSync(compressed)
  } catch {
    throw new Error(`zip 解压失败: ${name}`)
  }
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 22 - 65535)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) !== EOCD) continue
    const commentLen = buf.readUInt16LE(i + 20)
    if (i + 22 + commentLen === buf.length) return i
  }
  return -1
}

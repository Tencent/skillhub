import { deflateRawSync } from 'node:zlib'

export function makeDeflatedZip(files: Record<string, string>): Buffer {
  const chunks: Buffer[] = []
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text)
    const compressed = deflateRawSync(raw)
    const nameBuf = Buffer.from(name)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(8, 8)
    header.writeUInt32LE(compressed.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(nameBuf.length, 26)
    chunks.push(header, nameBuf, compressed)
  }
  chunks.push(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  return Buffer.concat(chunks)
}

export function makeStoredZip(files: Record<string, string>): Buffer {
  const chunks: Buffer[] = []
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text)
    const nameBuf = Buffer.from(name)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt32LE(raw.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(nameBuf.length, 26)
    chunks.push(header, nameBuf, raw)
  }
  chunks.push(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  return Buffer.concat(chunks)
}

export function makeDescriptorZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text)
    const compressed = deflateRawSync(raw)
    const nameBuf = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(nameBuf.length, 26)
    const desc = Buffer.alloc(16)
    desc.writeUInt32LE(0x08074b50, 0)
    desc.writeUInt32LE(compressed.length, 8)
    desc.writeUInt32LE(raw.length, 12)
    const chunk = Buffer.concat([local, nameBuf, compressed, desc])
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(chunk)
    centrals.push(central, nameBuf)
    offset += chunk.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  const n = Object.keys(files).length
  eocd.writeUInt16LE(n, 8)
  eocd.writeUInt16LE(n, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

// A minimal ZIP writer for the project export (T58). Files are stored
// without compression: the exported projects are small, every unzip tool
// reads stored entries, and no extra library is needed.

export interface ZipEntry {
  /** Path inside the archive, with forward slashes. */
  path: string
  data: Uint8Array
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** MS-DOS date and time, as ZIP stores them. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((Math.max(date.getFullYear(), 1980) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  }
}

class ByteWriter {
  private readonly chunks: Uint8Array[] = []
  length = 0

  u16(value: number): void {
    this.bytes(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]))
  }

  u32(value: number): void {
    this.bytes(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    )
  }

  bytes(data: Uint8Array): void {
    this.chunks.push(data)
    this.length += data.length
  }

  result(): Uint8Array<ArrayBuffer> {
    const output = new Uint8Array(this.length)
    let offset = 0
    for (const chunk of this.chunks) {
      output.set(chunk, offset)
      offset += chunk.length
    }
    return output
  }
}

/** Bit 11: file names are UTF-8. */
const UTF8_FLAG = 0x0800
const STORED = 0
const VERSION = 20

/** Builds a ZIP archive from the entries. */
export function createZip(
  entries: readonly ZipEntry[],
  modified = new Date(),
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const stamp = dosDateTime(modified)
  const out = new ByteWriter()
  const central = new ByteWriter()

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const crc = crc32(entry.data)
    const offset = out.length

    out.u32(0x04034b50) // local file header
    out.u16(VERSION)
    out.u16(UTF8_FLAG)
    out.u16(STORED)
    out.u16(stamp.time)
    out.u16(stamp.date)
    out.u32(crc)
    out.u32(entry.data.length)
    out.u32(entry.data.length)
    out.u16(name.length)
    out.u16(0)
    out.bytes(name)
    out.bytes(entry.data)

    central.u32(0x02014b50) // central directory header
    central.u16(VERSION)
    central.u16(VERSION)
    central.u16(UTF8_FLAG)
    central.u16(STORED)
    central.u16(stamp.time)
    central.u16(stamp.date)
    central.u32(crc)
    central.u32(entry.data.length)
    central.u32(entry.data.length)
    central.u16(name.length)
    central.u16(0) // extra field length
    central.u16(0) // comment length
    central.u16(0) // disk number
    central.u16(0) // internal attributes
    central.u32(0) // external attributes
    central.u32(offset)
    central.bytes(name)
  }

  const centralOffset = out.length
  const centralBytes = central.result()
  out.bytes(centralBytes)
  out.u32(0x06054b50) // end of central directory
  out.u16(0)
  out.u16(0)
  out.u16(entries.length)
  out.u16(entries.length)
  out.u32(centralBytes.length)
  out.u32(centralOffset)
  out.u16(0)
  return out.result()
}

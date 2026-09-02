/**
 * A ZIP writer, small enough to read in one sitting.
 *
 * It exists because an `.xlsx` is a ZIP of XML parts and nothing else: the only
 * way to hand an operator a spreadsheet with real dropdowns in it is to write
 * that container. Pulling a spreadsheet library in for one template would add
 * megabytes to the client bundle to do what the eighty lines below do.
 *
 * Entries are STORED, never deflated. A menu template is a few kilobytes of
 * XML, so the compression would save nothing worth a `DecompressionStream`
 * dependency, and stored entries are what keeps this readable - Excel, Numbers
 * and Google Sheets all open them.
 *
 * Output is deterministic: the timestamp is fixed rather than `Date.now()`, so
 * the same input bytes produce the same file and a test can assert on it.
 *
 * Runs in the browser and in Node: no `Buffer`, no `node:zlib`.
 */

export type ZipEntry = {
  /** Path inside the archive, `/`-separated. ASCII only. */
  path: string;
  data: Uint8Array;
};

/** 1980-01-01 00:00, the earliest a DOS timestamp can express. */
const DOS_TIME = 0;
const DOS_DATE = 0x21;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_DIRECTORY_SIGNATURE = 0x06054b50;

/** Version 2.0: the minimum that reads a stored entry. */
const VERSION = 20;

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;

  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  crcTable = table;

  return table;
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** Little-endian, because that is the byte order the format is written in. */
class ByteWriter {
  private readonly bytes: number[] = [];

  get length() {
    return this.bytes.length;
  }

  u16(value: number) {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
  }

  u32(value: number) {
    this.bytes.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff
    );
  }

  raw(values: Uint8Array) {
    for (const value of values) this.bytes.push(value);
  }

  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
}

export function buildZip(entries: readonly ZipEntry[]) {
  const encoder = new TextEncoder();
  const writer = new ByteWriter();
  const directory: Array<{
    name: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }> = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);

    directory.push({
      name,
      crc,
      size: entry.data.length,
      offset: writer.length
    });

    writer.u32(LOCAL_HEADER_SIGNATURE);
    writer.u16(VERSION);
    writer.u16(0); // flags
    writer.u16(0); // stored
    writer.u16(DOS_TIME);
    writer.u16(DOS_DATE);
    writer.u32(crc);
    writer.u32(entry.data.length); // compressed
    writer.u32(entry.data.length); // uncompressed
    writer.u16(name.length);
    writer.u16(0); // extra field length
    writer.raw(name);
    writer.raw(entry.data);
  }

  const directoryOffset = writer.length;

  for (const record of directory) {
    writer.u32(CENTRAL_HEADER_SIGNATURE);
    writer.u16(VERSION); // version made by
    writer.u16(VERSION); // version needed
    writer.u16(0); // flags
    writer.u16(0); // stored
    writer.u16(DOS_TIME);
    writer.u16(DOS_DATE);
    writer.u32(record.crc);
    writer.u32(record.size);
    writer.u32(record.size);
    writer.u16(record.name.length);
    writer.u16(0); // extra field length
    writer.u16(0); // comment length
    writer.u16(0); // disk number
    writer.u16(0); // internal attributes
    writer.u32(0); // external attributes
    writer.u32(record.offset);
    writer.raw(record.name);
  }

  // Measured before the trailer is written, so the trailer's own bytes cannot
  // creep into the size it reports.
  const directorySize = writer.length - directoryOffset;

  writer.u32(END_OF_DIRECTORY_SIGNATURE);
  writer.u16(0); // this disk
  writer.u16(0); // disk holding the directory
  writer.u16(directory.length);
  writer.u16(directory.length);
  writer.u32(directorySize);
  writer.u32(directoryOffset);
  writer.u16(0); // comment length

  return writer.toUint8Array();
}

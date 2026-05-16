import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type {
  DictionaryAsset,
  DictionaryAudioAsset,
  DictionaryEntry,
  DictionarySearchResult,
  DictionaryStatus,
} from "../../src/data/dictionary";
import { parseDictionaryRecordHtml } from "./html";

interface KeyBlockInfo {
  entries: number;
  compressedSize: number;
}

interface KeyEntry {
  key: string;
  recordOffset: number;
}

interface RawDictionaryRecord {
  key: string;
  html: string;
}

interface RawSearchRecord extends RawDictionaryRecord {
  exact: boolean;
  matchedKey: string;
}

interface RecordBlockInfo {
  compressedOffset: number;
  compressedSize: number;
  decompressedOffset: number;
  decompressedSize: number;
}

interface DictionaryPackManifest {
  packPath: string;
  mdxPath: string;
  mdxName: string;
  files: DictionaryStatus["files"];
}

const UTF8 = "utf8";
const UTF16LE = "utf16le";
const MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function inspectDictionaryPack(packPath: string): DictionaryPackManifest | null {
  const stat = safeStat(packPath);
  if (!stat?.isDirectory()) return null;

  const mdxPath = firstExisting(packPath, ["oald10.mdxbak", "oald10_og.mdx"]);
  if (!mdxPath) return null;

  const files: DictionaryPackManifest["files"] = [
    {
      name: path.basename(mdxPath),
      bytes: fs.statSync(mdxPath).size,
      role: "entries",
    },
  ];

  for (const name of ["oald10.1.mdd", "oald10.2.mdd", "oald10_og.mdd", "oald10.mdd"]) {
    const filePath = path.join(packPath, name);
    const fileStat = safeStat(filePath);
    if (!fileStat?.isFile()) continue;
    files.push({
      name,
      bytes: fileStat.size,
      role: name.includes(".1.") || name.includes(".2.") ? "audio" : "assets",
    });
  }

  return {
    packPath,
    mdxPath,
    mdxName: path.basename(mdxPath),
    files,
  };
}

export class DictionaryPack {
  readonly packPath: string;
  private readonly mdx: MdxFile;
  private readonly mddPaths: string[];
  private mddFiles: MddFile[] | null = null;

  constructor(manifest: DictionaryPackManifest) {
    this.packPath = manifest.packPath;
    this.mdx = new MdxFile(manifest.mdxPath);
    this.mddPaths = ["oald10.1.mdd", "oald10.2.mdd", "oald10_og.mdd", "oald10.mdd"]
      .map((name) => path.join(manifest.packPath, name))
      .filter((filePath) => safeStat(filePath)?.isFile());
  }

  status(): DictionaryStatus {
    const manifest = inspectDictionaryPack(this.packPath);
    return {
      active: true,
      packPath: this.packPath,
      entryCount: this.mdx.entryCount,
      sourceFile: path.basename(this.mdx.filePath),
      files: manifest?.files ?? [],
      message: null,
    };
  }

  search(query: string, limit: number): DictionarySearchResult[] {
    return this.mdx.search(query, limit).map((record) => {
      const entry = parseDictionaryRecordHtml(
        record.key,
        record.html,
        path.basename(this.mdx.filePath),
      );
      return {
        key: entry.key,
        label: entry.headword,
        exact: record.exact,
        posLabel: entry.posLabel,
        posKey: entry.posKey,
      };
    });
  }

  lookup(term: string): DictionaryEntry | null {
    const record = this.mdx.lookup(term);
    if (!record) return null;
    const entry = parseDictionaryRecordHtml(
      record.key,
      record.html,
      path.basename(this.mdx.filePath),
    );
    return {
      ...entry,
      related: this.mdx.related(entry.headword, entry.key, 12).map((related) => {
        const parsed = parseDictionaryRecordHtml(
          related.key,
          related.html,
          path.basename(this.mdx.filePath),
        );
        return {
          key: parsed.key,
          label: parsed.headword,
          exact: false,
          posLabel: parsed.posLabel,
          posKey: parsed.posKey,
        };
      }),
    };
  }

  audio(ref: string): DictionaryAudioAsset | null {
    return this.asset(ref);
  }

  asset(ref: string): DictionaryAsset | null {
    const assetKey = toAssetKey(ref);
    if (!assetKey) return null;
    for (const mdd of this.getMddFiles()) {
      const data = mdd.lookup(assetKey);
      if (!data) continue;
      const mime = MIME_BY_EXT[path.extname(assetKey).toLowerCase()] ?? "application/octet-stream";
      return {
        dataUrl: `data:${mime};base64,${data.toString("base64")}`,
        mime,
      };
    }
    return null;
  }

  private getMddFiles(): MddFile[] {
    if (!this.mddFiles) {
      this.mddFiles = this.mddPaths.map((filePath) => new MddFile(filePath));
    }
    return this.mddFiles;
  }
}

class MdxFile {
  readonly filePath: string;
  readonly entryCount: number;
  private readonly buffer: Buffer;
  private readonly keys: KeyEntry[];
  private readonly lowerKeys: string[];
  private readonly keyIndex: Map<string, number>;
  private readonly recordBlocks: RecordBlockInfo[];
  private readonly recordCache = new Map<number, Buffer>();
  private readonly sourceEncoding: BufferEncoding;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.buffer = fs.readFileSync(filePath);
    const parsed = parseDictionaryFile(this.buffer, UTF8);
    this.entryCount = parsed.entryCount;
    this.keys = parsed.keys;
    this.lowerKeys = parsed.keys.map((entry) => entry.key.toLowerCase());
    this.recordBlocks = parsed.recordBlocks;
    this.sourceEncoding = parsed.sourceEncoding;
    this.keyIndex = new Map();
    this.lowerKeys.forEach((key, index) => {
      if (!this.keyIndex.has(key)) this.keyIndex.set(key, index);
    });
  }

  search(query: string, limit: number): RawSearchRecord[] {
    const normalized = normalizeQuery(query);
    if (!normalized) return [];

    const results: RawSearchRecord[] = [];
    const seen = new Set<string>();
    const push = (index: number) => {
      const key = this.keys[index]?.key;
      if (!key) return;
      const record = this.lookup(key);
      if (!record || seen.has(record.key)) return;
      seen.add(record.key);
      results.push({
        ...record,
        exact: this.lowerKeys[index] === normalized || normalizeQuery(record.key) === normalized,
        matchedKey: key,
      });
    };

    for (let i = 0; i < this.lowerKeys.length && results.length < limit; i += 1) {
      if (this.lowerKeys[i]?.startsWith(normalized)) push(i);
    }
    for (let i = 0; i < this.lowerKeys.length && results.length < limit; i += 1) {
      if (hasBoundaryMatch(this.lowerKeys[i] ?? "", normalized)) push(i);
    }
    if (results.length === 0) {
      for (let i = 0; i < this.lowerKeys.length && results.length < limit; i += 1) {
        if (this.lowerKeys[i]?.includes(normalized)) push(i);
      }
    }

    return results;
  }

  lookup(term: string): RawDictionaryRecord | null {
    return this.resolveLookup(term, new Set());
  }

  related(headword: string, currentKey: string, limit: number): RawSearchRecord[] {
    const stems = familyStems(headword);
    if (stems.length === 0) return [];

    const scored: Array<{ index: number; score: number }> = [];
    for (let index = 0; index < this.lowerKeys.length; index += 1) {
      const key = this.lowerKeys[index];
      if (!key || key === normalizeQuery(currentKey)) continue;
      const compact = compactFamilyKey(key);
      const score = familyScore(compact, stems);
      if (score > 0) scored.push({ index, score });
    }

    const results: RawSearchRecord[] = [];
    const seen = new Set([normalizeQuery(currentKey)]);
    for (const item of scored
      .sort((a, b) => {
        const keyA = this.keys[a.index]?.key ?? "";
        const keyB = this.keys[b.index]?.key ?? "";
        return b.score - a.score || keyA.localeCompare(keyB);
      })
      .slice(0, limit * 5)) {
      const matchedKey = this.keys[item.index]?.key;
      if (!matchedKey) continue;
      const record = this.lookup(matchedKey);
      if (!record || seen.has(normalizeQuery(record.key))) continue;
      seen.add(normalizeQuery(record.key));
      results.push({ ...record, exact: false, matchedKey });
      if (results.length >= limit) break;
    }
    return results;
  }

  private resolveLookup(term: string, seen: Set<string>): RawDictionaryRecord | null {
    const raw = this.rawLookup(term);
    if (!raw) return null;
    const target = linkTarget(raw.html);
    if (!target) return raw;
    const normalizedTarget = normalizeQuery(target);
    if (seen.has(normalizedTarget)) return null;
    seen.add(normalizedTarget);
    return this.resolveLookup(target, seen);
  }

  private rawLookup(term: string): RawDictionaryRecord | null {
    const index = this.findKeyIndex(term);
    if (index === null) return null;

    const start = this.keys[index]?.recordOffset;
    if (start === undefined) return null;
    let next = index + 1;
    while (next < this.keys.length && this.keys[next]?.recordOffset === start) next += 1;
    const end = this.keys[next]?.recordOffset ?? totalDecompressedSize(this.recordBlocks);
    const blockIndex = findRecordBlock(this.recordBlocks, start);
    if (blockIndex === null) return null;

    const block = this.recordBlock(blockIndex);
    const blockInfo = this.recordBlocks[blockIndex];
    if (!blockInfo) return null;
    return {
      key: this.keys[index]?.key ?? term,
      html: block
        .subarray(start - blockInfo.decompressedOffset, end - blockInfo.decompressedOffset)
        .toString(this.sourceEncoding),
    };
  }

  private findKeyIndex(term: string): number | null {
    const normalized = normalizeQuery(term);
    if (!normalized) return null;
    const direct = this.keyIndex.get(normalized);
    if (direct !== undefined) return direct;

    const hyphen = normalized.replace(/\s+/g, "-");
    const spaced = normalized.replace(/[-_]+/g, " ");
    return this.keyIndex.get(hyphen) ?? this.keyIndex.get(spaced) ?? null;
  }

  private recordBlock(index: number): Buffer {
    const cached = this.recordCache.get(index);
    if (cached) return cached;
    const info = this.recordBlocks[index];
    if (!info) throw new Error(`Missing dictionary record block ${index}`);
    const block = decompressBlock(
      this.buffer.subarray(info.compressedOffset, info.compressedOffset + info.compressedSize),
    );
    this.recordCache.set(index, block);
    return block;
  }
}

class MddFile {
  private readonly filePath: string;
  private readonly keys: KeyEntry[];
  private readonly keyIndex: Map<string, number>;
  private readonly recordBlocks: RecordBlockInfo[];

  constructor(filePath: string) {
    this.filePath = filePath;
    const fd = fs.openSync(filePath, "r");
    try {
      const parsed = parseDictionaryFileFromFd(fd, UTF16LE);
      this.keys = parsed.keys;
      this.recordBlocks = parsed.recordBlocks;
      this.keyIndex = new Map();
      this.keys.forEach((entry, index) => {
        this.keyIndex.set(entry.key.toLowerCase(), index);
      });
    } finally {
      fs.closeSync(fd);
    }
  }

  lookup(assetKey: string): Buffer | null {
    const index = this.keyIndex.get(assetKey.toLowerCase());
    if (index === undefined) return null;
    const start = this.keys[index]?.recordOffset;
    if (start === undefined) return null;
    let next = index + 1;
    while (next < this.keys.length && this.keys[next]?.recordOffset === start) next += 1;
    const end = this.keys[next]?.recordOffset ?? totalDecompressedSize(this.recordBlocks);
    const blockIndex = findRecordBlock(this.recordBlocks, start);
    if (blockIndex === null) return null;

    const fd = fs.openSync(this.filePath, "r");
    try {
      const info = this.recordBlocks[blockIndex];
      if (!info) return null;
      const block = decompressBlock(readAt(fd, info.compressedOffset, info.compressedSize));
      return block.subarray(start - info.decompressedOffset, end - info.decompressedOffset);
    } finally {
      fs.closeSync(fd);
    }
  }
}

function parseDictionaryFile(buffer: Buffer, keyEncoding: BufferEncoding) {
  let offset = 0;
  const headerSize = buffer.readUInt32BE(offset);
  offset += 4 + headerSize + 4;
  const parsed = parseDictionarySections({
    read: (position, length) => buffer.subarray(position, position + length),
    offset,
    keyEncoding,
    fileSize: buffer.length,
  });
  return parsed;
}

function parseDictionaryFileFromFd(fd: number, keyEncoding: BufferEncoding) {
  const headerSize = readAt(fd, 0, 4).readUInt32BE(0);
  const offset = 4 + headerSize + 4;
  const stat = fs.fstatSync(fd);
  return parseDictionarySections({
    read: (position, length) => readAt(fd, position, length),
    offset,
    keyEncoding,
    fileSize: stat.size,
  });
}

function parseDictionarySections(input: {
  read: (position: number, length: number) => Buffer;
  offset: number;
  keyEncoding: BufferEncoding;
  fileSize: number;
}) {
  let offset = input.offset;
  const keyHeader = input.read(offset, 44);
  offset += 44;
  const keyBlockCount = readUInt64BE(keyHeader, 0);
  const entryCount = readUInt64BE(keyHeader, 8);
  const keyInfoCompressedSize = readUInt64BE(keyHeader, 24);
  const keyBlocksCompressedSize = readUInt64BE(keyHeader, 32);
  const keyInfo = decompressBlock(input.read(offset, keyInfoCompressedSize));
  offset += keyInfoCompressedSize;
  const keyBlocks = parseKeyInfo(keyInfo, keyBlockCount, input.keyEncoding);
  const keys = parseKeys(input.read, offset, keyBlocks, input.keyEncoding);
  offset += keyBlocksCompressedSize;

  const recordHeader = input.read(offset, 32);
  offset += 32;
  const recordBlockCount = readUInt64BE(recordHeader, 0);
  const recordInfoSize = readUInt64BE(recordHeader, 16);
  const recordBlocksOffset = offset + recordInfoSize;
  const recordBlocks = parseRecordBlocks(
    input.read(offset, recordInfoSize),
    recordBlockCount,
    recordBlocksOffset,
  );

  return {
    entryCount,
    keys,
    recordBlocks,
    sourceEncoding: UTF8 as BufferEncoding,
    fileSize: input.fileSize,
  };
}

function parseKeyInfo(
  keyInfo: Buffer,
  keyBlockCount: number,
  encoding: BufferEncoding,
): KeyBlockInfo[] {
  const charBytes = encoding === UTF16LE ? 2 : 1;
  const terminatorBytes = charBytes;
  const blocks: KeyBlockInfo[] = [];
  let offset = 0;

  for (let i = 0; i < keyBlockCount; i += 1) {
    const entries = readUInt64BE(keyInfo, offset);
    offset += 8;
    const firstSize = keyInfo.readUInt16BE(offset) * charBytes;
    offset += 2 + firstSize + terminatorBytes;
    const lastSize = keyInfo.readUInt16BE(offset) * charBytes;
    offset += 2 + lastSize + terminatorBytes;
    const compressedSize = readUInt64BE(keyInfo, offset);
    offset += 8;
    offset += 8;
    blocks.push({ entries, compressedSize });
  }

  return blocks;
}

function parseKeys(
  read: (position: number, length: number) => Buffer,
  startOffset: number,
  keyBlocks: KeyBlockInfo[],
  encoding: BufferEncoding,
): KeyEntry[] {
  const keys: KeyEntry[] = [];
  let offset = startOffset;
  for (const block of keyBlocks) {
    const data = decompressBlock(read(offset, block.compressedSize));
    offset += block.compressedSize;
    let cursor = 0;
    for (let i = 0; i < block.entries; i += 1) {
      const recordOffset = readUInt64BE(data, cursor);
      cursor += 8;
      const parsed = readTerminatedString(data, cursor, encoding);
      cursor = parsed.next;
      keys.push({ key: parsed.text, recordOffset });
    }
  }
  return keys;
}

function parseRecordBlocks(
  recordInfo: Buffer,
  recordBlockCount: number,
  compressedOffsetStart: number,
): RecordBlockInfo[] {
  const blocks: RecordBlockInfo[] = [];
  let cursor = 0;
  let compressedOffset = compressedOffsetStart;
  let decompressedOffset = 0;

  for (let i = 0; i < recordBlockCount; i += 1) {
    const compressedSize = readUInt64BE(recordInfo, cursor);
    cursor += 8;
    const decompressedSize = readUInt64BE(recordInfo, cursor);
    cursor += 8;
    blocks.push({
      compressedOffset,
      compressedSize,
      decompressedOffset,
      decompressedSize,
    });
    compressedOffset += compressedSize;
    decompressedOffset += decompressedSize;
  }

  return blocks;
}

function readTerminatedString(buffer: Buffer, offset: number, encoding: BufferEncoding) {
  if (encoding === UTF16LE) {
    let end = offset;
    while (end + 1 < buffer.length && !(buffer[end] === 0 && buffer[end + 1] === 0)) end += 2;
    return {
      text: buffer.subarray(offset, end).toString(UTF16LE),
      next: end + 2,
    };
  }

  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) end += 1;
  return {
    text: buffer.subarray(offset, end).toString(UTF8),
    next: end + 1,
  };
}

function decompressBlock(block: Buffer): Buffer {
  const type = block.readUInt32LE(0);
  const body = block.subarray(8);
  if (type === 0) return body;
  if (type === 2) return zlib.inflateSync(body);
  throw new Error(`Unsupported MDict compression type ${type}`);
}

function readUInt64BE(buffer: Buffer, offset: number): number {
  return Number(buffer.readBigUInt64BE(offset));
}

function readAt(fd: number, position: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, position);
  return buffer;
}

function findRecordBlock(blocks: RecordBlockInfo[], recordOffset: number): number | null {
  const index = blocks.findIndex(
    (block) =>
      recordOffset >= block.decompressedOffset &&
      recordOffset < block.decompressedOffset + block.decompressedSize,
  );
  return index >= 0 ? index : null;
}

function totalDecompressedSize(blocks: RecordBlockInfo[]): number {
  const last = blocks.at(-1);
  return last ? last.decompressedOffset + last.decompressedSize : 0;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasBoundaryMatch(key: string, query: string): boolean {
  const index = key.indexOf(query);
  if (index <= 0) return false;
  return /[\s_-]/.test(key[index - 1] ?? "");
}

function linkTarget(html: string): string | null {
  const trimmed = html.replace(/\0/g, "").trim();
  const match = trimmed.match(/^@@@LINK=(.+)$/i);
  return match?.[1]?.trim() || null;
}

function familyStems(headword: string): string[] {
  const compact = compactFamilyKey(headword);
  if (compact.length < 4) return [];
  const stems = new Set([compact]);
  if (compact.endsWith("e") && compact.length > 4) stems.add(compact.slice(0, -1));
  if (compact.endsWith("y") && compact.length > 4) stems.add(`${compact.slice(0, -1)}i`);
  return [...stems].filter((stem) => stem.length >= 4);
}

function compactFamilyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\s-]+\d+$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function familyScore(compactKey: string, stems: string[]): number {
  let best = 0;
  for (const stem of stems) {
    if (compactKey === stem) best = Math.max(best, 100);
    else if (compactKey.startsWith(stem)) best = Math.max(best, 80 - compactKey.length * 0.01);
    else if (compactKey.includes(stem)) best = Math.max(best, 55 - compactKey.length * 0.01);
  }
  return best;
}

function toAssetKey(ref: string): string | null {
  const withoutScheme = ref.replace(/^sound:\/\//i, "").replace(/^asset:\/\//i, "");
  const clean = decodeURIComponent(withoutScheme).replace(/^[/\\]+/, "");
  return clean ? `\\${clean}` : null;
}

function firstExisting(root: string, names: string[]): string | null {
  for (const name of names) {
    const filePath = path.join(root, name);
    if (safeStat(filePath)?.isFile()) return filePath;
  }
  return null;
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

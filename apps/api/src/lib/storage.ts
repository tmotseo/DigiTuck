import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
export interface PrivateStorage { put(key: string, bytes: Buffer, mime: string): Promise<void>; get(key: string): Promise<Buffer>; remove(key: string): Promise<void> }
const validKey = (key: string) => { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid private key'); return key }
export function localStorage(directory: string): PrivateStorage {
  const file = (key: string) => resolve(directory, validKey(key))
  return {
    async put(key, bytes) { await mkdir(directory, { recursive: true, mode: 0o700 }); await writeFile(file(key), bytes, { flag: 'wx', mode: 0o600 }) },
    async get(key) { return readFile(file(key)) },
    async remove(key) { await unlink(file(key)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error }) }
  }
}
export function s3Storage(options: { bucket: string; region: string; endpoint?: string }): PrivateStorage {
  const client = new S3Client({ region: options.region, endpoint: options.endpoint })
  return {
    async put(key, bytes, mime) { await client.send(new PutObjectCommand({ Bucket: options.bucket, Key: 'private/' + validKey(key), Body: bytes, ContentType: mime, ServerSideEncryption: 'AES256' })) },
    async get(key) { const response = await client.send(new GetObjectCommand({ Bucket: options.bucket, Key: 'private/' + validKey(key) })); if (!response.Body) throw new Error('Object missing'); return Buffer.from(await response.Body.transformToByteArray()) },
    async remove(key) { await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: 'private/' + validKey(key) })) }
  }
}


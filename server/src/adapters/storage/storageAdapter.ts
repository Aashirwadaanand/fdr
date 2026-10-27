import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredDocument {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256Hash: string;
  storagePath: string;
}

export interface IStorageAdapter {
  saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredDocument>;
  getFile(storagePath: string): Promise<Buffer>;
  deleteFile(storagePath: string): Promise<boolean>;
  computeHash(buffer: Buffer): string;
}

export class LocalDiskStorageAdapter implements IStorageAdapter {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir || path.join(__dirname, '../../../../uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public computeHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredDocument> {
    const hash = this.computeHash(buffer);
    const ext = path.extname(originalName) || '.pdf';
    const filename = `${Date.now()}_${hash.substring(0, 12)}${ext}`;
    const storagePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(storagePath, buffer);

    return {
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      sha256Hash: hash,
      storagePath,
    };
  }

  public async getFile(storagePath: string): Promise<Buffer> {
    return fs.promises.readFile(storagePath);
  }

  public async deleteFile(storagePath: string): Promise<boolean> {
    try {
      if (fs.existsSync(storagePath)) {
        await fs.promises.unlink(storagePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const storageAdapter: IStorageAdapter = new LocalDiskStorageAdapter();

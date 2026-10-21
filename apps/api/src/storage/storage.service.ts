import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { Injectable, Logger } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { loadConfig } from '../config';

export interface StoredFile {
  stream: Readable;
  contentType: string;
  size: number;
}

/**
 * Private file storage (Azure Blob Storage; Azurite locally). The container is never
 * public: files only leave through API endpoints that check the caller's tenant.
 * Keys always start with the tenant id.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private container: Promise<ContainerClient> | null = null;

  private client(): Promise<ContainerClient> {
    this.container ??= (async () => {
      const config = loadConfig();
      const container = BlobServiceClient.fromConnectionString(
        config.AZURE_STORAGE_CONNECTION_STRING,
      ).getContainerClient(config.AZURE_STORAGE_CONTAINER);
      await container.createIfNotExists(); // private: no public access level
      return container;
    })().catch((error: unknown) => {
      this.container = null; // retry on the next call
      throw error;
    });
    return this.container;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const container = await this.client();
    await container.getBlockBlobClient(key).uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  async get(key: string): Promise<StoredFile> {
    const container = await this.client();
    const res = await container.getBlockBlobClient(key).download();
    return {
      stream: res.readableStreamBody as Readable,
      contentType: res.contentType ?? 'application/octet-stream',
      size: res.contentLength ?? 0,
    };
  }

  /** Best effort: a leftover file is harmless, a failed request is not. */
  async delete(key: string): Promise<void> {
    try {
      const container = await this.client();
      await container.getBlockBlobClient(key).deleteIfExists();
    } catch (error) {
      this.logger.warn(`Could not delete ${key}: ${String(error)}`);
    }
  }
}

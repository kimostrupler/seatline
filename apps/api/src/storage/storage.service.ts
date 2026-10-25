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

  /** The file as a stream, or null if there is none. */
  async get(key: string): Promise<StoredFile | null> {
    const container = await this.client();
    try {
      const res = await container.getBlockBlobClient(key).download();
      return {
        stream: res.readableStreamBody as Readable,
        contentType: res.contentType ?? 'application/octet-stream',
        size: res.contentLength ?? 0,
      };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return null;
      throw error;
    }
  }

  /** The whole file, or null if there is none. */
  async read(key: string): Promise<Buffer | null> {
    const container = await this.client();
    try {
      return await container.getBlockBlobClient(key).downloadToBuffer();
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return null;
      throw error;
    }
  }

  /** Copy a stored file to a new key (e.g. a floor plan for a copied floor). */
  async copy(from: string, to: string): Promise<void> {
    const container = await this.client();
    const data = await container.getBlockBlobClient(from).downloadToBuffer();
    const props = await container.getBlockBlobClient(from).getProperties();
    await this.put(to, data, props.contentType ?? 'application/octet-stream');
  }

  /** Best effort: a leftover file is harmless, a failed request is not. */
  /** Every file under a prefix (a deleted workspace's `<tenantId>/`); best effort. */
  async deletePrefix(prefix: string): Promise<void> {
    try {
      const container = await this.client();
      for await (const blob of container.listBlobsFlat({ prefix }))
        await container.getBlockBlobClient(blob.name).deleteIfExists();
    } catch (error) {
      this.logger.warn(`Could not delete ${prefix}*: ${String(error)}`);
    }
  }

  /**
   * Nightly: plan imports nobody applied or discarded (the tab was closed) — their images wait
   * under <tenant>/floors/<id>/imports/ — are deleted after `days`. Returns how many.
   */
  async deleteOldImports(days: number, now = new Date()): Promise<number> {
    const container = await this.client();
    const cutoff = now.getTime() - days * 86_400_000;
    let n = 0;
    for await (const blob of container.listBlobsFlat())
      if (/^[^/]+\/floors\/[^/]+\/imports\//.test(blob.name)) {
        const at = (blob.properties.createdOn ?? blob.properties.lastModified).getTime();
        if (
          at < cutoff &&
          (await container.getBlockBlobClient(blob.name).deleteIfExists()).succeeded
        )
          n++;
      }
    return n;
  }

  /** Owner dashboard: how much is stored (floor plans, and imports waiting to be applied). */
  async usage() {
    const container = await this.client();
    const out = { bytes: 0, files: 0, imports: { bytes: 0, files: 0 } };
    for await (const blob of container.listBlobsFlat()) {
      const size = blob.properties.contentLength ?? 0;
      out.bytes += size;
      out.files++;
      if (blob.name.includes('/imports/')) {
        out.imports.bytes += size;
        out.imports.files++;
      }
    }
    return out;
  }

  async delete(key: string): Promise<void> {
    try {
      const container = await this.client();
      await container.getBlockBlobClient(key).deleteIfExists();
    } catch (error) {
      this.logger.warn(`Could not delete ${key}: ${String(error)}`);
    }
  }
}

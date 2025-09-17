const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const FsProvider = require('./providers/fs');
const PgProvider = require('./providers/postgres');

function ensureReadable(payload) {
    if (!payload && payload !== 0) {
        throw new Error('No payload provided for storage');
    }
    if (Buffer.isBuffer(payload) || typeof payload === 'string' || typeof payload === 'number') {
        return Readable.from(Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)));
    }
    if (payload && typeof payload.pipe === 'function') {
        return payload; // Readable stream
    }
    throw new Error('Unsupported payload type. Use Buffer, string, number, or Readable stream.');
}

class StorageCore {
    /**
     * @param {Object} config
     * @param {('fs'|'pg')} config.provider
     * @param {Object} [config.fs]
     * @param {string} [config.fs.baseDir]
     * @param {Object} [config.pg]
     * @param {string} [config.pg.connectionString]
     * @param {string} [config.pg.schema]
     * @param {string} [config.pg.table]
     */
    constructor(config = {}) {
        this.config = config;
        const p = config.provider || 'fs';
        if (p === 'fs') this.provider = new FsProvider(config.fs || {});
        else if (p === 'pg') this.provider = new PgProvider(config.pg || {});
        else throw new Error(`Unknown provider: ${p}`);
    }

    async init() {
        if (typeof this.provider.init === 'function') {
            await this.provider.init();
        }
    }

    /** Store a file */
    async store(payload, file = {}) {
        const stream = ensureReadable(payload);
        const id = uuidv4();
        const info = {
            id,
            filename: file.filename || id,
            contentType: file.contentType || 'application/octet-stream',
            metadata: file.metadata || {},
            createdAt: new Date().toISOString(),
        };
        const result = await this.provider.store(stream, info);
        return { ...info, ...result, storage: this.config.provider || 'fs' };
    }

    /** Get a file by id */
    async get(id, options = { as: 'stream' }) {
        if (!id) throw new Error('id is required');
        return this.provider.get(id, options);
    }

    /** Delete a file by id */
    async delete(id) {
        if (!id) throw new Error('id is required');
        await this.provider.delete(id);
        return { id, deleted: true };
    }
}

module.exports = StorageCore;

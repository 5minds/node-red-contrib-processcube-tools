const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream');
const { createHash } = require('crypto');
const { promisify } = require('util');
const pump = promisify(pipeline);

class FsProvider {
    constructor(opts = {}) {
        this.baseDir = opts.baseDir || path.resolve(process.cwd(), 'data');
    }

    async init() {
        await fsp.mkdir(this.baseDir, { recursive: true });
    }

    _buildPaths(id) {
        const d = new Date();
        const parts = [
            String(d.getUTCFullYear()),
            String(d.getUTCMonth() + 1).padStart(2, '0'),
            String(d.getUTCDate()).padStart(2, '0'),
        ];
        const dir = path.join(this.baseDir, ...parts);
        const filePath = path.join(dir, id);
        const metaPath = path.join(dir, `${id}.json`);
        return { dir, filePath, metaPath };
    }

    async store(readable, info) {
        const { id, filename, contentType, metadata, createdAt } = info;
        const { dir, filePath, metaPath } = this._buildPaths(id);
        await fsp.mkdir(dir, { recursive: true });

        const hash = createHash('sha256');
        let size = 0;

        const out = fs.createWriteStream(filePath);
        readable.on('data', (chunk) => {
            hash.update(chunk);
            size += chunk.length;
        });

        await pump(readable, out);

        const sha256 = hash.digest('hex');
        const meta = { id, filename, contentType, size, sha256, metadata, createdAt };
        await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2));

        return { size, sha256, path: filePath };
    }

    async get(id, options = { as: 'stream' }) {
        // Find meta file by searching dated folders
        const meta = await this._findMeta(id);
        if (!meta) throw new Error(`File not found: ${id}`);
        const filePath = meta.__filePath;

        if (options.as === 'path') {
            return { meta, payload: filePath };
        }

        if (options.as === 'buffer') {
            const buf = await fsp.readFile(filePath);
            return { meta, payload: buf };
        }

        // default: stream
        const stream = fs.createReadStream(filePath);
        return { meta, payload: stream };
    }

    async delete(id) {
        const meta = await this._findMeta(id);
        if (!meta) return; // idempotent
        await fsp.unlink(meta.__filePath).catch(() => {});
        await fsp.unlink(meta.__metaPath).catch(() => {});
    }

    async _findMeta(id) {
        // Walk date folders (YYYY/MM/DD). For Performance: keep index/cache in prod.
        const years = await this._ls(this.baseDir);
        for (const y of years) {
            const yearDir = path.join(this.baseDir, y);
            const months = await this._ls(yearDir);
            for (const m of months) {
                const monthDir = path.join(yearDir, m);
                const days = await this._ls(monthDir);
                for (const d of days) {
                    const dir = path.join(monthDir, d);
                    const metaPath = path.join(dir, `${id}.json`);
                    try {
                        const raw = await fsp.readFile(metaPath, 'utf-8');
                        const meta = JSON.parse(raw);
                        meta.__metaPath = metaPath;
                        meta.__filePath = path.join(dir, id);
                        return meta;
                    } catch (_) {
                        /* continue */
                    }
                }
            }
        }
        return null;
    }

    async _ls(dir) {
        try {
            return (await fsp.readdir(dir)).filter((n) => !n.startsWith('.'));
        } catch {
            return [];
        }
    }
}

module.exports = FsProvider;

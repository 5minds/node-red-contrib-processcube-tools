const { Pool } = require('pg');
const { LargeObjectManager } = require('pg-large-object');
const { pipeline, PassThrough } = require('stream');
const { createHash } = require('crypto');
const { promisify } = require('util');
const pump = promisify(pipeline);

class PgProvider {
    constructor(opts = {}) {
        // this.connectionString = opts.connectionString || process.env.PG_URL || 'postgres://localhost/postgres';
        this.schema = opts.schema || 'public';
        this.table = opts.table || 'files';
        // this.pool = new Pool({ connectionString: this.connectionString });
        this.pool = new Pool();
    }

    async init() {
        const client = await this.pool.connect();
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS ${this.schema}.${this.table} (
        id UUID PRIMARY KEY,
        loid OID NOT NULL,
        filename TEXT,
        content_type TEXT,
        size BIGINT,
        sha256 TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
            await client.query(
                `CREATE INDEX IF NOT EXISTS idx_${this.table}_created_at ON ${this.schema}.${this.table}(created_at)`,
            );
        } finally {
            client.release();
        }
    }

    async store(readable, info) {
    const { id, filename, contentType, metadata, createdAt } = info;
    const client = await this.pool.connect();
    try {
        const lom = new LargeObjectManager({pg: client});
        await client.query('BEGIN');
        const bufSize = 16384;
        
        const result = await lom.createAndWritableStreamAsync(bufSize);
        const oid =result[0];
        const stream = result[1];
        if (!oid || !stream) {
            throw new Error('Failed to create large object');
        }
        const hash = createHash('sha256');
        let size = 0;

        // Wir berechnen Hash und Größe "on the fly", während wir in das Large Object schreiben
        const hashAndSize = new PassThrough();
        hashAndSize.on('data', (chunk) => {
            hash.update(chunk);
            size += chunk.length;
        });

        // readable -> hashAndSize -> stream
        const pipelinePromise = pump(readable, hashAndSize, stream);

        await pipelinePromise;

        const sha256 = hash.digest('hex');

        await client.query(
            `INSERT INTO ${this.schema}.${this.table} (id, loid, filename, content_type, size, sha256, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
            [id, oid, filename, contentType, size, sha256, JSON.stringify(metadata || {}), createdAt],
        );

        await client.query('COMMIT');
        return { size, sha256, oid };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

    async get(id, options = { as: 'stream' }) {
        const client = await this.pool.connect();
        try {
            const { rows } = await client.query(`SELECT * FROM ${this.schema}.${this.table} WHERE id=$1`, [id]);
            if (rows.length === 0) throw new Error(`File not found: ${id}`);
            const meta = rows[0];

            const bufSize = 16384;
            if (options.as === 'buffer') {
                // Stream LO into memory
                await client.query('BEGIN');
                const lom = new LargeObjectManager({ pg: client });
                
                const ro = await lom.openAndReadableStreamAsync(meta.loid, bufSize);
                const totalSize = ro[0];
                const stream = ro[1];
                if (!stream) {
                    throw new Error('Failed to open large object for reading');
                }   
                const chunks = [];
                stream.on('data', (c) => chunks.push(c));
                await new Promise((res, rej) => stream.on('end', res).on('error', rej));
                await client.query('COMMIT');
                client.release();
                return { meta, payload: Buffer.concat(chunks) };
            }

            if (options.as === 'path') {
                throw new Error('options.as="path" is not supported by Postgres provider');
            }

            // default: stream – wrap LO stream so we can close txn when done
            await client.query('BEGIN');
            const lom = new LargeObjectManager({ pg: client });
            const ro = await lom.openAndReadableStreamAsync(meta.loid, bufSize);
            const totalSize = ro[0];
            const stream = ro[1];
            const pass = new PassThrough();
            stream.pipe(pass);
            const done = new Promise((res, rej) => pass.on('end', res).on('error', rej));
            done.finally(async () => {
                await client.query('COMMIT').catch(() => {});
                client.release();
            });
            
            // Do not release here; we release in finally of wrapper. We return early, so prevent double release.
            return { meta, payload: pass };
        } catch (err) {
            
            throw err;
        }
    }

    async delete(id) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(`DELETE FROM ${this.schema}.${this.table} WHERE id=$1 RETURNING loid`, [
                id,
            ]);
            if (rows.length) {
                const lom = new LargeObjectManager({ pg: client });
                await lom.unlinkAsync(rows[0].loid);
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = PgProvider;

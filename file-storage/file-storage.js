/**
 * # File Storage Node
 *
 * A Node-RED node for storing, retrieving, and deleting files (including metadata) using either the local filesystem or PostgreSQL (Large Objects + metadata table) as a backend.
 *
 * ## Features
 * - **Providers:**
 *   - Filesystem (stores file and metadata as JSON)
 *   - PostgreSQL (stores file as Large Object and metadata in a table)
 * - **Actions:**
 *   - Store a file
 *   - Retrieve a file
 *   - Delete a file
 * - **Flexible output:**
 *   - Stream, Buffer, or Path (filesystem only)
 *
 * ## Node Properties
 * - **Name:** Optional node label.
 * - **Provider:** Select between `Filesystem` and `PostgreSQL`.
 * - **Output:** Choose the output type for retrieval: `Stream`, `Buffer`, or `Path` (Path only for filesystem).
 * - **Base Dir:** (Filesystem) Directory where files are stored.
 * - **Connection:** (PostgreSQL) Connection string for the database.
 * - **Schema:** (PostgreSQL) Database schema (default: `public`).
 * - **Table:** (PostgreSQL) Table for metadata (default: `files`).
 * - **Default Action:** Default action if not specified in the message (`store`, `get`, or `delete`).
 *
 * ## Input
 * The node expects the following properties in the incoming message:
 * ```
 * msg.action = "store" | "get" | "delete" // Optional, overrides defaultAction
 * msg.payload = Buffer | ReadableStream | String // For "store"
 * msg.file = {
 *   id?: string,         // For "get" or "delete"
 *   filename?: string,   // For "store"
 *   contentType?: string,// For "store"
 *   metadata?: object    // For "store"
 * }
 * ```
 *
 * ## Output
 * - For **store**:
 *   - `msg.payload` contains metadata including the generated `id`.
 *   - `msg.file` contains the merged file info and result.
 * - For **get**:
 *   - `msg.payload` contains the file as a Stream, Buffer, or Path (depending on output setting).
 *   - `msg.file` contains the file metadata.
 * - For **delete**:
 *   - `msg.payload` contains the result of the delete operation.
 *
 * ## Example Usage
 * // Store a file:
 * msg.action = "store";
 * msg.payload = Buffer.from("Hello World");
 * msg.file = {
 *   filename: "hello.txt",
 *   contentType: "text/plain",
 *   metadata: { author: "Alice" }
 * };
 *
 * // Retrieve a file:
 * msg.action = "get";
 * msg.file = { id: "your-file-id" };
 *
 * // Delete a file:
 * msg.action = "delete";
 * msg.file = { id: "your-file-id" };
 *
 * ## Notes
 * - For PostgreSQL, ensure the connection string, schema, and table exist and the user has the necessary permissions.
 * - For filesystem storage, ensure the base directory is writable by Node-RED.
 * - The node is designed to handle large files efficiently using streams.
 *
 * Enjoy using the File Storage Node in your Node-RED flows!
 */
module.exports = function (RED) {
    const StorageCore = require('../storage/storage-core');

    function FileStorageNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Node-Konfiguration
        node.provider = config.provider || 'fs';
        node.baseDir = config.baseDir;
        node.pg = {
            username:  RED.util.evaluateNodeProperty(config.username, config.usernameType, node) || 'postgres',
            password: RED.util.evaluateNodeProperty(config.password, config.passwordType, node) || 'postgres',
            host: RED.util.evaluateNodeProperty(config.host, config.hostType, node) || 'localhost',
            port: RED.util.evaluateNodeProperty(config.port, config.portType, node) || 5432,
            database: RED.util.evaluateNodeProperty(config.database, config.databaseType, node) || 'postgres',
            schema: config.pgSchema || 'public',
            table: config.pgTable || 'files',
        };
        node.outputAs = config.outputAs || 'stream'; // 'stream' | 'buffer' | 'path' (path nur fs)

        // Storage-Kern
        const storage = new StorageCore({
            provider: node.provider,
            fs: { baseDir: node.baseDir },
            pg: node.pg,
        });

        storage.init().catch((err) => node.error(err));

        node.on('input', async function (msg, send, done) {
            try {
                const action = msg.action || config.defaultAction || 'store';
                if (action === 'store') {
                    const file = msg.file || {};
                    const result = await storage.store(msg.payload, file);
                    msg.payload = result;
                    msg.file = { ...file, ...result };
                    send(msg);
                    done();
                    return;
                }

                if (action === 'get') {
                    const id = msg.file && msg.file.id;
                    if (!id) throw new Error('file.id is required for get');
                    const { meta, payload } = await storage.get(id, { as: node.outputAs });
                    msg.file = { ...meta, id: meta.id };
                    msg.payload = payload;
                    send(msg);
                    done();
                    return;
                }

                if (action === 'delete') {
                    const id = msg.file && msg.file.id;
                    if (!id) throw new Error('file.id is required for delete');
                    const result = await storage.delete(id);
                    msg.payload = result;
                    send(msg);
                    done();
                    return;
                }

                throw new Error(`Unknown action: ${action}`);
            } catch (err) {
                node.error(err, msg);
                if (done) done(err);
            }
        });
    }

    RED.nodes.registerType('file-storage', FileStorageNode);
};

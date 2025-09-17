module.exports = function (RED) {
    const StorageCore = require('../storage/storage-core');

    function FileStorageNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Node-Konfiguration
        node.provider = config.provider || 'fs';
        node.baseDir = config.baseDir;
        node.pg = {
            connectionString: config.pgConnectionString,
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

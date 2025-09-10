module.exports = function(RED) {
    const Imap = require('node-imap');
    const mailparser = require('mailparser');

    function EmailReceiverNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.on('input', function(msg) {
            // Retrieve and validate configuration values
            const imap_host = RED.util.evaluateNodeProperty(config.host, config.hostType, node, msg);
            const imap_port = RED.util.evaluateNodeProperty(config.port, config.portType, node, msg);
            const imap_tls = RED.util.evaluateNodeProperty(config.tls, config.tlsType, node, msg);
            const imap_user = RED.util.evaluateNodeProperty(config.user, config.userType, node, msg);
            const imap_password = RED.util.evaluateNodeProperty(config.password, config.passwordType, node, msg);

            // Check if the folder is actually an array
            const imap_folder = RED.util.evaluateNodeProperty(config.folder, config.folderType, node, msg);
            let folders;
            if (Array.isArray(imap_folder)) {
                folders = imap_folder;
            } else if (typeof imap_folder === 'string') {
                folders = imap_folder.split(',').map(f => f.trim()).filter(f => f.length > 0);
            } else {
                const errorMsg = "The 'folders' property must be an array of strings or a comma-separated string.";
                node.status({ fill: 'red', shape: 'ring', text: errorMsg });
                node.error(errorMsg, msg);
                return;
            }
            const imap_markSeen = RED.util.evaluateNodeProperty(config.markseen, config.markseenType, node, msg);

            const finalConfig = {
                host: imap_host,
                port: (typeof imap_port === 'string') ? parseInt(imap_port, 10) : imap_port,
                tls: imap_tls,
                user: imap_user,
                password: imap_password,
                folders: (Array.isArray(imap_folder)) ? imap_folder : imap_folder.split(',').map(f => f.trim()).filter(f => f.length > 0),
                markSeen: imap_markSeen,
                connTimeout: msg.imap_connTimeout || 10000,
                authTimeout: msg.imap_authTimeout || 5000,
                keepalive: msg.imap_keepalive !== undefined ? msg.imap_keepalive : true,
                autotls: msg.imap_autotls || 'never',
                tlsOptions: msg.imap_tlsOptions || { rejectUnauthorized: false }
            };

            if (!finalConfig.user || !finalConfig.password || !finalConfig.port || !finalConfig.host || !finalConfig.folders) {
                const errorMessage = 'Missing required IMAP config (user, password, port, host, or folders missing). Aborting.';
                node.status({ fill: 'red', shape: 'ring', text: 'missing config' });
                node.error(errorMessage);
                return;
            }

            const fetchEmails = ({
                host,
                port,
                tls,
                user,
                password,
                folders,
                markSeen = true,
                connTimeout = 10000,
                authTimeout = 5000,
                keepalive = true,
                autotls = 'never',
                tlsOptions = { rejectUnauthorized: false }
            }, onMail) => {
                const imap = new Imap({
                    user,
                    password,
                    host,
                    port,
                    tls,
                    connTimeout,
                    authTimeout,
                    keepalive,
                    autotls,
                    tlsOptions
                });

                const state = {
                    totalFolders: folders.length,
                    processedFolders: 0,
                    successes: 0,
                    failures: 0,
                    totalMails: 0,
                    errors: [],
                };

                // Helper to update Node-RED status
                const updateStatus = (color, text) => {
                    node.status({ fill: color, shape: 'dot', text });
                };

                // Helper to finalize status and clean up
                const finalizeSession = (error = null) => {
                    if (error) {
                        node.error('IMAP session terminated: ' + error.message);
                        node.status({ fill: 'red', shape: 'ring', text: 'connection error' });
                    } else if (state.failures > 0) {
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: `Done, ${state.totalMails} mails from ${state.successes}/${state.totalFolders} folders. ${state.failures} failed.`
                        });
                    } else {
                        node.status({
                            fill: 'green',
                            shape: 'dot',
                            text: `Done, fetched ${state.totalMails} mails from ${folders.join(', ')}.`
                        });
                    }
                    if (imap && imap.state !== 'disconnected') {
                        imap.end();
                    }
                };

                const fetchFromFolder = (folder) => {
                    updateStatus('yellow', `Fetching from "${folder}"...`);

                    imap.openBox(folder, false, (err, box) => {
                        if (err) {
                            node.error(`Could not open folder "${folder}": ${err.message}`);
                            state.failures++;
                            state.processedFolders++;
                            return startNextFolder();
                        }

                        imap.search(['UNSEEN'], (err, results) => {
                            if (err) {
                                node.error(`Search failed in folder "${folder}": ${err.message}`);
                                state.failures++;
                                state.processedFolders++;
                                return startNextFolder();
                            }

                            if (!results || !results.length) {
                                state.successes++;
                                state.processedFolders++;
                                return startNextFolder();
                            }

                            state.totalMails += results.length;

                            const fetch = imap.fetch(results, { bodies: '' });

                            fetch.on('message', msg => {
                                msg.on('body', stream => {
                                    mailparser.simpleParser(stream, (err, parsed) => {
                                        if (err) {
                                            node.error(`Parse error for email from folder "${folder}": ${err.message}`);
                                            return;
                                        }

                                        const outMsg = {
                                            topic: parsed.subject,
                                            payload: parsed.text,
                                            html: parsed.html,
                                            from: parsed.replyTo?.text || parsed.from?.text,
                                            date: parsed.date,
                                            folder,
                                            header: parsed.headers,
                                            attachments: parsed.attachments.map(att => ({
                                                contentType: att.contentType,
                                                fileName: att.filename,
                                                transferEncoding: att.transferEncoding,
                                                contentDisposition: att.contentDisposition,
                                                generatedFileName: att.cid || att.checksum,
                                                contentId: att.cid,
                                                checksum: att.checksum,
                                                length: att.size,
                                                content: att.content
                                            }))
                                        };
                                        onMail(outMsg);
                                    });
                                });
                            });

                            fetch.once('error', err => {
                                node.error(`Fetch error in folder "${folder}": ${err.message}`);
                            });

                            fetch.once('end', () => {
                                state.successes++;
                                state.processedFolders++;
                                updateStatus('green', `Fetched ${results.length} from "${folder}".`);
                                startNextFolder();
                            });
                        });
                    });
                };

                const startNextFolder = () => {
                    if (state.processedFolders >= state.totalFolders) {
                        finalizeSession();
                    } else {
                        fetchFromFolder(folders[state.processedFolders]);
                    }
                };

                // Centralized event listeners for the IMAP connection
                imap.once('ready', () => {
                    node.status({ fill: 'green', shape: 'dot', text: 'connected' });
                    startNextFolder();
                });

                imap.once('error', err => {
                    finalizeSession(err);
                });

                imap.once('end', () => {
                    node.log('IMAP connection ended.');
                });

                updateStatus('yellow', 'Connecting to IMAP...');
                imap.connect();
            };

            fetchEmails(finalConfig, mail => {
                node.send(mail);
            });
        });
    }

    RED.nodes.registerType("email-receiver", EmailReceiverNode, {
        credentials: {
            password: { type: "password" }
        }
    });
};
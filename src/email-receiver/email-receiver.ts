import { Node, NodeMessageInFlow, NodeInitializer } from 'node-red';
import Imap, { ImapMessageAttributes } from 'node-imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import type { EmailReceiverConfig } from '../models/EmailReceiverConfig';
import type { ImapConnectionConfig } from '../models/ImapConnectionConfig';
import type { FetchState } from '../models/FetchState';
import type { EmailReceiverMessage } from '../models/EmailReceiverMessage';

const nodeInit: NodeInitializer = (RED: any) => {
    function EmailReceiverNode(this: Node, config: EmailReceiverConfig) {
        const node = this;
        RED.nodes.createNode(node, config);

        node.on('input', function (msg: NodeMessageInFlow) {
            // Retrieve and validate configuration values
            const imap_host = RED.util.evaluateNodeProperty(config.host, config.hostType, node, msg);
            const imap_port = RED.util.evaluateNodeProperty(config.port, config.portType, node, msg);
            const imap_tls = RED.util.evaluateNodeProperty(config.tls, config.tlsType, node, msg);
            const imap_user = RED.util.evaluateNodeProperty(config.user, config.userType, node, msg);
            const imap_password = RED.util.evaluateNodeProperty(config.password, config.passwordType, node, msg);

            const imap_folder = RED.util.evaluateNodeProperty(config.folder, config.folderType, node, msg);
            let folders: string[];
            if (Array.isArray(imap_folder)) {
                folders = imap_folder as string[];
            } else if (typeof imap_folder === 'string') {
                folders = imap_folder.split(',').map((f) => f.trim()).filter((f) => f.length > 0);
            } else {
                const errorMsg = "The 'folders' property must be an array or string.";
                node.status({ fill: 'red', shape: 'ring', text: errorMsg });
                node.error(errorMsg, msg);
                return;
            }

            const imap_markSeen = RED.util.evaluateNodeProperty(config.markseen, config.markseenType, node, msg);

            const finalConfig: ImapConnectionConfig = {
                host: imap_host as string,
                port: typeof imap_port === 'string' ? parseInt(imap_port, 10) : (imap_port as number),
                tls: imap_tls as boolean,
                user: imap_user as string,
                password: imap_password as string,
                folders: folders,
                markSeen: imap_markSeen as boolean,
                connTimeout: (msg as any).imap_connTimeout || 10000,
                authTimeout: (msg as any).imap_authTimeout || 5000,
                keepalive: (msg as any).imap_keepalive ?? true,
                autotls: (msg as any).imap_autotls || 'never',
                tlsOptions: (msg as any).imap_tlsOptions || { rejectUnauthorized: false },
            };

            if (
                !finalConfig.user ||
                !finalConfig.password ||
                !finalConfig.port ||
                !finalConfig.host ||
                !finalConfig.folders ||
                finalConfig.folders.length === 0
            ) {
                const missingFields: string[] = [];
                if (!finalConfig.user) missingFields.push('user');
                if (!finalConfig.password) missingFields.push('password');
                if (!finalConfig.port) missingFields.push('port');
                if (!finalConfig.host) missingFields.push('host');
                if (!finalConfig.folders || finalConfig.folders.length === 0) missingFields.push('folders');

                const errorMessage = `Missing required IMAP config: ${missingFields.join(', ')}. Aborting.`;
                node.status({ fill: 'red', shape: 'ring', text: 'missing config' });
                node.error(errorMessage);
                return;
            }

            const fetchEmails = (
                config: ImapConnectionConfig,
                onMail: (mail: EmailReceiverMessage) => void,
            ) => {
                const imap = new Imap({
                    user: config.user,
                    password: config.password,
                    host: config.host,
                    port: config.port,
                    tls: config.tls,
                    connTimeout: config.connTimeout,
                    authTimeout: config.authTimeout,
                    keepalive: config.keepalive,
                    autotls: config.autotls as 'always' | 'never' | 'required',
                    tlsOptions: config.tlsOptions,
                });

                const state: FetchState = {
                    totalFolders: config.folders.length,
                    processedFolders: 0,
                    successes: 0,
                    failures: 0,
                    totalMails: 0,
                    errors: [],
                };

                const updateStatus = (color: string, text: string) => {
                    node.status({ fill: color as any, shape: 'dot', text });
                };

                const finalizeSession = (error: Error | null = null) => {
                    if (error) {
                        node.error('IMAP session terminated: ' + error.message);
                        node.status({ fill: 'red', shape: 'ring', text: 'connection error' });
                    } else if (state.failures > 0) {
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: `Done, ${state.totalMails} mails from ${state.successes}/${state.totalFolders} folders. ${state.failures} failed.`,
                        });
                    } else {
                        node.status({
                            fill: 'green',
                            shape: 'dot',
                            text: `Done, fetched ${state.totalMails} mails from ${config.folders.join(', ')}.`,
                        });
                    }
                    if (imap && imap.state !== 'disconnected') {
                        imap.end();
                    }
                };

                const fetchFromFolder = (folder: string) => {
                    updateStatus('yellow', `Fetching from "${folder}"...`);

                    imap.openBox(folder, false, (err: Error | null, box: Imap.Box | null) => {
                        if (err) {
                            node.error(`Could not open folder "${folder}": ${err.message}`);
                            state.failures++;
                            state.processedFolders++;
                            return startNextFolder();
                        }

                        imap.search(['UNSEEN'], (err: Error | null, results: number[]) => {
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

                            fetch.on('message', (msg: Imap.ImapMessage, seqno: number) => {
                                msg.on('body', (stream: NodeJS.ReadableStream) => {
                                    simpleParser(stream as any, (err: Error | null, parsed: ParsedMail) => {
                                        if (err) {
                                            node.error(`Parse error for email from folder "${folder}": ${err.message}`);
                                            return;
                                        }

                                        const outMsg: EmailReceiverMessage = {
                                            topic: parsed.subject || '',
                                            payload: parsed.text || '',
                                            html: parsed.html || '',
                                            from: parsed.replyTo?.text || parsed.from?.text || '',
                                            date: parsed.date,
                                            folder,
                                            header: parsed.headers,
                                            attachments: (parsed.attachments || []).map((att: Attachment) => ({
                                                contentType: att.contentType,
                                                fileName: att.filename,
                                                contentDisposition: att.contentDisposition as string,
                                                generatedFileName: att.cid || att.checksum,
                                                contentId: att.cid,
                                                checksum: att.checksum as string,
                                                length: att.size as number,
                                                content: att.content as Buffer,
                                            })),
                                        };
                                        onMail(outMsg);
                                    });
                                });

                                // Mark as seen if configured
                                if (config.markSeen) {
                                    msg.once('attributes', (attrs: ImapMessageAttributes) => {
                                        imap.addFlags(attrs.uid, 'SEEN', (err: Error | null) => {
                                            if (err) {
                                                node.error(`Failed to mark message UID ${attrs.uid} as seen: ${err.message}`);
                                            }
                                        });
                                    });
                                }
                            });

                            fetch.once('error', (err: Error) => {
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
                        fetchFromFolder(config.folders[state.processedFolders]);
                    }
                };

                imap.once('ready', () => {
                    node.status({ fill: 'green', shape: 'dot', text: 'connected' });
                    startNextFolder();
                });

                imap.once('error', (err: Error) => {
                    finalizeSession(err);
                });

                imap.once('end', () => {
                    node.log('IMAP connection ended.');
                });

                updateStatus('yellow', 'Connecting to IMAP...');
                imap.connect();
            };

            fetchEmails(finalConfig, (mail) => {
                node.send(mail as any);
            });
        });

        node.on('close', () => {
            // Cleanup when node is being removed/redeployed
        });
    }

    RED.nodes.registerType('email-receiver', EmailReceiverNode, {
        credentials: {
            password: { type: 'password' },
        },
    });
};

export = nodeInit;
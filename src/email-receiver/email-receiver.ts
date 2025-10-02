import { NodeInitializer, Node, NodeDef, NodeMessageInFlow, NodeMessage } from 'node-red';
import Imap, { ImapMessageAttributes } from 'node-imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import type { ImapConnectionConfig } from '../interfaces/ImapConnectionConfig';
import type { FetchState } from '../interfaces/FetchState';
import type { EmailReceiverMessage } from '../interfaces/EmailReceiverMessage';

interface EmailReceiverNodeProperties extends NodeDef {
    host: string;
    hostType: string;
    port: number;
    portType: string;
    tls: boolean;
    tlsType: string;
    user: string;
    userType: string;
    password: string;
    passwordType: string;
    folder: string | string[];
    folderType: string;
    markseen: boolean;
    markseenType: string;
    sendstatus: boolean | string;
}

interface EmailReceiverNodeMessage extends NodeMessageInFlow {}

// Dependency injection interface
interface Dependencies {
    ImapClient: typeof Imap;
    mailParser: typeof simpleParser;
}

// Default dependencies - production values
const defaultDependencies: Dependencies = {
    ImapClient: Imap,
    mailParser: simpleParser,
};

function toBoolean(val: any, defaultValue = false) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') {
        const v = val.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(v)) return true;
        if (['false', '0', 'no', 'off'].includes(v)) return false;
    }
    return defaultValue;
}

const nodeInit: NodeInitializer = (RED, dependencies: Dependencies = defaultDependencies) => {
    function EmailReceiverNode(this: Node, config: EmailReceiverNodeProperties) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store configuration validation error without failing construction
        let configError: Error | null = null;

        try {
            // Validate folder configuration first
            if (typeof config.folder === 'number') {
                throw new Error("The 'folders' property must be an array of strings.");
            }

            if (Array.isArray(config.folder)) {
                if (!config.folder.every((f) => typeof f === 'string')) {
                    throw new Error("The 'folders' property must be an array of strings.");
                }
            } else if (typeof config.folder !== 'string' && config.folder !== undefined) {
                throw new Error("The 'folders' property must be an array of strings.");
            }

            // Validate required fields - check both explicit types and default string values
            const requiredFields: Array<{
                key: keyof EmailReceiverNodeProperties;
                typeKey: keyof EmailReceiverNodeProperties;
            }> = [
                { key: 'host', typeKey: 'hostType' },
                { key: 'user', typeKey: 'userType' },
                { key: 'password', typeKey: 'passwordType' },
                { key: 'port', typeKey: 'portType' },
            ];

            const missingFields: string[] = [];
            requiredFields.forEach(({ key, typeKey }) => {
                const value = config[key];
                const type = config[typeKey] || 'str'; // Default to 'str' if type not specified

                // Check for missing or empty values when type is string
                if (type === 'str' && (!value || value === '' || (typeof value === 'string' && value.trim() === ''))) {
                    missingFields.push(key as string);
                }
                // Also check for null/undefined regardless of type
                if (value === null || value === undefined) {
                    missingFields.push(key as string);
                }
            });

            if (missingFields.length > 0) {
                throw new Error(`Missing required IMAP config: ${missingFields.join(', ')}. Aborting.`);
            }
        } catch (error) {
            configError = error instanceof Error ? error : new Error(String(error));
            node.status({ fill: 'red', shape: 'ring', text: 'config error' });

            // Store error for test framework to detect
            (node as any).configError = configError;

            // Emit error immediately during construction for test framework
            // Use setImmediate to ensure node is fully constructed first
            setImmediate(() => {
                node.error(configError!.message);
            });
        }

        node.on('input', (msg: EmailReceiverNodeMessage, send: Function, done: Function) => {
            send =
                send ||
                function (m: NodeMessage | NodeMessage[]) {
                    node.send(m);
                };
            done =
                done ||
                function (err?: Error) {
                    if (err) node.error(err, msg);
                };

            // If there's a configuration error, report it and don't proceed
            if (configError) {
                node.error(configError.message);
                done(configError);
                return;
            }

            try {
                const imap_host = RED.util.evaluateNodeProperty(config.host, config.hostType, node, msg);
                const imap_port = RED.util.evaluateNodeProperty(String(config.port), config.portType, node, msg);
                const imap_tls = RED.util.evaluateNodeProperty(String(config.tls), config.tlsType, node, msg);
                const imap_user = RED.util.evaluateNodeProperty(config.user, config.userType, node, msg);
                const imap_password = RED.util.evaluateNodeProperty(config.password, config.passwordType, node, msg);
                const sendstatus = config.sendstatus === true || config.sendstatus === 'true';

                const imap_markSeen = RED.util.evaluateNodeProperty(
                    String(config.markseen),
                    config.markseenType,
                    node,
                    msg,
                );
                const imap_folder = RED.util.evaluateNodeProperty(String(config.folder), config.folderType, node, msg);
                let folders: string[];

                if (Array.isArray(imap_folder)) {
                    folders = imap_folder as string[];
                } else if (typeof imap_folder === 'string') {
                    folders = imap_folder
                        .split(',')
                        .map((f) => f.trim())
                        .filter((f) => f.length > 0);
                } else {
                    throw new Error("The 'folders' property must be an array of strings.");
                }

                const finalConfig: ImapConnectionConfig = {
                    host: imap_host as string,
                    port: typeof imap_port === 'string' ? parseInt(imap_port, 10) : (imap_port as number),
                    tls: imap_tls as boolean,
                    user: imap_user as string,
                    password: imap_password as string,
                    folders: folders,
                    markSeen: toBoolean(imap_markSeen, true),
                    connTimeout: (msg as any).imap_connTimeout || 10000,
                    authTimeout: (msg as any).imap_authTimeout || 5000,
                    keepalive: (msg as any).imap_keepalive ?? true,
                    autotls: (msg as any).imap_autotls || 'never',
                    tlsOptions: (msg as any).imap_tlsOptions || { rejectUnauthorized: false },
                };

                // Enhanced validation after property evaluation
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
                    throw new Error(`Missing required IMAP config: ${missingFields.join(', ')}. Aborting.`);
                }

                const fetchEmails = (
                    fetchConfig: ImapConnectionConfig,
                    onMail: (mail: EmailReceiverMessage) => void,
                ) => {
                    // Use injected dependency instead of direct import
                    const imap = new dependencies.ImapClient({
                        user: fetchConfig.user,
                        password: fetchConfig.password,
                        host: fetchConfig.host,
                        port: fetchConfig.port,
                        tls: fetchConfig.tls,
                        connTimeout: fetchConfig.connTimeout,
                        authTimeout: fetchConfig.authTimeout,
                        keepalive: fetchConfig.keepalive,
                        autotls: fetchConfig.autotls as 'always' | 'never' | 'required',
                        tlsOptions: fetchConfig.tlsOptions,
                    });

                    const state: FetchState = {
                        totalFolders: fetchConfig.folders.length,
                        processedFolders: 0,
                        folderCount: {},
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
                            state.errors.push(error);
                            node.error('IMAP session terminated: ' + error.message);
                            node.status({ fill: 'red', shape: 'ring', text: 'connection error' });
                            if (sendstatus) {
                                node.send([
                                    null,
                                    {
                                        payload: {
                                            status: 'error',
                                            message: error.message,
                                            errors: state.errors,
                                        },
                                    },
                                ]);
                            }
                            done(error);
                        } else if (state.failures > 0) {
                            node.status({
                                fill: 'red',
                                shape: 'dot',
                                text: `Done, ${state.totalMails} mails from ${state.successes}/${state.totalFolders} folders. ${state.failures} failed.`,
                            });
                            if (sendstatus) {
                                node.send([
                                    null,
                                    {
                                        payload: {
                                            status: 'warning',
                                            total: state.totalMails,
                                            successes: state.successes,
                                            failures: state.failures,
                                            totalFolders: state.totalFolders,
                                            errors: state.errors,
                                        },
                                    },
                                ]);
                            }
                        } else {
                            node.status({
                                fill: 'green',
                                shape: 'dot',
                                text: `Done, fetched ${state.totalMails} mails from ${fetchConfig.folders.join(', ')}.`,
                            });

                            if (sendstatus) {
                                node.send([
                                    null,
                                    {
                                        payload: {
                                            status: 'success',
                                            total: state.totalMails,
                                            folderCount: state.folderCount,
                                            folders: folders.join(', '),
                                        },
                                    },
                                ]);
                            }
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

                            state.folderCount[folder] = 0;

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

                                const fetch = imap.fetch(results, { bodies: '', markSeen: finalConfig.markSeen });

                                fetch.on('message', (msg: Imap.ImapMessage, seqno: number) => {
                                    msg.on('body', (stream: NodeJS.ReadableStream) => {
                                        // Use injected dependency instead of direct import
                                        dependencies.mailParser(
                                            stream as any,
                                            (err: Error | null, parsed: ParsedMail) => {
                                                if (err) {
                                                    node.error(
                                                        `Parse error for email from folder "${folder}": ${err.message}`,
                                                    );
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
                                                state.folderCount[folder] = (state.folderCount[folder] || 0) + 1;
                                                onMail(outMsg);
                                            },
                                        );
                                    });

                                    if (fetchConfig.markSeen) {
                                        msg.once('attributes', (attrs: ImapMessageAttributes) => {
                                            imap.addFlags(attrs.uid, 'SEEN', (err: Error | null) => {
                                                if (err) {
                                                    node.error(
                                                        `Failed to mark message UID ${attrs.uid} as seen: ${err.message}`,
                                                    );
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
                            fetchFromFolder(fetchConfig.folders[state.processedFolders]);
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
                        updateStatus('green', 'IMAP connection ended.');
                    });

                    try {
                        updateStatus('yellow', 'Connecting to IMAP...');
                        imap.connect();
                    } catch (err: any) {
                        const error = err instanceof Error ? err : new Error(String(err));
                        updateStatus('red', 'Connection error: ' + error.message);
                        done(error);
                        return;
                    }
                };

                fetchEmails(finalConfig, (mail) => {
                    send(mail as any);
                });
                done();
            } catch (error) {
                node.status({ fill: 'red', shape: 'ring', text: 'config error' });
                done(error instanceof Error ? error : new Error(String(error)));
            }
        });
        node.on('close', () => {});
    }
    RED.nodes.registerType('email-receiver', EmailReceiverNode, {
        credentials: {
            password: { type: 'password' },
        },
    });
};

export = nodeInit;

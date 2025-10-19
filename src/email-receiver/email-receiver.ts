import { NodeInitializer, Node, NodeDef, NodeMessageInFlow, NodeMessage } from 'node-red';
import Imap, { ImapMessageAttributes } from 'node-imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import type { ImapConnectionConfig } from '../interfaces/ImapConnectionConfig';
import type { FetchState } from '../interfaces/FetchState';
import type { EmailReceiverMessage } from '../interfaces/EmailReceiverMessage';

interface EmailReceiverNodeProperties extends NodeDef {
    imapConfig: string; // Reference to imap-config node
    folder: string | string[];
    folderType: string;
    markseen: boolean;
    markseenType: string;
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

function parseDynamicProperty(input: any): string[] {
    if (input === null || input === undefined) return input;

    // Wenn der Wert bereits ein Array oder Objekt ist, direkt zurückgeben
    if (typeof input === "object") return input;

    // Wenn String → prüfen ob JSON oder CSV
    if (typeof input === "string") {
        const trimmed: string = input.trim();

        // Versuche JSON zu parsen
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try {
                return JSON.parse(trimmed);
            } catch {
                // Wenn es wie JSON aussieht, aber nicht parsebar ist → als String zurückgeben
                return [trimmed];
            }
        }

        // CSV-Fallback (Trennzeichen , oder ;)
        if (trimmed.includes(",") || trimmed.includes(";")) {
            return trimmed
                .split(/[,;]/)
                .map(v => v.trim())
                .filter(Boolean);
        }

        // Kein JSON, kein CSV → einfacher String
        return [trimmed];
    }

    // Fallback: primitive Werte (number, boolean etc.)
    return [String(input)];
}

const nodeInit: NodeInitializer = (RED, dependencies: Dependencies = defaultDependencies) => {
    function EmailReceiverNode(this: Node, config: EmailReceiverNodeProperties) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store configuration validation error without failing construction
        let configError: Error | null = null;

        // Get the IMAP config node
        const imapConfigNode = RED.nodes.getNode(config.imapConfig) as any;

        try {
            // Validate IMAP config node exists
            if (!imapConfigNode) {
                throw new Error('IMAP configuration node is not configured');
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
                // Get configuration from config node
                const imap_markSeen = RED.util.evaluateNodeProperty(
                    String(config.markseen),
                    config.markseenType,
                    node,
                    msg,
                );
            
                // Validate folder configuration
                const evaluatedFolder = RED.util.evaluateNodeProperty(config.folder as any, config.folderType, node, msg);
                const parsedFolders: string[] = parseDynamicProperty(evaluatedFolder);

                // Early validation of folders - before any IMAP connection attempts
                if (!parsedFolders || parsedFolders.length === 0) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[DEBUG] Parsed folders:', parsedFolders);
                        console.log('[DEBUG] Original folder config:', config.folder);
                        console.log('[DEBUG] Evaluated folder:', evaluatedFolder);
                    }
                    throw new Error('No valid folders specified. At least one folder must be provided.');
                }

                // Check for empty folder names
                const emptyFolders = parsedFolders.filter(folder => !folder || folder.trim().length === 0);
                if (emptyFolders.length > 0) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[DEBUG] Empty folders detected:', emptyFolders);
                        console.log('[DEBUG] All parsed folders:', parsedFolders);
                    }
                    throw new Error('Empty folder names are not allowed. Please provide valid folder names.');
                }

                // Check for potentially problematic folder names
                const problematicFolders = parsedFolders.filter(folder => {
                    const trimmed = folder.trim();
                    return /^\d+$/.test(trimmed) || trimmed.length === 0;
                });
                if (problematicFolders.length > 0) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[DEBUG] Problematic folders detected:', problematicFolders);
                        console.log('[DEBUG] All parsed folders:', parsedFolders);
                    }
                    throw new Error(`Invalid folder names detected: ${problematicFolders.join(', ')}. Folder names should be valid strings.`);
                }

                // Evaluate user and password from config node (supports env and global)
                const imap_host = RED.util.evaluateNodeProperty(
                    imapConfigNode.host,
                    imapConfigNode.hostType || 'env',
                    imapConfigNode,
                    msg,
                );
                const imap_port = RED.util.evaluateNodeProperty(
                    imapConfigNode.port,
                    imapConfigNode.portType || 'env',
                    imapConfigNode,
                    msg,
                );
                const imap_user = RED.util.evaluateNodeProperty(
                    imapConfigNode.user,
                    imapConfigNode.userType || 'env',
                    imapConfigNode,
                    msg,
                );
                const imap_password = RED.util.evaluateNodeProperty(
                    imapConfigNode.password,
                    imapConfigNode.passwordType || 'env',
                    imapConfigNode,
                    msg,
                );

                const finalConfig: ImapConnectionConfig = {
                    host: imap_host as string,
                    port: imap_port as number,
                    tls: imapConfigNode.tls,
                    user: imap_user as string,
                    password: imap_password as string,
                    folders: parsedFolders,
                    markSeen: toBoolean(imap_markSeen, true),
                    connTimeout: imapConfigNode.connTimeout,
                    authTimeout: imapConfigNode.authTimeout,
                    keepalive: imapConfigNode.keepalive,
                    autotls: imapConfigNode.autotls,
                    tlsOptions: { rejectUnauthorized: imapConfigNode.rejectUnauthorized },
                };

                // Debug output for development environment (always show when NODE_ENV=development)
                if (process.env.NODE_ENV === 'development') {
                    const debugConfig = {
                        ...finalConfig,
                        password: finalConfig.password ? '[REDACTED]' : finalConfig.password
                    };
                    console.log('[DEBUG] Email Receiver - Final IMAP Configuration:', JSON.stringify(debugConfig, null, 2));
                }

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
                    
                    // Additional debug output for missing fields in development
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[DEBUG] Missing fields:', missingFields);
                    }
                    
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
                            done(error);
                        } else if (state.failures > 0) {
                            node.status({
                                fill: 'red',
                                shape: 'dot',
                                text: `Done, ${state.totalMails} mails from ${state.successes}/${state.totalFolders} folders. ${state.failures} failed.`,
                            });
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
                        } else {
                            node.status({
                                fill: 'green',
                                shape: 'dot',
                                text: `Done, fetched ${state.totalMails} mails from ${fetchConfig.folders.join(', ')}.`,
                            });

                            node.send([
                                null,
                                {
                                    payload: {
                                        status: 'success',
                                        total: state.totalMails,
                                        folderCount: state.folderCount,
                                        folders: fetchConfig.folders.join(', '),
                                    },
                                },
                            ]);
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
    RED.nodes.registerType('email-receiver', EmailReceiverNode);
};

export = nodeInit;

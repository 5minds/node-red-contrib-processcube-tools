import { NodeInitializer, Node, NodeMessage } from 'node-red';
import nodemailer from 'nodemailer';
import { EmailSenderNodeProperties } from '../interfaces/EmailSenderNodeProperties';

interface EmailSenderNodeMessage extends NodeMessage {}

// Dependency injection interface
interface Dependencies {
    nodemailer: typeof nodemailer;
}

// Default dependencies - production values
const defaultDependencies: Dependencies = {
    nodemailer: nodemailer,
};

const EmailSenderNode: NodeInitializer = (RED, dependencies: Dependencies = defaultDependencies) => {
    function EmailSender(this: Node, config: EmailSenderNodeProperties) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store configuration validation error without failing construction
        let configError: Error | null = null;

        // Get the SMTP config node
        const smtpConfigNode = RED.nodes.getNode(config.smtpConfig) as any;

        try {
            // Validate SMTP config node exists
            if (!smtpConfigNode) {
                throw new Error('SMTP configuration node is not configured');
            }

            // Validate only critical fields that can't be provided at runtime
            // Fields like 'to', 'subject', 'htmlContent' can be empty if provided via msg
            const requiredFields = [
                { name: 'sender', value: config.sender },
                { name: 'from', value: config.from },
            ];

            for (const field of requiredFields) {
                if (field.value === undefined || field.value === null || field.value === '') {
                    throw new Error(`Required property '${field.name}' is missing`);
                }
            }
        } catch (error) {
            configError = error instanceof Error ? error : new Error(String(error));
            node.status({ fill: 'red', shape: 'ring', text: 'config error' });

            // Store error for test framework to detect
            (node as any).configError = configError;

            // Emit error immediately during construction for test framework
            setImmediate(() => {
                node.error(configError!.message);
            });
        }

        const safeEvaluatePropertyAttachment = (cfg: EmailSenderNodeProperties, n: Node, m: NodeMessage) => {
            if (cfg.attachments && cfg.attachments.trim() !== '') {
                try {
                    return RED.util.evaluateNodeProperty(cfg.attachments, cfg.attachmentsType, n, m);
                } catch (e: any) {
                    n.error('Failed to evaluate attachments property: ' + e.message, m);
                    return null;
                }
            }
            return null;
        };

        (node as any).on('input', async (msg: EmailSenderNodeMessage, send: Function, done: Function) => {
            send =
                send ||
                function () {
                    node.send.apply(node, arguments as any);
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
                // Retrieve and evaluate all configuration values
                const sender = String(RED.util.evaluateNodeProperty(config.sender, config.senderType, node, msg));
                const from = String(RED.util.evaluateNodeProperty(config.from, config.fromType, node, msg));
                const to = String(RED.util.evaluateNodeProperty(config.to, config.toType, node, msg) || '');
                const cc = String(RED.util.evaluateNodeProperty(config.cc, config.ccType, node, msg) || '');
                const bcc = String(RED.util.evaluateNodeProperty(config.bcc, config.bccType, node, msg) || '');
                const replyTo = String(
                    RED.util.evaluateNodeProperty(config.replyTo, config.replyToType, node, msg) || '',
                );
                const subject = String(
                    RED.util.evaluateNodeProperty(config.subject, config.subjectType, node, msg) ||
                        msg.topic ||
                        'Message from Node-RED',
                );
                const htmlContent = String(
                    RED.util.evaluateNodeProperty(config.htmlContent, config.htmlContentType, node, msg),
                );
                const attachments = safeEvaluatePropertyAttachment(config, node, msg);

                // Get SMTP Configuration from config node
                const smtp_host = RED.util.evaluateNodeProperty(
                    smtpConfigNode.host,
                    smtpConfigNode.hostType || 'env',
                    smtpConfigNode,
                    msg,
                );

                const smtp_port = RED.util.evaluateNodeProperty(
                    smtpConfigNode.port,
                    smtpConfigNode.portType || 'env',
                    smtpConfigNode,
                    msg,
                );

                const smtp_user = RED.util.evaluateNodeProperty(
                    smtpConfigNode.user,
                    smtpConfigNode.userType || 'env',
                    smtpConfigNode,
                    msg,
                );

                const smtp_password = RED.util.evaluateNodeProperty(
                    smtpConfigNode.password,
                    smtpConfigNode.passwordType || 'env',
                    smtpConfigNode,
                    msg,
                );

                const host = smtp_host;
                const port = smtp_port;
                const user = String(smtp_user);
                const password = String(smtp_password);
                const secure = smtpConfigNode.secure;
                const rejectUnauthorized = smtpConfigNode.rejectUnauthorized;

                // Runtime validation: at least one recipient must be provided
                if (!to && !cc && !bcc) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[DEBUG] Email Sender - No recipients found:');
                        console.log('[DEBUG] to:', to);
                        console.log('[DEBUG] cc:', cc);
                        console.log('[DEBUG] bcc:', bcc);
                    }
                    throw new Error('At least one recipient (to, cc, or bcc) must be specified');
                }

                // Process attachments
                let processedAttachments: any[] = [];
                let parsedAttachments = attachments;
                if (typeof parsedAttachments === 'string' && parsedAttachments.trim().startsWith('[')) {
                    try {
                        parsedAttachments = JSON.parse(parsedAttachments);
                    } catch (e) {
                        throw new Error('Failed to parse attachments JSON: ' + (e as Error).message);
                    }
                }

                if (parsedAttachments) {
                    const attachmentArray = Array.isArray(parsedAttachments) ? parsedAttachments : [parsedAttachments];
                    for (const attachment of attachmentArray) {
                        if (typeof attachment === 'object' && attachment !== null) {
                            if (attachment.filename && attachment.content !== undefined) {
                                processedAttachments.push({
                                    filename: attachment.filename,
                                    content: attachment.content,
                                });
                            } else {
                                throw new Error(
                                    `Attachment object is missing 'filename' or 'content' property. Got: ${JSON.stringify(attachment)}`,
                                );
                            }
                        } else {
                            throw new Error(`Invalid attachment format. Expected object, got: ${typeof attachment}`);
                        }
                    }
                }

                // Debug output for development environment (always show when NODE_ENV=development)
                if (process.env.NODE_ENV === 'development') {
                    const debugConfig = {
                        smtp: {
                            host,
                            port,
                            secure,
                            user,
                            password: password ? '[REDACTED]' : password,
                            rejectUnauthorized
                        },
                        email: {
                            from: { name: sender, address: from },
                            to,
                            cc,
                            bcc,
                            replyTo,
                            subject,
                            htmlContentLength: htmlContent ? htmlContent.length : 0,
                            attachmentsCount: processedAttachments.length
                        }
                    };
                    console.log('[DEBUG] Email Sender - Final Configuration:', JSON.stringify(debugConfig, null, 2));
                }

                // Create and send email
                const transporter = dependencies.nodemailer.createTransport({
                    host,
                    port,
                    secure,
                    auth: { user, pass: password },
                    tls: { rejectUnauthorized },
                });

                const mailOptions = {
                    from: { name: sender, address: from },
                    to,
                    cc,
                    bcc,
                    replyTo,
                    subject,
                    html: Buffer.from(htmlContent, 'utf-8'),
                    attachments: processedAttachments,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        node.status({ fill: 'red', shape: 'dot', text: 'error sending' });
                        if (
                            error.message &&
                            error.message.includes('SSL routines') &&
                            error.message.includes('wrong version number')
                        ) {
                            done(
                                new Error(
                                    'SSL/TLS connection failed: Wrong version number. This usually means the wrong port or security settings are used. For SMTP: use port 587 with secure=false (STARTTLS) or port 465 with secure=true (SSL/TLS).',
                                ),
                            );
                        } else {
                            done(error);
                        }
                    } else {
                        node.log('Email sent: ' + info.response);
                        (msg as any).payload = info;

                        if (info.accepted && info.accepted.length > 0) {
                            node.status({ fill: 'green', shape: 'dot', text: 'sent' });
                            send(msg);
                            done();
                        } else if (info.rejected && info.rejected.length > 0) {
                            done(new Error('Email rejected: ' + info.rejected.join(', ')));
                            node.status({ fill: 'red', shape: 'dot', text: 'rejected' });
                        } else if (info.pending && info.pending.length > 0) {
                            done(new Error('Email pending: ' + info.pending.join(', ')));
                            node.status({ fill: 'yellow', shape: 'dot', text: 'pending' });
                        } else {
                            done(new Error('Unknown error while sending email.'));
                            node.status({ fill: 'red', shape: 'dot', text: 'unknown error' });
                        }
                    }
                });
            } catch (error) {
                // Debug output for errors in development
                if (process.env.NODE_ENV === 'development') {
                    console.log('[DEBUG] Email Sender - Error occurred:', error);
                }
                done(error instanceof Error ? error : new Error(String(error)));
                node.status({ fill: 'red', shape: 'dot', text: 'error' });
            }
        });
    }

    RED.nodes.registerType('email-sender', EmailSender);
};

export = EmailSenderNode;

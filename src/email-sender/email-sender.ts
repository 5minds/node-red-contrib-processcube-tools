import { NodeInitializer, Node, NodeMessage } from 'node-red';
import nodemailer from 'nodemailer';
import { EmailSenderNodeProperties } from '../interfaces/EmailSenderNodeProperties';

interface EmailSenderNodeMessage extends NodeMessage {}

const EmailSenderNode: NodeInitializer = function (RED) {
    function EmailSender(this: Node, config: EmailSenderNodeProperties) {
        RED.nodes.createNode(this, config);
        const node = this;

        const validateRequiredProperties = (cfg: EmailSenderNodeProperties): string | null => {
            const requiredFields = [
                { name: 'sender', value: cfg.sender },
                { name: 'address', value: cfg.address },
                { name: 'to', value: cfg.to },
                { name: 'subject', value: cfg.subject },
                { name: 'htmlContent', value: cfg.htmlContent },
                { name: 'host', value: cfg.host },
                { name: 'port', value: cfg.port },
                { name: 'user', value: cfg.user },
                { name: 'password', value: cfg.password },
                { name: 'secure', value: cfg.secure },
                { name: 'rejectUnauthorized', value: cfg.rejectUnauthorized },
            ];

            for (const field of requiredFields) {
                if (field.value === undefined || field.value === null || field.value === '') {
                    return `Required property '${field.name}' is missing`;
                }
            }

            return null;
        };

        const validationError = validateRequiredProperties(config);
        if (validationError) {
            node.status({ fill: 'red', shape: 'dot', text: 'configuration error' });
            setImmediate(() => {
                node.error(validationError);
            });
            return; // Stop initialization if config is invalid
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
            send = send || function() { node.send.apply(node, arguments as any); };
            done = done || function(err?: Error) { if (err) node.error(err, msg); };

            try {
                // Retrieve and evaluate all configuration values
                const sender = String(RED.util.evaluateNodeProperty(config.sender, config.senderType, node, msg));
                const address = String(RED.util.evaluateNodeProperty(config.address, config.addressType, node, msg));
                const to = String(RED.util.evaluateNodeProperty(config.to, config.toType, node, msg) || '');
                const cc = String(RED.util.evaluateNodeProperty(config.cc, config.ccType, node, msg) || '');
                const bcc = String(RED.util.evaluateNodeProperty(config.bcc, config.bccType, node, msg) || '');
                const replyTo = String(RED.util.evaluateNodeProperty(config.replyTo, config.replyToType, node, msg) || '');
                const subject = String(
                    RED.util.evaluateNodeProperty(config.subject, config.subjectType, node, msg) || msg.topic || 'Message from Node-RED'
                );
                const htmlContent = String(RED.util.evaluateNodeProperty(config.htmlContent, config.htmlContentType, node, msg));
                const attachments = safeEvaluatePropertyAttachment(config, node, msg);

                // SMTP Configuration
                const host = String(RED.util.evaluateNodeProperty(config.host, config.hostType, node, msg));
                const port = Number(RED.util.evaluateNodeProperty(config.port, config.portType, node, msg));
                const user = String(RED.util.evaluateNodeProperty(config.user, config.userType, node, msg));
                const password = String(RED.util.evaluateNodeProperty(config.password, config.passwordType, node, msg));
                const secure = Boolean(RED.util.evaluateNodeProperty(config.secure, config.secureType, node, msg));
                const rejectUnauthorized = Boolean(
                    RED.util.evaluateNodeProperty(config.rejectUnauthorized, config.rejectUnauthorizedType, node, msg)
                );

                // Process attachments
                let processedAttachments: any[] = [];
                let parsedAttachments = attachments;
                if (config.attachmentsType === 'json' && typeof parsedAttachments === 'string') {
                    parsedAttachments = JSON.parse(parsedAttachments);
                }

                if (parsedAttachments) {
                    const attachmentArray = Array.isArray(parsedAttachments) ? parsedAttachments : [parsedAttachments];
                    for (const attachment of attachmentArray) {
                        if (attachment.filename && attachment.content) {
                            processedAttachments.push({ filename: attachment.filename, content: attachment.content });
                        } else {
                            throw new Error("Attachment object is missing 'filename' or 'content' property.");
                        }
                    }
                }

                // Create and send email
                const transporter = nodemailer.createTransport({
                    host,
                    port,
                    secure,
                    auth: { user, pass: password },
                    tls: { rejectUnauthorized },
                });

                const mailOptions = {
                    from: { name: sender, address: address },
                    to, cc, bcc, replyTo, subject,
                    html: Buffer.from(htmlContent, 'utf-8'),
                    attachments: processedAttachments,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        node.status({ fill: 'red', shape: 'dot', text: 'error sending' });
                        if (error.message && error.message.includes('SSL routines') && error.message.includes('wrong version number')) {
                            done(new Error(
                                'SSL/TLS connection failed: Wrong version number. This usually means the wrong port or security settings are used. For SMTP: use port 587 with secure=false (STARTTLS) or port 465 with secure=true (SSL/TLS).',
                            ));
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
                done(error instanceof Error ? error : new Error(String(error)));
                node.status({ fill: 'red', shape: 'dot', text: 'error' });
            }
        });
    }

    RED.nodes.registerType('email-sender', EmailSender, {
        credentials: {
            password: { type: 'password' },
        },
    });
};

export = EmailSenderNode;
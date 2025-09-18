module.exports = function (RED) {
    'use strict';
    const nodemailer = require('nodemailer');

    function EmailSenderNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function (msg, send, done) {
            send =
                send ||
                function () {
                    node.send.apply(node, arguments);
                };
            done =
                done ||
                function (err) {
                    if (err) node.error(err, msg);
                };

            // Retrieve and evaluate mail configuration values
            const sender = RED.util.evaluateNodeProperty(config.sender, config.senderType, node, msg);
            const address = RED.util.evaluateNodeProperty(config.address, config.addressType, node, msg);
            const to = RED.util.evaluateNodeProperty(config.to, config.toType, node, msg);
            const cc = RED.util.evaluateNodeProperty(config.cc, config.ccType, node, msg) || '';
            const bcc = RED.util.evaluateNodeProperty(config.bcc, config.bccType, node, msg) || '';
            const replyTo = RED.util.evaluateNodeProperty(config.replyTo, config.replyToType, node, msg) || '';
            const subject =
                RED.util.evaluateNodeProperty(config.subject, config.subjectType, node, msg) ||
                msg.topic ||
                'Message from Node-RED';
            const htmlContent = RED.util.evaluateNodeProperty(config.htmlContent, config.htmlContentType, node, msg);
            const attachments = safeEvaluatePropertyAttachment(config, node, msg);

            // Retrieve and evaluate SMTP configuration values
            const host = RED.util.evaluateNodeProperty(config.host, config.hostType, node, msg);
            const port = RED.util.evaluateNodeProperty(config.port, config.portType, node, msg);
            const user = RED.util.evaluateNodeProperty(config.user, config.userType, node, msg);
            const password = RED.util.evaluateNodeProperty(config.password, config.passwordType, node, msg);
            const secure = RED.util.evaluateNodeProperty(config.secure, config.secureType, node, msg);
            const rejectUnauthorized = RED.util.evaluateNodeProperty(
                config.rejectUnauthorized,
                config.rejectUnauthorizedType,
                node,
                msg,
            );

            // Handle attachments and format them for Nodemailer
            let processedAttachments = [];

            let parsedAttachments = attachments;

            if (config.attachmentsType === 'json' && typeof parsedAttachments === 'string') {
                try {
                    parsedAttachments = JSON.parse(parsedAttachments);
                } catch (e) {
                    node.error('Failed to parse attachments JSON: ' + e.message);
                    return;
                }
            }

            if (parsedAttachments) {
                // Check if it's a single attachment or an array
                const attachmentArray = Array.isArray(parsedAttachments) ? parsedAttachments : [parsedAttachments];

                for (const attachment of attachmentArray) {
                    try {
                        // Assuming the attachment object has a 'filename' and 'content' property
                        if (attachment.filename && attachment.content) {
                            processedAttachments.push({
                                filename: attachment.filename,
                                content: attachment.content,
                            });
                        } else {
                            node.status({ fill: 'red', shape: 'dot', text: 'attachment error' });
                            node.error("Attachment object is missing 'filename' or 'content' property.");
                            return;
                        }
                    } catch (e) {
                        node.error('Failed to process attachment: ' + e.message);
                    }
                }
            }

            // Create SMTP transporter
            const transporter = nodemailer.createTransport({
                host: host,
                port: port,
                secure: secure,
                auth: {
                    user: user,
                    pass: password,
                },
                tls: {
                    rejectUnauthorized: rejectUnauthorized,
                },
            });

            // Create email object
            const mailOptions = {
                from: {
                    name: sender,
                    address: address,
                },
                to: to,
                cc: cc,
                bcc: bcc,
                replyTo: replyTo,
                subject: subject,
                html: Buffer.from(htmlContent, 'utf-8'),
                attachments: processedAttachments,
            };

            // Send email
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    node.status({ fill: 'red', shape: 'dot', text: 'error sending' });
                    if (
                        error.message &&
                        error.message.includes('SSL routines') &&
                        error.message.includes('wrong version number')
                    ) {
                        // Improved error message for SSL/TLS issues
                        done(
                            new Error(
                                'SSL/TLS connection failed: Wrong version number. ' +
                                    'This usually means the wrong port or security settings are used. ' +
                                    'For SMTP: use port 587 with secure=false (STARTTLS) or port 465 with secure=true (SSL/TLS).',
                            ),
                        );
                    } else {
                        done(error);
                    }
                } else {
                    node.log('Email sent: ' + info.response);
                    msg.payload = info;

                    if (msg.payload.accepted && msg.payload.accepted.length > 0) {
                        msg.payload = msg.input;
                        node.status({ fill: 'green', shape: 'dot', text: 'sent' });
                        send(msg);
                        done();
                    } else if (msg.payload.rejected && msg.payload.rejected.length > 0) {
                        msg.error = { result: msg.payload.rejected };
                        node.status({ fill: 'red', shape: 'dot', text: 'rejected' });
                        done(new Error('Email rejected: ' + msg.payload.rejected.join(', ')));
                    } else if (msg.payload.pending && msg.payload.pending.length > 0) {
                        msg.error = { result: msg.payload.pending };
                        node.status({ fill: 'yellow', shape: 'dot', text: 'pending' });
                        done(new Error('Email pending: ' + msg.payload.pending.join(', ')));
                    } else {
                        node.status({ fill: 'red', shape: 'dot', text: 'unknown error' });
                        done(new Error('Unknown error while sending email.'));
                    }
                }
            });
        });
    }

    function safeEvaluatePropertyAttachment(config, node, msg) {
        if (config.attachments && config.attachments.trim() !== '') {
            try {
                return RED.util.evaluateNodeProperty(config.attachments, config.attachmentsType, node, msg);
            } catch (e) {
                node.error('Failed to evaluate attachments property: ' + e.message, msg);
                return null;
            }
        }

        return null;
    }

    RED.nodes.registerType('email-sender', EmailSenderNode, {
        credentials: {
            password: { type: 'password' },
        },
    });
};

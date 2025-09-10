module.exports = function(RED) {
    "use strict";
    const nodemailer = require("nodemailer");

    function EmailSenderNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg, send, done) {

            // Konfiguration und Daten aus der Nachricht extrahieren
            const emailConfig = RED.util.evaluateNodeProperty(config.email, config.emailType, node, msg) || {};
            const smtpConfig = RED.util.evaluateNodeProperty(config.smtp, config.smtpType, node, msg) || {};

            // Fallback für send und done, falls ältere Node-RED Version
            send = send || function() { node.send.apply(node, arguments); }
            done = done || function(err) { if (err) node.error(err, msg); }

            // Logik vom Code-Snippet
            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: smtpConfig.port,
                auth: {
                    user: smtpConfig.auth?.user,
                    pass: smtpConfig.auth?.pass
                },
                secure: smtpConfig.secure !== undefined ? smtpConfig.secure : true,
                proxy: smtpConfig.proxy || undefined,
                tls: {
                    rejectUnauthorized: smtpConfig.tls?.rejectUnauthorized !== undefined
                        ? smtpConfig.tls.rejectUnauthorized
                        : true
                }
            });

            const mail = {
                from: emailConfig.from,
                to: emailConfig.to,
                cc: emailConfig.cc || "",
                bcc: emailConfig.bcc || "",
                subject: emailConfig.subject || msg.topic || "Message from Node-RED",
                attachments: emailConfig.attachments,
                text: emailConfig.text,
                html: emailConfig.html,
                amp: emailConfig.amp,
                priority: emailConfig.priority || "normal"
            };

            // E-Mail senden und den Status überprüfen
            transporter.sendMail(mail, (error, info) => {
                if (error) {
                    node.error(error, msg);
                    done(error); // Fehler an Node-RED weiterleiten
                    return;
                }

                node.log('E-Mail gesendet: ' + info.response);
                msg.payload = info;

                // Statusprüfung basierend auf dem Code-Auszug
                if (msg.payload.accepted && msg.payload.accepted.length > 0) {
                    msg.payload = { result: msg.input };
                    send(msg); // Nachricht an den nächsten Knoten senden
                } else if (msg.payload.rejected && msg.payload.rejected.length > 0) {
                    msg.error = { result: msg.payload.rejected };
                    done('E-Mail abgelehnt: ' + msg.payload.rejected.join(', '));
                    node.status({fill:"red", shape:"dot", text:"rejected"});
                    return;
                } else if (msg.payload.pending && msg.payload.pending.length > 0) {
                    msg.error = { result: msg.payload.pending };
                    done('E-Mail ausstehend: ' + msg.payload.pending.join(', '));
                    node.status({fill:"yellow", shape:"dot", text:"pending"});
                    return;
                } else {
                    done('Unbekannter Fehler beim Senden der E-Mail.');
                    node.status({fill:"red", shape:"dot", text:"error"});
                    return;
                }
            });
        });
    }

    RED.nodes.registerType("email-sender", EmailSenderNode);
};
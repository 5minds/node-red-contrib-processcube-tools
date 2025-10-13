import { NodeDef } from 'node-red';

export interface EmailSenderNodeProperties extends NodeDef {
    // Mail configuration properties
    sender: string;
    senderType: string;
    from: string;
    fromType: string;
    to: string;
    toType: string;
    cc: string;
    ccType: string;
    bcc: string;
    bccType: string;
    replyTo: string;
    replyToType: string;
    subject: string;
    subjectType: string;
    htmlContent: string;
    htmlContentType: string;
    attachments: string;
    attachmentsType: string;

    // SMTP configuration properties
    host: string;
    hostType: string;
    port: string;
    portType: string;
    user: string;
    userType: string;
    password: string;
    passwordType: string;
    secure: string;
    secureType: string;
    rejectUnauthorized: string;
    rejectUnauthorizedType: string;
}

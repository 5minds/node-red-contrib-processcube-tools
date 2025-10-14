// Importiere die Registrierungsfunktion für deine Nodes.
import registerImapConfigNode from './imap-config/imap-config';
import registerSmtpConfigNode from './smtp-config/smtp-config';
import registerEmailReceiverNode from './email-receiver/email-receiver';
import registerEmailSenderNode from './email-sender/email-sender';
import registerHtmlToTextNode from './html-to-text/html-to-text';

// Exportiere eine Funktion, die alle Nodes registriert.
export = function (RED: any) {
    // Rufe die Registrierungsfunktionen für jede Node auf.
    registerImapConfigNode(RED);
    registerSmtpConfigNode(RED);
    registerEmailReceiverNode(RED);
    registerEmailSenderNode(RED);
    registerHtmlToTextNode(RED);
};

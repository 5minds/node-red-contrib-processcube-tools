export interface ImapMailbox {
    messages: { total: number };
    name: string;
    readOnly: boolean;
}

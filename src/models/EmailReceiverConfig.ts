export interface EmailReceiverConfig {
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
}


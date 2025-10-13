import { NodeInitializer, NodeDef } from 'node-red';

interface ImapConfigNodeProperties extends NodeDef {
    host: string;
    port: number;
    tls: boolean;
    user: string;
    userType: string;
    password: string;
    passwordType: string;
    connTimeout: number;
    authTimeout: number;
    keepalive: boolean;
    autotls: 'always' | 'never' | 'required';
    rejectUnauthorized: boolean;
}

const ImapConfigNode: NodeInitializer = (RED) => {
    function ImapConfig(this: any, config: ImapConfigNodeProperties) {
        RED.nodes.createNode(this, config);

        // Store configuration properties
        this.host = config.host;
        this.port = config.port;
        this.tls = config.tls;
        this.user = config.user;
        this.userType = config.userType;
        this.password = config.password;
        this.passwordType = config.passwordType;
        this.connTimeout = config.connTimeout || 10000;
        this.authTimeout = config.authTimeout || 5000;
        this.keepalive = config.keepalive !== undefined ? config.keepalive : true;
        this.autotls = config.autotls || 'never';
        this.rejectUnauthorized = config.rejectUnauthorized !== undefined ? config.rejectUnauthorized : true;
    }

    RED.nodes.registerType('imap-config', ImapConfig);
};

export = ImapConfigNode;

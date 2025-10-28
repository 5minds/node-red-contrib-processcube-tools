import { NodeInitializer, NodeDef } from 'node-red';

interface SmtpConfigNodeProperties extends NodeDef {
    host: string;
    port: number;
    user: string;
    userType: string;
    password: string;
    passwordType: string;
    connTimeout: number;
    authTimeout: number;
    keepalive: boolean;
    secure: boolean;
    autotls: string;
    rejectUnauthorized: boolean;
}

const SmtpConfigNode: NodeInitializer = (RED) => {
    function SmtpConfig(this: any, config: SmtpConfigNodeProperties) {
        RED.nodes.createNode(this, config);

        // Store configuration properties
        this.host = config.host;
        this.port = config.port;
        this.user = config.user;
        this.userType = config.userType;
        this.password = config.password;
        this.passwordType = config.passwordType;
        this.connTimeout = config.connTimeout !== undefined ? config.connTimeout : 10000;
        this.authTimeout = config.authTimeout !== undefined ? config.authTimeout : 5000;
        this.keepalive = config.keepalive !== undefined ? config.keepalive : true;
        this.secure = config.secure !== undefined ? config.secure : false;
        this.autotls = config.autotls || 'never';
        this.rejectUnauthorized = config.rejectUnauthorized !== undefined ? config.rejectUnauthorized : false;
    }

    RED.nodes.registerType('smtp-config', SmtpConfig);
};

export = SmtpConfigNode;

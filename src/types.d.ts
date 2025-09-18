declare global {
    interface NodeProperties {
        id: string;
        type: string;
        name: string;
    }

    interface Node {
        on(event: 'input', callback: (msg: Message, send: (msg: Message | Message[]) => void, done: (err?: Error) => void) => void): this;
        on(event: string, callback: (...args: any[]) => void): this;
        send(msg: Message | Message[]): void;
        status(status: { fill?: string; shape?: string; text?: string }): void;
        error(error: string | Error, msg?: Message): void;
        log(msg: string): void;
    }

    interface Message {
        payload: any;
        [key: string]: any;
    }

    const RED: Red;

    interface Red {
        nodes: {
            createNode(node: any, config: any): void;
            registerType(type: string, constructor: any): void;
        };
        settings: any;
        log: {
            info(msg: string): void;
            warn(msg: string): void;
            error(msg: string): void;
        };
    }
}

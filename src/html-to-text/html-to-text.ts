import { NodeInitializer, Node, NodeDef, NodeMessage } from 'node-red';
const { compile } = require('html-to-text');

interface HtmlToTextNodeProperties extends NodeDef {
    // Add your custom properties here if needed
}

interface HtmlToTextNodeMessage extends NodeMessage {
    payload: string;
}

const HtmlToTextNode: NodeInitializer = function (RED) {
    function HtmlToText(this: Node, config: HtmlToTextNodeProperties) {
        RED.nodes.createNode(this, config);
        const node = this;

        const options = {
            wordwrap: 130,
        };

        const compiledConvert = compile(options);

        (node as any).on('input', (msg: HtmlToTextNodeMessage, send?: Function, done?: Function) => {
            // Provide default functions if not available (for older Node-RED versions)
            send =
                send ||
                function (m: NodeMessage | NodeMessage[]) {
                    node.send(m);
                };
            done =
                done ||
                function (err?: Error) {
                    if (err) node.error(err, msg);
                };

            try {
                if (typeof msg.payload !== 'string') {
                    throw new Error('Payload is not a string!');
                }

                msg.payload = compiledConvert(msg.payload);
                send(msg);
                done();
            } catch (error) {
                done(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    RED.nodes.registerType('html-to-text', HtmlToText);
};

export = HtmlToTextNode;

const { compile } = require('html-to-text');

interface HtmlToTextNodeProperties extends NodeProperties {
}

export = function (RED: Red) {
    function HtmlToText(this: Node, config: HtmlToTextNodeProperties) {
        RED.nodes.createNode(this, config);
        const node = this;

        const options = {
            wordwrap: 130,
        };

        const compiledConvert = compile(options);

        node.on('input', async (msg: Message, send: (msg: Message | Message[]) => void, done: (err?: Error) => void) => {
            try {
                if (typeof msg.payload !== 'string') {
                    throw new Error('Payload is not a string!');
                }

                msg.payload = compiledConvert(msg.payload);

                node.send(msg);

                if (done) {
                    done();
                }
            } catch (err: any) {
                if (done) {
                    done(err);
                }
            }
        });
    }

    RED.nodes.registerType('html-to-text', HtmlToText);
};
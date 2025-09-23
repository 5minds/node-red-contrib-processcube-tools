module.exports = function (RED) {
    const { compile } = require('html-to-text');

    function ProcesscubeHtmlToText(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const options = {
            wordwrap: 130,
            // ...
        };
        const compiledConvert = compile(options); // options passed here

        node.on('input', async function (msg) {
            msg.payload = compiledConvert(msg.payload);

            node.send(msg);
        });
    }

    RED.nodes.registerType('processcube-html-to-text', ProcesscubeHtmlToText);
};

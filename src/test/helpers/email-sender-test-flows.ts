import { EmailSenderTestConfigs } from "./email-sender-test-configs";

export const testFlows = {
    single: [EmailSenderTestConfigs.valid],

    connected: [
        { ...EmailSenderTestConfigs.valid, wires: [['h1']] },
        { id: 'h1', type: 'helper' }
    ],

    multiOutput: [
        { ...EmailSenderTestConfigs.valid, wires: [['h1', 'h2']] },
        { id: 'h1', type: 'helper' },
        { id: 'h2', type: 'helper' }
    ]
};


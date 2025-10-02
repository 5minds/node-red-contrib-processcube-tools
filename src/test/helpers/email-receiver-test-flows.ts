import { EmailReceiverTestConfigs } from './email-receiver-test-configs';

export const testFlows = {
    single: [EmailReceiverTestConfigs.valid],

    connected: [
        { ...EmailReceiverTestConfigs.valid, wires: [['h1']] },
        { id: 'h1', type: 'helper' },
    ],

    multiOutput: [
        { ...EmailReceiverTestConfigs.valid, wires: [['h1', 'h2']] },
        { id: 'h1', type: 'helper' },
        { id: 'h2', type: 'helper' },
    ],
};

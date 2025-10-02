// ============================================================================
// ADVANCED TEST PATTERNS FOR NODE-RED CUSTOM NODES
// ============================================================================

import type { TestScenario } from './types';

// ============================================================================
// ERROR RESILIENCE PATTERNS
// ============================================================================

export class ErrorResilienceTestBuilder {
    private scenarios: TestScenario[] = [];

    addNetworkErrorScenario(name: string, config: any): this {
        return this.addScenario({
            name: `${name} - network error`,
            config: { ...config, host: 'unreachable.invalid.test' },
            input: { payload: 'test' },
            expectedError: /network|connection|timeout/i,
            timeout: 3000,
        });
    }

    addMalformedInputScenario(name: string, config: any): this {
        const malformedInputs = [
            null,
            undefined,
            { payload: null },
            { payload: '' },
            { payload: { malformed: true, circular: null } },
            'not-an-object',
        ];

        malformedInputs.forEach((input, index) => {
            this.addScenario({
                name: `${name} - malformed input ${index + 1}`,
                config,
                input,
                timeout: 2000,
            });
        });

        return this;
    }

    addResourceExhaustionScenario(name: string, config: any): this {
        return this.addScenario({
            name: `${name} - resource exhaustion`,
            config,
            input: {
                payload: 'x'.repeat(10 * 1024 * 1024), // 10MB payload
                largeArray: Array.from({ length: 100000 }, (_, i) => ({ id: i, data: 'test' })),
            },
            timeout: 5000,
        });
    }

    addRapidFireScenario(name: string, config: any, messageCount: number = 1000): this {
        return this.addScenario({
            name: `${name} - rapid fire messages`,
            config,
            input: Array.from({ length: messageCount }, (_, i) => ({
                payload: `rapid-message-${i}`,
                sequence: i,
            })),
            timeout: Math.max(5000, messageCount * 5),
        });
    }

    private addScenario(scenario: TestScenario): this {
        this.scenarios.push(scenario);
        return this;
    }

    getScenarios(): TestScenario[] {
        return [...this.scenarios];
    }
}
// ============================================================================
// EDGE CASE PATTERNS
// ============================================================================

export class EdgeCaseTestBuilder {
    private scenarios: TestScenario[] = [];

    addEmptyDataScenarios(name: string, config: any): this {
        const emptyDataCases = [
            { name: 'empty object', data: {} },
            { name: 'empty array', data: [] },
            { name: 'empty string', data: '' },
            { name: 'null payload', data: null },
            { name: 'undefined payload', data: undefined },
            { name: 'zero value', data: 0 },
            { name: 'false value', data: false },
        ];

        emptyDataCases.forEach((testCase) => {
            this.scenarios.push({
                name: `${name} - ${testCase.name}`,
                config,
                input: { payload: testCase.data },
                timeout: 2000,
            });
        });

        return this;
    }

    addSpecialCharacterScenarios(name: string, config: any): this {
        const specialCases = [
            { name: 'unicode characters', data: '🚀💡🌟' },
            { name: 'newlines and tabs', data: 'line1\nline2\tindented' },
            { name: 'special symbols', data: '!@#$%^&*()_+-=[]{}|;:,.<>?' },
            { name: 'very long string', data: 'a'.repeat(10000) },
            { name: 'mixed encoding', data: 'Ñiño café résumé 北京' },
        ];

        specialCases.forEach((testCase) => {
            this.scenarios.push({
                name: `${name} - ${testCase.name}`,
                config,
                input: { payload: testCase.data },
                timeout: 3000,
            });
        });

        return this;
    }

    addLargeDataScenarios(name: string, config: any): this {
        const largeCases = [
            {
                name: 'large object',
                data: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])),
            },
            {
                name: 'deeply nested object',
                data: Array.from({ length: 100 }, () => ({})).reduce((acc, _, i) => ({ [`level${i}`]: acc }), {
                    deepest: true,
                }),
            },
            {
                name: 'large array',
                data: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item${i}` })),
            },
        ];

        largeCases.forEach((testCase) => {
            this.scenarios.push({
                name: `${name} - ${testCase.name}`,
                config,
                input: { payload: testCase.data },
                timeout: 5000,
            });
        });

        return this;
    }

    getScenarios(): TestScenario[] {
        return [...this.scenarios];
    }
}

// ============================================================================
// SECURITY TESTING PATTERNS
// ============================================================================

export class SecurityTestBuilder {
    private scenarios: TestScenario[] = [];

    addInjectionTestScenarios(name: string, config: any): this {
        const injectionPayloads = [
            { name: 'SQL injection', payload: "'; DROP TABLE users; --" },
            { name: 'XSS attempt', payload: '<script>alert("xss")</script>' },
            { name: 'Command injection', payload: '; rm -rf / ;' },
            { name: 'Path traversal', payload: '../../../etc/passwd' },
            { name: 'JSON injection', payload: '{"__proto__":{"isAdmin":true}}' },
        ];

        injectionPayloads.forEach((attack) => {
            this.scenarios.push({
                name: `${name} - ${attack.name}`,
                config,
                input: { payload: attack.payload },
                timeout: 2000,
            });
        });

        return this;
    }

    addOversizedPayloadScenarios(name: string, config: any): this {
        const oversizedCases = [
            { name: '1MB payload', size: 1024 * 1024 },
            { name: '10MB payload', size: 10 * 1024 * 1024 },
            { name: 'deeply nested payload', depth: 1000 },
        ];

        oversizedCases.forEach((testCase) => {
            let payload;
            if (testCase.size) {
                payload = 'x'.repeat(testCase.size);
            } else if (testCase.depth) {
                payload = Array.from({ length: testCase.depth }, () => ({})).reduce((acc) => ({ nested: acc }), {
                    bottom: true,
                });
            }

            this.scenarios.push({
                name: `${name} - ${testCase.name}`,
                config,
                input: { payload },
                timeout: 10000,
            });
        });

        return this;
    }

    getScenarios(): TestScenario[] {
        return [...this.scenarios];
    }
}

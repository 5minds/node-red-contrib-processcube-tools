import type { Node, NodeMessageInFlow } from 'node-red';

export interface TestScenario {
  name: string;
  config: any;
  input?: any;
  expectedOutput?: any;
  expectedError?: string | RegExp;
  expectedStatus?: { fill: string; shape?: string; text?: string };
  timeout?: number;
}

export interface TestContext {
  mockRED: any;
  nodeInstance: any;
  messages: any[];
  errors: any[];
  statuses: any[];
  logs?: any[];
  warnings?: any[];
  debugs?: any[];
}

export interface MockNodeREDOptions {
  dependencies?: Record<string, any>;
  onHandler?: (this: Node, event: string, callback: Function) => void;
  sendHandler?: (msg: any) => void;
  errorHandler?: (err: any) => void;
  statusHandler?: (status: any) => void;
  logHandler?: (msg: any) => void;
  warnHandler?: (msg: any) => void;
  debugHandler?: (msg: any) => void;
  traceHandler?: (msg: any) => void;
}

// Integration Test Types
export interface IntegrationTestScenario {
  name: string;
  flow: any[];
  nodeId: string;
  input?: any;
  expectedMessages?: Array<{
    nodeId: string;
    expectedMsg: any;
    timeout?: number;
  }>;
  timeout?: number;
  setup?: (nodes: Record<string, Node>) => void;
  cleanup?: () => void;
}

export interface IntegrationTestContext {
  nodes: Record<string, Node>;
  messages: Array<{
    nodeId: string;
    message: NodeMessageInFlow;
    timestamp: number;
  }>;
  errors: any[];
}
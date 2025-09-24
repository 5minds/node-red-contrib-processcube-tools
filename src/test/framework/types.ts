import type { Node } from 'node-red';

export interface TestScenario {
  name: string;
  config: any;
  input?: any;
  expectedOutput?: any;
  expectedError?: string | RegExp;
  expectedStatus?: { fill: string; text?: string };
  timeout?: number;
}

export interface TestContext {
  mockRED: any;
  nodeInstance: any;
  messages: any[];
  errors: any[];
  statuses: any[];
}


export interface MockNodeREDOptions {
  onHandler?: (this: Node, event: string, callback: Function) => void;
  sendHandler?: (msg: any) => void;
  errorHandler?: (err: any) => void;
  statusHandler?: (status: any) => void;
}

interface NodeRedConfig {
    id?: string;
    type?: string;
    name?: string;
    host?: string;
    hostType?: string;
    port?: number;
    portType?: string;
    tls?: boolean;
    tlsType?: string;
    user?: string;
    userType?: string;
    password?: string;
    passwordType?: string;
    folder?: string | string[];
    folderType?: string;
    markseen?: boolean;
    markseenType?: string;
    wires?: string[][];
}

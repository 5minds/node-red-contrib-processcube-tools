import { expect } from 'chai';
import type { TestContext } from './types';

export class NodeAssertions {
  static expectMessage(context: TestContext, expectedMsg: any): void {
    expect(context.messages, 'No messages were sent').to.have.length.greaterThan(0);
    const lastMessage = context.messages[context.messages.length - 1];

    if (typeof expectedMsg === 'object' && expectedMsg !== null) {
      Object.keys(expectedMsg).forEach(key => {
        expect(lastMessage, `Message missing property: ${key}`).to.have.property(key);
        if (expectedMsg[key] !== undefined) {
          expect(lastMessage[key], `Message property ${key} does not match`).to.deep.equal(expectedMsg[key]);
        }
      });
    } else {
      expect(lastMessage, 'Message does not match expected value').to.deep.equal(expectedMsg);
    }
  }

  static expectError(context: TestContext, expectedError: string | RegExp): void {
    expect(context.errors, 'No errors were recorded').to.have.length.greaterThan(0);
    const error = context.errors[context.errors.length - 1];

    if (typeof expectedError === 'string') {
      expect(error, 'Error message does not contain expected text').to.include(expectedError);
    } else {
      expect(error, 'Error message does not match expected pattern').to.match(expectedError);
    }
  }

  static expectStatus(context: TestContext, expectedStatus: { fill: string; text?: string }): void {
    expect(context.statuses, 'No status updates were recorded').to.have.length.greaterThan(0);
    const status = context.statuses[context.statuses.length - 1];

    expect(status.fill, 'Status fill color does not match').to.equal(expectedStatus.fill);
    if (expectedStatus.text) {
      expect(status.text, 'Status text does not match').to.include(expectedStatus.text);
    }
  }

  static expectNodeProperty(context: TestContext, property: string, value: any): void {
    expect(context.nodeInstance, 'Node instance does not exist').to.exist;
    expect(context.nodeInstance, `Node missing property: ${property}`).to.have.property(property, value);
  }

  static expectNoErrors(context: TestContext): void {
    expect(context.errors, 'Unexpected errors occurred').to.have.length(0);
  }

  static expectNoMessages(context: TestContext): void {
    expect(context.messages, 'Unexpected messages were sent').to.have.length(0);
  }

  static expectMessageCount(context: TestContext, count: number): void {
    expect(context.messages, `Expected ${count} messages`).to.have.length(count);
  }

  static expectStatusCount(context: TestContext, count: number): void {
    expect(context.statuses, `Expected ${count} status updates`).to.have.length(count);
  }
}
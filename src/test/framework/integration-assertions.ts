import { expect } from 'chai';
import type { IntegrationTestContext } from './integration-test-runner';

export class IntegrationAssertions {
  static expectNodeExists(context: IntegrationTestContext, nodeId: string): void {
    expect(context.nodes[nodeId], `Node ${nodeId} should exist`).to.exist;
  }

  static expectNodeProperty(context: IntegrationTestContext, nodeId: string, property: string, value: any): void {
    this.expectNodeExists(context, nodeId);
    expect(context.nodes[nodeId], `Node ${nodeId} should have property ${property}`).to.have.property(property, value);
  }

  static expectMessageReceived(context: IntegrationTestContext, nodeId: string): void {
    const messages = context.messages.filter(m => m.nodeId === nodeId);
    expect(messages, `Node ${nodeId} should have received at least one message`).to.have.length.greaterThan(0);
  }

  static expectMessageCount(context: IntegrationTestContext, nodeId: string, count: number): void {
    const messages = context.messages.filter(m => m.nodeId === nodeId);
    expect(messages, `Node ${nodeId} should have received ${count} messages`).to.have.length(count);
  }

  static expectMessageContent(context: IntegrationTestContext, nodeId: string, expectedContent: any): void {
    const messages = context.messages.filter(m => m.nodeId === nodeId);
    expect(messages, `Node ${nodeId} should have received messages`).to.have.length.greaterThan(0);

    const lastMessage = messages[messages.length - 1].message;
    if (typeof expectedContent === 'object') {
      Object.keys(expectedContent).forEach(key => {
        expect(lastMessage, `Message should have property ${key}`).to.have.property(key);
        if (expectedContent[key] !== undefined) {
          expect(lastMessage[key], `Message property ${key} should match`).to.deep.equal(expectedContent[key]);
        }
      });
    } else {
      expect(lastMessage.payload).to.equal(expectedContent);
    }
  }

  static expectNoMessages(context: IntegrationTestContext, nodeId: string): void {
    const messages = context.messages.filter(m => m.nodeId === nodeId);
    expect(messages, `Node ${nodeId} should not have received any messages`).to.have.length(0);
  }

  static expectAllNodesExist(context: IntegrationTestContext, nodeIds: string[]): void {
    nodeIds.forEach(nodeId => {
      this.expectNodeExists(context, nodeId);
    });
  }

  static expectMessageOrder(context: IntegrationTestContext, nodeIds: string[]): void {
    const sortedMessages = [...context.messages].sort((a, b) => a.timestamp - b.timestamp);

    nodeIds.forEach((expectedNodeId, index) => {
      expect(sortedMessages[index], `Message ${index} should be from node ${expectedNodeId}`)
        .to.have.property('nodeId', expectedNodeId);
    });
  }
}

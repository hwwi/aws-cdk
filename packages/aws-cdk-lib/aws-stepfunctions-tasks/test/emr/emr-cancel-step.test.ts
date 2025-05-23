import { Template } from '../../../assertions';
import * as sfn from '../../../aws-stepfunctions';
import * as cdk from '../../../core';
import * as tasks from '../../lib';

let stack: cdk.Stack;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
});

test('Cancel a Step with static ClusterId and StepId', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: 'StepId',
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Parameters: {
      ClusterId: 'ClusterId',
      StepId: 'StepId',
    },
  });
});

test('Cancel a Step with static ClusterId and StepId - using JSONata', () => {
  // WHEN
  const task = tasks.EmrCancelStep.jsonata(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: 'StepId',
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    QueryLanguage: 'JSONata',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Arguments: {
      ClusterId: 'ClusterId',
      StepId: 'StepId',
    },
  });
});

test('task policies are generated', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: 'StepId',
  });
  new sfn.StateMachine(stack, 'SM', {
    definitionBody: sfn.DefinitionBody.fromChainable(task),
  });

  // THEN
  Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'elasticmapreduce:CancelSteps',
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [
                'arn:',
                {
                  Ref: 'AWS::Partition',
                },
                ':elasticmapreduce:',
                {
                  Ref: 'AWS::Region',
                },
                ':',
                {
                  Ref: 'AWS::AccountId',
                },
                ':cluster/*',
              ],
            ],
          },
        },
      ],
    },
  });
});

test('Cancel a Step with static ClusterId and StepId from payload', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: sfn.TaskInput.fromJsonPathAt('$.StepId').value,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Parameters: {
      'ClusterId': 'ClusterId',
      'StepId.$': '$.StepId',
    },
  });
});

test('Cancel a Step with ClusterId from payload and static StepId', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: sfn.TaskInput.fromJsonPathAt('$.ClusterId').value,
    stepId: 'StepId',
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Parameters: {
      'ClusterId.$': '$.ClusterId',
      'StepId': 'StepId',
    },
  });
});

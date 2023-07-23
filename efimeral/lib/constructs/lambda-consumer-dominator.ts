import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';


export interface LambdaConsumerDominatorProps {
  readonly sentryDSN: string;
}
  
export class LambdaConsumerDominator extends Construct {

    public readonly fn: lambdaNodeJS.NodejsFunction;
    public readonly eventRule: events.Rule;

    constructor(scope: Construct, id: string, props: LambdaConsumerDominatorProps) {
        super(scope, id);

        const fn = new lambdaNodeJS.NodejsFunction(this, 'lambda-consumer-dominator', {
          description: 'Registers subdomain for new boxes.',
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: './lambdas/consumer/dominator.js',
          handler: 'handler',
          timeout: cdk.Duration.seconds(60),
          logRetention: logs.RetentionDays.ONE_WEEK,
          environment: {
            LAMBDAS_SENTRY_DSN: props.sentryDSN,
          },
          bundling: {
            nodeModules: [
              '@sentry/serverless',
            ],
          },
        });
        this.fn = fn;

        const rule = new events.Rule(this, 'box-task-creation-event-rule', {
          ruleName: 'box-task-creation-event-rule',
          eventPattern: {
            source: ["aws.ecs"],
            detailType: ['ECS Task State Change'],
            detail: {
              lastStatus: ['RUNNING'],
            },
          },
          description: 'Sends ECS events when a new task is in running state',
          targets: [
            new targets.LambdaFunction(fn),
          ],
        });
        this.eventRule = rule;
    }
}
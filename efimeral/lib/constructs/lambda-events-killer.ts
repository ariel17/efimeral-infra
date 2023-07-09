import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';


export interface LambdaEventsKillerProps {
  readonly sentryDSN: string;
  readonly cluster: ecs.Cluster;
  readonly layers: lambda.ILayerVersion[];
  readonly containerTimeoutMinutes: number;
}
  
export class LambdaEventsKiller extends Construct {

    public readonly fn: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: LambdaEventsKillerProps) {
        super(scope, id);

        const fn = new lambdaNodeJS.NodejsFunction(this, 'lambda-scheduled-killer', {
          description: 'Destroys timeouted containers in RUNNING state.',
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: './lambdas/scheduled/killer.js',
          handler: 'handler',
          timeout: cdk.Duration.seconds(60),
          logRetention: logs.RetentionDays.ONE_WEEK,
          environment: {
            CLUSTER_ARN: props.cluster.clusterArn,
            CONTAINER_TIMEOUT_MINUTES: `${props.containerTimeoutMinutes}`,
            LAMBDAS_SENTRY_DSN: props.sentryDSN,
          },
          bundling: {
            nodeModules: [
              '@sentry/serverless',
            ],
            externalModules: [
              '/opt/nodejs/running-tasks',
            ],
          },
          layers: props.layers,
        });
        this.fn = fn;

        const policy = new iam.PolicyStatement({
          actions: ['ecs:ListTasks', 'ecs:DescribeTasks', 'ecs:StopTask'],
          resources: ["*"],
          effect: iam.Effect.ALLOW,
        });
        fn.addToRolePolicy(policy);

        const rule = new events.Rule(this, 'KillerScheduledRule', {
          schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
        });
        rule.addTarget(new targets.LambdaFunction(fn));
    }
}
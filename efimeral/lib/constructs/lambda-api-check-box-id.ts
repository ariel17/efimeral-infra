import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from 'aws-cdk-lib/aws-iam';


export interface LambdaApiCheckBoxIdProps {
  readonly sentryDSN: string;
  readonly cluster: ecs.Cluster;
  readonly layers: lambda.ILayerVersion[];
}
  
export class LambdaApiCheckBoxId extends Construct {

    public readonly fn: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: LambdaApiCheckBoxIdProps) {
        super(scope, id);

        const fn = new lambdaNodeJS.NodejsFunction(this, 'lambda-api-check-box-id', {
          description: 'Checks RUNNING state for box ID and returns its public URL if exists',
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: './lambdas/api/check-box-id.js',
          allowPublicSubnet: true,
          handler: 'handler',
          timeout: cdk.Duration.seconds(10),
          logRetention: logs.RetentionDays.ONE_WEEK,
          environment: {
            LAMBDAS_SENTRY_DSN: props.sentryDSN,
            CORS_DISABLED: "true",
            CLUSTER_ARN: props.cluster.clusterArn,
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
          actions: ['ecs:DescribeTasks', 'ec2:DescribeNetworkInterfaces'],
          resources: ["*"],
          effect: iam.Effect.ALLOW,
        });
        fn.addToRolePolicy(policy);
    }
}
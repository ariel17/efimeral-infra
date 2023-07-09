import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from 'aws-cdk-lib/aws-iam';


export interface LambdaApiCreateBoxProps {
  readonly sentryDSN: string;
  readonly vpc: ec2.Vpc;
  readonly sg: ec2.SecurityGroup;
  readonly cluster: ecs.Cluster;
  readonly layers: lambda.ILayerVersion[];
  readonly availableTags: string[];
  readonly taskDetails: {[key: string]: any };
}
  
export class LambdaApiCreateBox extends Construct {

    public readonly fn: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: LambdaApiCreateBoxProps) {
        super(scope, id);

      const fn = new lambdaNodeJS.NodejsFunction(this, 'api-create-box', {
        description: 'Creates new instances on Fargate cluster and returns the task ID as box ID.',
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: './lambdas/api/create-box.js',
        allowPublicSubnet: true,
        handler: 'handler',
        timeout: cdk.Duration.seconds(10),
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          LAMBDAS_SENTRY_DSN: props.sentryDSN,
          CORS_DISABLED: "true",
          CLUSTER_ARN: props.cluster.clusterArn,
          MAX_ALLOWED_RUNNING_TASKS: "10",
          TASK_DETAILS: JSON.stringify(props.taskDetails),
          DEFAULT_TAG: 'alpine',
          AVAILABLE_TAGS: JSON.stringify(props.availableTags),
          SUBNET_ID: props.vpc.publicSubnets[0].subnetId,
          SECURITY_GROUP_ID: props.sg.securityGroupId,
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
        actions: ['ecs:RunTask', 'ecs:ListTasks',],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      });
      fn.addToRolePolicy(policy);
    }
}
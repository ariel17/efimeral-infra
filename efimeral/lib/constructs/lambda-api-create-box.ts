import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as boxtask from './box-task';


export interface LambdaApiCreateBoxProps {
  readonly sentryDSN: string;
  readonly vpc: ec2.Vpc;
  readonly sg: ec2.SecurityGroup;
  readonly cluster: ecs.Cluster;
  readonly layers: lambda.ILayerVersion[];
  readonly availableTags: string[];
  readonly tasks: boxtask.BoxTask[];
}
  
interface TaskDetailsProps {
  readonly arn: string;
  readonly launchType: string;
}
  
export class LambdaApiCreateBox extends Construct {

    public readonly fn: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: LambdaApiCreateBoxProps) {
        super(scope, id);

        const taskDetails: { [key: string]: TaskDetailsProps } = {};
        props.tasks.forEach(task => {
          taskDetails[task.name] = {
            arn: task.task.taskDefinitionArn,
            launchType: task.compatibilityString,
          };
        });

        const fn = new lambdaNodeJS.NodejsFunction(this, 'lambda-api-create-box', {
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
            TASK_DETAILS: JSON.stringify(taskDetails),
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

        props.tasks.forEach(task => task.task.grantRun(fn));

        const policy = new iam.PolicyStatement({
          actions: ['ecs:RunTask', 'ecs:ListTasks'],
          resources: ["*"],
          effect: iam.Effect.ALLOW,
        });
        fn.addToRolePolicy(policy);
    }
}
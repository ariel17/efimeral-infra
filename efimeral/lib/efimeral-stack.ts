import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from 'aws-cdk-lib/aws-iam';
import { warn } from 'console';


export const ecrRepositoyName = 'efimeral-boxes';
export const lambdaHandler = 'lambda-handler.handler';
export const containerPort = 8080;

export class EfimeralStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, ecrRepositoyName, {
      repositoryName: ecrRepositoyName,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, 'boxes-vpc', {
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'boxes-public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const sg = new ec2.SecurityGroup(this, 'boxes-vpc-sg', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Security group for boxes VPC',
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp(), 'Allow access from any IPv4 to all ports');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.allTcp(), 'Allow access from any IPv6 to all ports');

    const cluster = new ecs.Cluster(this, 'boxes-cluster', {
      clusterName: 'boxes-cluster',
      containerInsights: true,
      capacity: {
        instanceType: new ec2.InstanceType('t2.nano'),
        minCapacity: 0,
        maxCapacity: 10,
      },
      vpc: vpc
    });    

    const task = new ecs.TaskDefinition(this, 'box-task', {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '256',
      memoryMiB: '512',
    });
    task.addContainer('box', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'alpine'),
      cpu: 1,
      memoryReservationMiB: 512,
      portMappings: [
        {
          containerPort: containerPort,
          protocol: ecs.Protocol.TCP,
        },
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'box',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    const fn = new lambda.Function(this, 'lambda-handler', {
      description: 'Creates new instances on Fargate cluster and returns the public URL',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('resources'),
      allowPublicSubnet: true,
      handler: lambdaHandler,
      timeout: cdk.Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        TASK_DEFINITION_ARN: task.taskDefinitionArn,
        CLUSTER_ARN: cluster.clusterArn,
        SUBNET_ID: vpc.publicSubnets[0].subnetId,
        SECURITY_GROUP_ID: sg.securityGroupId,
        CONTAINER_PORT: `${containerPort}`,
      },
    });

    task.grantRun(fn);

    const fnPolicy = new iam.PolicyStatement({
      actions: ['ecs:DescribeTasks', 'ec2:DescribeNetworkInterfaces'],
      resources: ["*"],
      effect: iam.Effect.ALLOW,
    });
    fn.addToRolePolicy(fnPolicy);

    const api = new apigateway.RestApi(this, "boxes-api", {
      restApiName: "Container service API",
      description: "Creates new Linux boxes on demand."
    });

    const integration = new apigateway.LambdaIntegration(fn, {
      requestTemplates: { "application/json": '{ "statusCode": "201" }' }
    });

    api.root.addMethod("POST", integration);
  
    // 👇 create an Output for the API URL
    new cdk.CfnOutput(this, 'apiUrl', {value: api.url});
  }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

import * as boxesvpc from './constructs/boxes-vpc';
import * as boxtask from './constructs/box-task';


export const ecrRepositoyName = 'efimeral-boxes';
export const containerTimeoutMinutes = 10;
export const apiSubdomain = 'api.efimeral.ar';


export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, ecrRepositoyName, {
      repositoryName: ecrRepositoyName,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const boxesVpc = new boxesvpc.BoxesVpc(this, 'boxes-vpc', { maxAzs: 3});

    const cluster = new ecs.Cluster(this, 'boxes-cluster', {
      clusterName: 'boxes-cluster',
      containerInsights: true,
      capacity: {
        instanceType: new ec2.InstanceType('t2.micro'),
        minCapacity: 0,  // CHANGE THIS to 1 to support EC2 tasks
        maxCapacity: 0,  // CHANGE THIS to 1 to support EC2 tasks
      },
      vpc: boxesVpc.vpc
    });    

    const images: boxtask.BoxTaskProps[] = [
      {name: 'alpine', compatibility: ecs.Compatibility.FARGATE, repository: repository, exposePort: 8080, },
      {name: 'ubuntu', compatibility: ecs.Compatibility.FARGATE, repository: repository, exposePort: 8080, },
      {name: 'vscode', compatibility: ecs.Compatibility.FARGATE, repository: repository, exposePort: 8080, },
      {name: 'dind', compatibility: ecs.Compatibility.EC2, repository: repository, containerIsPrivileged: true, exposeFromPort: 8080, exposeToPort: 8090, },
    ]

    const tasks: { [key: string]: ecs.TaskDefinition } = {};
    const taskDetails: { [key: string]: any} = {};

    images.forEach(props => {
      const task = new boxtask.BoxTask(this, `${props.name}-box`, props);
      tasks[props.name] = task.task;
      taskDetails[props.name] = {
        arn: task.task.taskDefinitionArn,
        launchType: task.compatibilityString,
      };
    });

    const sentryDSN = secretsmanager.Secret.fromSecretNameV2(
      this, 'sentry-dsn', 'lambdasSentryDSN'
    ).secretValue.unsafeUnwrap().toString();

    const runningTasksLayer = new lambda.LayerVersion(this, 'running-tasks-layer', {
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X,
      ],
      code: lambda.Code.fromAsset('./lambdas/layers/running-tasks'),
      description: 'Adds handy methods to work with running tasks.',
    });

    const fnApiCreateBoxHandler = new lambdaNodeJS.NodejsFunction(this, 'api-create-box', {
      description: 'Creates new instances on Fargate cluster and returns the task ID as box ID.',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: './lambdas/api/create-box.js',
      allowPublicSubnet: true,
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        LAMBDAS_SENTRY_DSN: sentryDSN,
        CORS_DISABLED: "true",
        CLUSTER_ARN: cluster.clusterArn,
        MAX_ALLOWED_RUNNING_TASKS: "10",
        TASK_DETAILS: JSON.stringify(taskDetails),
        DEFAULT_TAG: 'alpine',
        AVAILABLE_TAGS: JSON.stringify(images.map(props => props.name)),
        SUBNET_ID: boxesVpc.vpc.publicSubnets[0].subnetId,
        SECURITY_GROUP_ID: boxesVpc.sg.securityGroupId,
      },
      bundling: {
        nodeModules: [
          '@sentry/serverless',
        ],
        externalModules: [
          '/opt/nodejs/running-tasks',
        ],
      },
      layers: [runningTasksLayer,]
    });

    images.forEach(props => tasks[props.name].grantRun(fnApiCreateBoxHandler));

    const fnApiCheckBoxIdHandler = new lambdaNodeJS.NodejsFunction(this, 'api-check-box-id', {
      description: 'Checks RUNNING state for box ID and returns its public URL if exists',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: './lambdas/api/check-box-id.js',
      allowPublicSubnet: true,
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        LAMBDAS_SENTRY_DSN: sentryDSN,
        CORS_DISABLED: "true",
        CLUSTER_ARN: cluster.clusterArn,
      },
      bundling: {
        nodeModules: [
          '@sentry/serverless',
        ],
        externalModules: [
          '/opt/nodejs/running-tasks',
        ],
      },
      layers: [runningTasksLayer,]
    });

    const fnApiCreateBoxPolicy = new iam.PolicyStatement({
      actions: ['ecs:RunTask', 'ecs:ListTasks',],
      resources: ["*"],
      effect: iam.Effect.ALLOW,
    });
    fnApiCreateBoxHandler.addToRolePolicy(fnApiCreateBoxPolicy);

    const fnApiCheckBoxIdPolicy = new iam.PolicyStatement({
      actions: ['ecs:DescribeTasks', 'ec2:DescribeNetworkInterfaces'],
      resources: ["*"],
      effect: iam.Effect.ALLOW,
    });
    fnApiCheckBoxIdHandler.addToRolePolicy(fnApiCheckBoxIdPolicy);

    const api = new apigateway.RestApi(this, "boxes-api", {
      restApiName: "Efimeral service API",
      description: "Linux boxes on demand.",
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
        ],
        allowMethods: ['OPTIONS', 'POST', 'GET'],
        allowOrigins: ['http://localhost:3000', 'http://efimeral.ar', 'https://efimeral.ar'],
      },
    });

    const createBoxesIntegration = new apigateway.LambdaIntegration(fnApiCreateBoxHandler, {
      requestTemplates: { "application/json": '{ "statusCode": "201" }' }
    })
    const boxesResource = api.root.addResource('boxes');
    boxesResource.addMethod('POST', createBoxesIntegration);

    const checkBoxIdIntegration = new apigateway.LambdaIntegration(fnApiCheckBoxIdHandler, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' }
    })
    const boxResource = boxesResource.addResource('{box_id}');
    boxResource.addMethod('GET', checkBoxIdIntegration);
  
    new cdk.CfnOutput(this, 'apiUrl', {value: api.url});

    const fnKiller = new lambdaNodeJS.NodejsFunction(this, 'lambda-scheduled-killer', {
      description: 'Destroys timeouted containers in RUNNING state.',
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: './lambdas/scheduled/killer.js',
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        CLUSTER_ARN: cluster.clusterArn,
        CONTAINER_TIMEOUT_MINUTES: `${containerTimeoutMinutes}`,
        LAMBDAS_SENTRY_DSN: sentryDSN,
      },
      bundling: {
        nodeModules: [
          '@sentry/serverless',
        ],
        externalModules: [
          '/opt/nodejs/running-tasks',
        ],
      },
      layers: [runningTasksLayer,]
    });

    const fnKillerPolicy = new iam.PolicyStatement({
      actions: ['ecs:ListTasks', 'ecs:DescribeTasks', 'ecs:StopTask'],
      resources: ["*"],
      effect: iam.Effect.ALLOW,
    });
    fnKiller.addToRolePolicy(fnKillerPolicy);

    const killerRule = new events.Rule(this, 'KillerScheduledRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });

    killerRule.addTarget(new targets.LambdaFunction(fnKiller));


    // API Subdomain --------------------

    const webZone = route53.PublicHostedZone.fromHostedZoneAttributes(this, 'lookup-web-hosted-zone', {
      zoneName: 'efimeral.ar',
      hostedZoneId: String(process.env.WEB_HOSTED_ZONE_ID),
    });

    const certificate = new acm.Certificate(this, 'api-certificate', {
      domainName: apiSubdomain,
      validation: acm.CertificateValidation.fromDns(webZone),
    });
  
    const domain = new apigateway.DomainName(this, 'api-subdomain', {
      domainName: apiSubdomain,
      certificate: certificate,
      endpointType: apigateway.EndpointType.REGIONAL,
    });
  
    domain.addBasePathMapping(api, {
      basePath: 'prod',
    })

    new route53.ARecord(this, 'api-subdomain-alias-record', {
      zone: webZone,
      recordName: apiSubdomain,
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(domain)),
    });
  }
}

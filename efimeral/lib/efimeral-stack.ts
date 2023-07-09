import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import * as infrastructure from './constructs/infrastructure';
import * as boxtask from './constructs/box-task';
import * as lambdaApiCreateBox from './constructs/lambda-api-create-box';
import * as lambdaApiCheckBoxId from './constructs/lambda-api-check-box-id';
import * as lambdaEventsKiller from './constructs/lambda-scheduled-killer';
import * as api from './constructs/api';


export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const infra = new infrastructure.Infrastructure(this, 'efimeral-infrastructure', {
      maxAzs: 3,
      ecrRepositoryName: 'efimeral-boxes',
      clusterEc2MinCapacity: 0,  // CHANGE THIS to 1 to support EC2 tasks
      clusterEc2MaxCapacity: 0,  // CHANGE THIS to 1 to support EC2 tasks
    });

    const images: boxtask.BoxTaskProps[] = [
      {name: 'alpine', compatibility: ecs.Compatibility.FARGATE, repository: infra.repository, exposePort: 8080, },
      {name: 'ubuntu', compatibility: ecs.Compatibility.FARGATE, repository: infra.repository, exposePort: 8080, },
      {name: 'vscode', compatibility: ecs.Compatibility.FARGATE, repository: infra.repository, exposePort: 8080, },
      {name: 'dind', compatibility: ecs.Compatibility.EC2, repository: infra.repository, containerIsPrivileged: true, exposeFromPort: 8080, exposeToPort: 8090, },
    ]

    const tasks: { [key: string]: ecs.TaskDefinition } = {};
    const taskDetails: { [key: string]: any } = {};

    images.forEach(props => {
      const task = new boxtask.BoxTask(this, `box-task-${props.name}`, props);
      tasks[props.name] = task.task;
      taskDetails[props.name] = {
        arn: task.task.taskDefinitionArn,
        launchType: task.compatibilityString,
      };
    });

    const sentryDSN = secretsmanager.Secret.fromSecretNameV2(
      this, 'sentry-dsn', 'lambdasSentryDSN'
    ).secretValue.unsafeUnwrap().toString();

    const runningTasksLayer = new lambda.LayerVersion(this, 'lambda-running-tasks-layer', {
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X,
      ],
      code: lambda.Code.fromAsset('./lambdas/layers/running-tasks'),
      description: 'Adds handy methods to work with running tasks.',
    });

    const fnApiCreateBox = new lambdaApiCreateBox.LambdaApiCreateBox(this, 'lambda-api-create-box', {
      sentryDSN: sentryDSN,
      vpc: infra.vpc,
      sg: infra.sg,
      cluster: infra.cluster,
      layers: [runningTasksLayer,],
      availableTags: images.map(props => props.name),
      taskDetails: taskDetails,
    });

    images.forEach(props => tasks[props.name].grantRun(fnApiCreateBox.fn));

    const fnApiCheckBoxId = new lambdaApiCheckBoxId.LambdaApiCheckBoxId(this, 'lambda-api-check-box-id', {
      sentryDSN: sentryDSN,
      cluster: infra.cluster,
      layers: [runningTasksLayer,],
    });

    const fnScheduledKiller = new lambdaEventsKiller.LambdaScheduledKiller(this, 'lambda-scheduled-killer', {
      sentryDSN: sentryDSN,
      cluster: infra.cluster,
      layers: [runningTasksLayer,],
      containerTimeoutMinutes: 10,
    });

    const efimeralApi = new api.Api(this, 'efimeral-rest-api', {
      allowMethods: ['OPTIONS', 'GET', 'POST'],
      allowOrigins: ['http://localhost:3000', 'http://efimeral.ar', 'https://efimeral.ar'],
      fnApiCreateBox: fnApiCreateBox,
      fnApiCheckBoxId: fnApiCheckBoxId,
      domain: 'efimeral.ar',
      apiSubdomain: 'api.efimeral.ar',
      webHostedZoneId: String(process.env.WEB_HOSTED_ZONE_ID),
    });
  }
}

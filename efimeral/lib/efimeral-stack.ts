import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";


export const ecrResourceName = 'boxes-repository';
export const ecrRepositoyName = 'efimeral-boxes';
export const vpcName = 'public-boxes-vpc';
export const ecsClusterName = 'boxes-cluster';
export const ecsClusterInstanceType = 't2.nano';
export const ecsTaskName = 'box-instantiation';
export const ecsMinCapacity = 0;
export const ecsMaxCapacity = 10;
export const containerName = 'box';
export const defaultTagImage = 'alpine';
export const taskCPUs = '256'
export const taskMemory = '512'
export const containerCPUs = 1;
export const containerMemory = 512;
export const containerStopTimeout = 7200;  // 2 hs
export const containerPort = 8080;

export class EfimeralStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, ecrRepositoyName, {
      repositoryName: ecrRepositoyName,
      imageScanOnPush: true,
    });

    const vpc = new ec2.Vpc(this, vpcName, {
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: vpcName,
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, ecsClusterName, {
      clusterName: ecsClusterName,
      containerInsights: true,
      capacity: {
        instanceType: new ec2.InstanceType(ecsClusterInstanceType),
        minCapacity: ecsMinCapacity,
        maxCapacity: ecsMaxCapacity,
      },
      vpc: vpc
    });

    const task = new ecs.TaskDefinition(this, ecsTaskName, {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: taskCPUs,
      memoryMiB: taskMemory,
    });

    const container = task.addContainer(containerName, {
      image: ecs.ContainerImage.fromEcrRepository(repository, defaultTagImage),
      cpu: containerCPUs,
      memoryReservationMiB: containerMemory,
      stopTimeout: cdk.Duration.seconds(containerStopTimeout),
      portMappings: [
        {
          containerPort: containerPort,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });
  }
}

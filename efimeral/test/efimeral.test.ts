import * as cdk from 'aws-cdk-lib';
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Template } from 'aws-cdk-lib/assertions';
import * as Efimeral from '../lib/efimeral-stack';

const stackName = "MyTestStack"

test('Stack created', () => {
  const app = new cdk.App();
    // WHEN
  const stack = new Efimeral.EfimeralStack(app, stackName);
    // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ECR::Repository', {
    RepositoryName: Efimeral.ecrRepositoyName,
    ImageScanningConfiguration: {
        ScanOnPush: true,
    }
  });

  template.hasResourceProperties('AWS::EC2::VPC', {
    Tags: [{
      Key: "Name",
      Value: `${stackName}/${Efimeral.vpcName}`
    }]
  });

  template.hasResourceProperties('AWS::EC2::Subnet', {
    CidrBlock: '10.0.0.0/16',
    MapPublicIpOnLaunch: true,
    Tags: [{
      Key: 'aws-cdk:subnet-name',
      Value: Efimeral.vpcName,
    }, {
      Key: 'aws-cdk:subnet-type',
      Value: 'Public'
    }, {
      Key: "Name",
      Value: `${stackName}/${Efimeral.vpcName}/${Efimeral.vpcName}Subnet1`
    }]
  });

  template.hasResourceProperties('AWS::EC2::Route', {
    DestinationCidrBlock: '0.0.0.0/0',
  });

  template.hasResourceProperties('AWS::EC2::InternetGateway', {
    Tags: [{
      Key: "Name",
      Value: `${stackName}/${Efimeral.vpcName}`
    }]
  });

  template.hasResourceProperties('AWS::ECS::Cluster', {
    ClusterName: Efimeral.ecsClusterName,
    ClusterSettings: [{
      Name: 'containerInsights',
      Value: 'enabled'
    }],
  });

  template.hasResourceProperties('AWS::AutoScaling::LaunchConfiguration', {
    InstanceType: Efimeral.ecsClusterInstanceType,
  });

  template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
    MinSize: `${Efimeral.ecsMinCapacity}`,
    MaxSize: `${Efimeral.ecsMaxCapacity}`,
  });

  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    Cpu: Efimeral.taskCPUs,
    Memory: Efimeral.taskMemory,
    RequiresCompatibilities: ["FARGATE"],
    ContainerDefinitions: [{
        Name: Efimeral.containerName,
        Cpu: Efimeral.containerCPUs,
        Essential: true,
        MemoryReservation: Efimeral.containerMemory,
        PortMappings: [{
            ContainerPort: Efimeral.containerPort,
            Protocol: ecs.Protocol.TCP,
        }],
        StopTimeout: Efimeral.containerStopTimeout,
    }]
  });
});

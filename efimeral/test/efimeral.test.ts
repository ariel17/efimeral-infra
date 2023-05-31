import * as cdk from 'aws-cdk-lib';
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Template } from 'aws-cdk-lib/assertions';
import * as Efimeral from '../lib/efimeral-stack';

const stackName = "MyTestStack"

test('Stack created', () => {
  const app = new cdk.App();
    // WHEN
  const stack = new Efimeral.APIStack(app, stackName, {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  });
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
      Value: `${stackName}/boxes-vpc`
    }]
  });

  template.hasResourceProperties('AWS::EC2::Subnet', {
    MapPublicIpOnLaunch: true,
    Tags: [{
      Key: 'aws-cdk:subnet-name',
      Value: 'boxes-public-subnet',
    }, {
      Key: 'aws-cdk:subnet-type',
      Value: 'Public'
    }, {
      Key: "Name",
      Value: `${stackName}/boxes-vpc/boxes-public-subnetSubnet1`
    }]
  });  

  template.hasResourceProperties('AWS::EC2::InternetGateway', {
    Tags: [{
      Key: "Name",
      Value: `${stackName}/boxes-vpc`
    }]
  });
  
  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    SecurityGroupEgress: [{
      CidrIp: '0.0.0.0/0',
      IpProtocol: "-1"
    }],
    SecurityGroupIngress: [{
      CidrIp: '0.0.0.0/0',
      FromPort: 0,
      IpProtocol: 'tcp',
      ToPort: 65535,
    }, {
      CidrIpv6: '::/0',
      FromPort: 0,
      IpProtocol: 'tcp',
      ToPort: 65535
    }]
  });
  
  template.hasResourceProperties('AWS::ECS::Cluster', {
    ClusterName: 'boxes-cluster',
    ClusterSettings: [{
      Name: 'containerInsights',
      Value: 'enabled'
    }],
  });
  
  template.hasResourceProperties('AWS::AutoScaling::LaunchConfiguration', {
    InstanceType: 't2.nano',
  });
  
  template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
    MinSize: '0',
    MaxSize: '3',
  });  

  Efimeral.imageTags.forEach(tag => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '256',
      Memory: '512',
      RequiresCompatibilities: ['FARGATE'],
      ContainerDefinitions: [{
          Name: `box-${tag}`,
          Cpu: 1,
          Essential: true,
          MemoryReservation: 512,
          PortMappings: [{
              ContainerPort: 8080,
              Protocol: ecs.Protocol.TCP,
          }],
      }],
    });
  });

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.handler',
    Runtime: 'nodejs18.x',
    Timeout: 10,
  });

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.handler',
    Runtime: 'nodejs18.x',
    Timeout: 60,
  });

  template.hasResource('AWS::ApiGateway::RestApi', {});

  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'POST',
    Integration: {
      IntegrationHttpMethod: 'POST',
      RequestTemplates: {
        'application/json': '{ "statusCode": "201" }',
      },
      Type: 'AWS_PROXY',
    },
  });
  
});

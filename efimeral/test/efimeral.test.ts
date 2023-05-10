import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Efimeral from '../lib/efimeral-stack';

const stackName = "MyTestStack"

test('ECR repository created', () => {
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
      Value: `${stackName}/${Efimeral.vpcResourceName}`
    }]
  });

  template.hasResourceProperties('AWS::EC2::Subnet', {
    CidrBlock: '10.0.0.0/16',
    MapPublicIpOnLaunch: true,
    Tags: [{
      Key: 'aws-cdk:subnet-name',
      Value: Efimeral.vpcPublicSubnetName,
    }, {
      Key: 'aws-cdk:subnet-type',
      Value: 'Public'
    }, {
      Key: "Name",
      Value: `${stackName}/${Efimeral.vpcResourceName}/${Efimeral.vpcPublicSubnetName}Subnet1`
    }]
  });

  template.hasResourceProperties('AWS::EC2::Route', {
    DestinationCidrBlock: '0.0.0.0/0',
  });

  template.hasResourceProperties('AWS::EC2::InternetGateway', {
    Tags: [{
      Key: "Name",
      Value: `${stackName}/${Efimeral.vpcResourceName}`
    }]
  });
});

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export const ecrResourceName = 'efimeral-repository';
export const ecrRepositoyName = 'efimeral-boxes';
export const vpcResourceName = 'efimeral-boxes-vpc';
export const vpcPublicSubnetName = 'public-boxes-subnet'

export class EfimeralStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, ecrResourceName, {
      repositoryName: ecrRepositoyName,
      imageScanOnPush: true,
    });

    const vpc = new ec2.Vpc(this, vpcResourceName, {
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: vpcPublicSubnetName,
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });
  }
}

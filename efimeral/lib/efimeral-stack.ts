import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';


export class EfimeralStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cfnPublicRepository = new ecr.CfnPublicRepository(this, 'public-efimeral-boxes', {
      repositoryName: 'efimeral-boxes',
    });
  }
}

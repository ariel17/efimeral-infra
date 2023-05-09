import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export const repositoyName = 'efimeral-boxes';

export class EfimeralStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, 'efimeral-repository', {
      repositoryName: repositoyName,
      imageScanOnPush: true,
    });
  }
}

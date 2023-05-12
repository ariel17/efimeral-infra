import * as cdk from 'aws-cdk-lib';
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Template } from 'aws-cdk-lib/assertions';
import * as Efimeral from '../lib/efimeral-stack';
import * as lambda from "aws-cdk-lib/aws-lambda";

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

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: Efimeral.lambdaHandler,
    Runtime: 'nodejs16.x',
  });
});

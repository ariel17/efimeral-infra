import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Efimeral from '../lib/efimeral-stack';

test('ECR repository created', () => {
  const app = new cdk.App();
    // WHEN
  const stack = new Efimeral.EfimeralStack(app, 'MyTestStack');
    // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ECR::Repository', {
    RepositoryName: Efimeral.repositoyName,
    ImageScanningConfiguration: {
        ScanOnPush: true,
    }
  });
});

#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { APIStack } from '../lib/efimeral-stack';

const stackName = 'EfimeralAPIStack';

const app = new cdk.App();
const stack = new APIStack(app, stackName, {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
cdk.Tags.of(stack).add('StackType', stackName);
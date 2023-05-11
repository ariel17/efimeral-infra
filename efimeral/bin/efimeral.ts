#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EfimeralStack } from '../lib/efimeral-stack';

const stackName = 'EfimeralStack';

const app = new cdk.App();
const stack = new EfimeralStack(app, stackName, {});
cdk.Tags.of(stack).add('StackType', stackName);
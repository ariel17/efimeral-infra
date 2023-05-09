#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EfimeralStack } from '../lib/efimeral-stack';

const app = new cdk.App();
new EfimeralStack(app, 'EfimeralStack', {
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
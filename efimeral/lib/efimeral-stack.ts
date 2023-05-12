import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";


export const ecrRepositoyName = 'efimeral-boxes';
export const lambdaHandler = 'lambda-handler.handler';

export class EfimeralStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, ecrRepositoyName, {
      repositoryName: ecrRepositoyName,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, 'boxes-vpc', {
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: 'boxes-public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, 'boxes-cluster', {
      clusterName: 'boxes-cluster',
      containerInsights: true,
      capacity: {
        instanceType: new ec2.InstanceType('t2.nano'),
        minCapacity: 0,
        maxCapacity: 10,
      },
      vpc: vpc
    });    

    const fn = new lambda.Function(this, 'lambda-handler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset('resources'),
      allowPublicSubnet: true,
      handler: lambdaHandler,
      environment: {
      },
      vpc: vpc,
    });

    const api = new apigateway.RestApi(this, "boxes-api", {
      restApiName: "Container service API",
      description: "Creates new Linux boxes on demand."
    });

    const integration = new apigateway.LambdaIntegration(fn, {
      requestTemplates: { "application/json": '{ "statusCode": "201" }' }
    });

    api.root.addMethod("POST", integration);
  
    // 👇 create an Output for the API URL
    new cdk.CfnOutput(this, 'apiUrl', {value: api.url});
  }
}

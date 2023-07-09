import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambdaApiCreateBox from './lambda-api-create-box';
import * as lambdaApiCheckBoxId from './lambda-api-check-box-id';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';


export interface ApiProps {
  readonly fnApiCreateBox: lambdaApiCreateBox.LambdaApiCreateBox;
  readonly fnApiCheckBoxId: lambdaApiCheckBoxId.LambdaApiCheckBoxId;
  readonly domain: string;
  readonly apiSubdomain: string;
  readonly webHostedZoneId: string;
}

export class Api extends Construct {

    public readonly restApi: apigateway.RestApi;

    constructor(scope: Construct, id: string, props: ApiProps) {
        super(scope, id);

        const restApi = new apigateway.RestApi(this, "boxes-api", {
          restApiName: "Efimeral service API",
          description: "Linux boxes on demand.",
          defaultCorsPreflightOptions: {
            allowHeaders: [
              'Content-Type',
            ],
            allowMethods: ['OPTIONS', 'POST', 'GET'],
            allowOrigins: ['http://localhost:3000', 'http://efimeral.ar', 'https://efimeral.ar'],
          },
        });
        this.restApi = restApi;

        const createBoxesIntegration = new apigateway.LambdaIntegration(props.fnApiCreateBox.fn, {
          requestTemplates: { "application/json": '{ "statusCode": "201" }' }
        })
        const boxesResource = restApi.root.addResource('boxes');
        boxesResource.addMethod('POST', createBoxesIntegration);

        const checkBoxIdIntegration = new apigateway.LambdaIntegration(props.fnApiCheckBoxId.fn, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' }
        })
        const boxResource = boxesResource.addResource('{box_id}');
        boxResource.addMethod('GET', checkBoxIdIntegration);
  
        new cdk.CfnOutput(this, 'apiUrl', {value: restApi.url});

        // API Subdomain --------------------
        const webZone = route53.PublicHostedZone.fromHostedZoneAttributes(this, 'lookup-web-hosted-zone', {
          zoneName: props.domain,
          hostedZoneId: props.webHostedZoneId,
        });

        const certificate = new acm.Certificate(this, 'api-certificate', {
          domainName: props.apiSubdomain,
          validation: acm.CertificateValidation.fromDns(webZone),
        });
  
        const domain = new apigateway.DomainName(this, 'api-subdomain', {
          domainName: props.apiSubdomain,
          certificate: certificate,
          endpointType: apigateway.EndpointType.REGIONAL,
        });
  
        domain.addBasePathMapping(restApi, {
          basePath: 'prod',
        })

        new route53.ARecord(this, 'api-subdomain-alias-record', {
          zone: webZone,
          recordName: props.apiSubdomain,
          target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(domain)),
        });
    }
}
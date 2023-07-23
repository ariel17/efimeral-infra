import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";


export interface InfrastructureProps {
  readonly ecrRepositoryName: string;
  readonly maxAzs: number;
  readonly clusterEc2MinCapacity: number;
  readonly clusterEc2MaxCapacity: number;
  readonly boxesSubDomain: string;
}

export class Infrastructure extends Construct {

    public readonly repository: ecr.Repository;
    public readonly vpc: ec2.Vpc;
    public readonly sg: ec2.SecurityGroup;
    public readonly cluster: ecs.Cluster;
    public readonly ns: servicediscovery.PublicDnsNamespace;
    public readonly service: servicediscovery.Service;

    constructor(scope: Construct, id: string, props: InfrastructureProps) {
        super(scope, id);

        const repository = new ecr.Repository(this, 'boxes-docker-repository', {
          repositoryName: props.ecrRepositoryName,
          imageScanOnPush: true,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.repository = repository;

        const vpc = new ec2.Vpc(this, 'boxes-vpc', {
          maxAzs: props.maxAzs,
          natGateways: 0,
          subnetConfiguration: [
            {
              name: 'boxes-public-subnet',
              subnetType: ec2.SubnetType.PUBLIC,
            },
          ],
        });
        this.vpc = vpc;

        const sg = new ec2.SecurityGroup(this, 'boxes-vpc-sg', {
          vpc: vpc,
          allowAllOutbound: true,
          description: 'Security group for boxes VPC',
        });
        this.sg = sg;
        
        sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp(), 'Allow access from any IPv4 to all ports');
        sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.allTcp(), 'Allow access from any IPv6 to all ports');

        const cluster = new ecs.Cluster(this, 'boxes-cluster', {
          clusterName: 'boxes-cluster',
          containerInsights: true,
          capacity: {
            instanceType: new ec2.InstanceType('t2.micro'),
            minCapacity: props.clusterEc2MinCapacity,
            maxCapacity: props.clusterEc2MaxCapacity,
          },
          vpc: vpc,
        }); 
        this.cluster = cluster;

        const ns = new servicediscovery.PublicDnsNamespace(this, 'boxes-ns', {
          name: props.boxesSubDomain,
          description: 'Namespace for boxes',
        });
        this.ns = ns;
  
        const service = new servicediscovery.Service(this, 'boxes-ns-service', {
          namespace: ns,
        });
        this.service = service;
    }
}
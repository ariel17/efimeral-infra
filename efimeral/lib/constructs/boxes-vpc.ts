import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export interface BoxesVPCProps {
  readonly maxAzs: number;
}

export class BoxesVpc extends Construct {

    public readonly vpc: ec2.Vpc;
    public readonly sg: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props: BoxesVPCProps) {
        super(scope, id);

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
    }
}
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from "aws-cdk-lib/aws-logs";


export interface BoxTaskProps {
  readonly name: string;
  readonly compatibility: ecs.Compatibility;
  readonly repository?: ecr.Repository;
  readonly image?: string;
  readonly containerEnvironment?: {[key: string]: string};
  readonly containerIsPrivileged?: boolean;
  readonly exposePort?: number;
  readonly exposeFromPort?: number;
  readonly exposeToPort?: number;
}
  
export class BoxTask extends Construct {

    public readonly name: string;
    public readonly task: ecs.TaskDefinition;
    public readonly container: ecs.ContainerDefinition;
    public readonly image: ecs.ContainerImage;
    public readonly compatibilityString: string;

    constructor(scope: Construct, id: string, props: BoxTaskProps) {
        super(scope, id);

        this.name = props.name;
        this.compatibilityString = props.compatibility === ecs.Compatibility.FARGATE ? 'FARGATE' : 'EC2';

        const task = new ecs.TaskDefinition(this, `task-${props.name}`, {
          compatibility: props.compatibility,
          cpu: '256',
          memoryMiB: '512',
        });
        this.task = task;
  
        let image: ecs.ContainerImage;
        if (props.repository !== undefined) {
          image = ecs.ContainerImage.fromEcrRepository(props.repository, props.name);
        } else {
          image = ecs.ContainerImage.fromRegistry(props.image || '');
        }
        this.image = image;
  
        const container = task.addContainer(`container-${props.name}`, {
          image: image,
          cpu: 1,
          memoryReservationMiB: 512,
          logging: ecs.LogDrivers.awsLogs({
            streamPrefix: `box-${props.name}`,
            logRetention: logs.RetentionDays.ONE_WEEK,
          }),
          environment: props.containerEnvironment || {},
          privileged: props.containerIsPrivileged || false,
        });
        this.container = container;
      
        if (props.exposePort !== undefined) {
          container.addPortMappings({
            containerPort: props.exposePort,
            protocol: ecs.Protocol.TCP,
          });
        }
      
        if (props.exposeFromPort !== undefined && props.exposeToPort !== undefined) {
          const portMappings: ecs.PortMapping[] = [];
          for (let i = props.exposeFromPort; i <= props.exposeToPort; i++) {
            portMappings.push({
              containerPort: i,
              protocol: ecs.Protocol.TCP,
            });
          }
          container.addPortMappings(...portMappings);
        }
    }
}
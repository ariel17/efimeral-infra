const { EC2 } = require("@aws-sdk/client-ec2");
const { ECS, waitUntilTasksRunning } = require("@aws-sdk/client-ecs");


exports.handler = async (event, context) => {
  const ecs = new ECS();
  try {
    const runTaskData = await runTask(ecs);
    const waitData = await waitForRunningState(ecs, runTaskData.tasks[0].taskArn);
    const containerURL = await getContainerURL(waitData.reason.tasks[0].attachments[0].details);

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Container created',
        url: containerURL,
      }),
    };

  } catch(e) {
    console.error(e, e.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating container',
        error: `${e}`,
      })
    };
  };
};

async function runTask(ecs) {
  const taskParams = {
    taskDefinition: process.env.TASK_DEFINITION_ARN, 
    cluster: process.env.CLUSTER_ARN,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
        subnets: [process.env.SUBNET_ID],
        securityGroups: [process.env.SECURITY_GROUP_ID]
      }
    },
    count: 1,
    startedBy: 'lambda-function'
  };

  var runTaskData = await ecs.runTask(taskParams);
  console.log(`Task executed: ${JSON.stringify(runTaskData)}`);
 
  return runTaskData;
}

async function waitForRunningState(ecs, taskArn) {
  const waitParams = {
    cluster: process.env.CLUSTER_ARN,
    tasks: [taskArn,]
  }

  var waitData = await waitUntilTasksRunning({
    client: ecs,
    maxWaitTime: 200
  }, waitParams);
  console.log(`Task is in RUNNING state: ${JSON.stringify(waitData)}`);

  return waitData;
}

async function getContainerURL(details) {
  let eni = '';
  for (let i = 0; i < details.length; i++) {
    if (details[i].name === 'networkInterfaceId') {
      eni = details[i].value;
      break;
    }
  }
  
  if (eni === '') {
    throw 'Cannot obtain network interface ID';
  }
  
  const networkParams = {
    NetworkInterfaceIds: [eni],
  }

  const ec2 = new EC2();
  const networkData = await ec2.describeNetworkInterfaces(networkParams);
  console.log(`Network data: ${JSON.stringify(networkData)}`);
  
  return `http://${networkData.NetworkInterfaces[0].Association.PublicDnsName}:${process.env.CONTAINER_PORT}`
}
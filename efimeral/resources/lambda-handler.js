const AWS = require('aws-sdk');
const ecs = new AWS.ECS();
const ec2 = new AWS.EC2();


exports.handler = async (event, context) => {
  console.log(`Env parameters: ${JSON.stringify(process.env)}`);


  try {
    const runTaskData = runTask();
    const waitData = waitForRunningState(runTaskData.tasks[0].taskArn);
    const containerURL = getContainerURL(waitData.tasks[0].attachments[0].details);

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
        error: e,
      })
    };
  };
};

async function createTask() {
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

  const runTaskData = await ecs.runTask(taskParams).promise();
  console.log(`Task executed: ${JSON.stringify(runTaskData)}`);
 
  return runTaskData;
}

async function waitForRunningState(taskArn) {
  const waitParams = {
    cluster: process.env.CLUSTER_ARN,
    tasks: [taskArn,]
  }

  const waitData = await ecs.waitFor('tasksRunning', waitParams).promise();
  console.log(`Task is in RUNNING state: ${JSON.stringify(waitData)}`);

  return waitData;
}

async function getContainerURL(taskAttachmentDetails) {
  let eni = '';
  for (let i = 0; i < tasksAttachmentDetails.length; i++) {
    if (taskAttachmentDetails[i].name === 'networkInterfaceId') {
      eni = taskAttachmentDetails[i].value;
      break;
    }
  }
  
  if (eni === '') {
    throw 'Cannot obtain network interface ID';
  }
  
  const networkParams = {
    NetworkInterfaceIds: [eni],
  }
  const networkData = await ec2.describeNetworkInterfaces(networkParams).promise();
  console.log(`Network data: ${JSON.stringify(networkData)}`);
  
  return `http://${networkData.NetworkInterfaces[0].Association.PublicDnsName}:${process.env.CONTAINER_PORT}`
}
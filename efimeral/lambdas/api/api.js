const { EC2 } = require("@aws-sdk/client-ec2");
const { ECS, waitUntilTasksRunning } = require("@aws-sdk/client-ecs");
const Sentry = require("@sentry/serverless");

Sentry.AWSLambda.init({
  dsn: process.env.LAMBDAS_SENTRY_DSN,
  tracesSampleRate: 0.1,
  timeoutWarningLimit: 40000,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  const ecs = new ECS();
  try {
    const runTaskData = await runTask(ecs);
    const waitData = await waitForRunningState(ecs, runTaskData.tasks[0].taskArn);
    const containerURL = await getContainerURL(waitData.reason.tasks[0].attachments[0].details);

    let headers = {
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Methods": "POST"
    }
    if (process.env.CORS_DISABLED === "true") {
        headers["Access-Control-Allow-Origin"] = "*"
    }

    return {
      statusCode: 201,
      headers: headers,
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
});

async function runTask(ecs) {
  const params = {
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

  var data = await ecs.runTask(params);
  console.log(`Task executed: ${JSON.stringify(data)}`);
 
  return data;
}

async function waitForRunningState(ecs, taskArn) {
  const params = {
    cluster: process.env.CLUSTER_ARN,
    tasks: [taskArn,]
  }

  var data = await waitUntilTasksRunning({
    client: ecs,
    maxWaitTime: 200
  }, params);
  console.log(`Task is in RUNNING state: ${JSON.stringify(data)}`);

  return data;
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
  
  const params = {
    NetworkInterfaceIds: [eni],
  }

  const ec2 = new EC2();
  const data = await ec2.describeNetworkInterfaces(params);
  console.log(`Network data: ${JSON.stringify(data)}`);
  
  return `http://${data.NetworkInterfaces[0].Association.PublicDnsName}:${process.env.CONTAINER_PORT}`
}

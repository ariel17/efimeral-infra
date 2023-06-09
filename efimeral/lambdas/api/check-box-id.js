const { EC2 } = require("@aws-sdk/client-ec2");
const { ECS } = require("@aws-sdk/client-ecs");
const Sentry = require("@sentry/serverless");


Sentry.AWSLambda.init({
  dsn: process.env.LAMBDAS_SENTRY_DSN,
  tracesSampleRate: 0.1,
  timeoutWarningLimit: 40000,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  let headers = {
      "Access-Control-Allow-Headers" : "Content-Type",
      "Access-Control-Allow-Methods": "POST"
  }
  if (process.env.CORS_DISABLED === "true") {
      headers["Access-Control-Allow-Origin"] = "*"
  }

  const ecs = new ECS();
  
  try {
    const task = await getRunningTaskById(process.env.CLUSTER_ARN, event.pathParameters.box_id, ecs);
    if (task === undefined) {
      return {
        statusCode: 404,
        headers: headers,
        body: JSON.stringify({
          message: 'Not found',
        }),
      };
    }

    const containerURL = await getContainerURL(task.attachments[0].details, task.containers[0].networkBindings[0].containerPort);
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        message: 'Box is ready',
        url: containerURL,
      }),
    };

  } catch(e) {
    console.error(e, e.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating box',
        error: `${e}`,
      })
    };
  };
});

async function getRunningTaskById(clusterArn, taskId, ecs) {
  const params = {
    cluster: clusterArn,
    tasks: [taskId,]
  };
  var tasks = await ecs.describeTasks(params);
  console.log(`Tasks description: ${JSON.stringify(tasks)}`);
 
  if (tasks.tasks.length > 0) {
    let task = tasks.tasks[0];
    if (task.lastStatus === 'RUNNING') {
      console.log(`Task id=${taskId} is running :)`);
      return task;
    }
  }

  return undefined;
}

async function getContainerURL(details, containerPort) {
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
  
  return `http://${data.NetworkInterfaces[0].Association.PublicDnsName}:${containerPort}`
}

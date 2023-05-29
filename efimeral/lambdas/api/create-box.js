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
    const runningTasks = await getRunningTasks(process.env.CLUSTER_ARN, ecs);
    if (runningTasks.length >= Number(process.env.MAX_ALLOWED_RUNNING_TASKS)) {
      return {
        statusCode: 429,
        headers: headers,
        body: JSON.stringify({
          message: 'Error creating box',
          error: 'Max amount of boxes reached',
        }),
      };
    }

    const runTaskData = await runTask(ecs);
    return {
      statusCode: 201,
      headers: headers,
      body: JSON.stringify({
        message: 'Box created',
        box_id: getTaskId(runTaskData.tasks[0].taskArn),
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

function getTaskId(taskArn) {
  const parts = taskArn.split('/');
  return parts[parts.length - 1];
}

async function getRunningTasks(clusterArn, ecs) {
  const params = {
    cluster: clusterArn,
    desiredStatus: 'RUNNING',
  };
  var running = await ecs.listTasks(params);
  console.log(`Tasks running: ${JSON.stringify(running)}`);
 
  return running.taskArns;
}

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

const { ECS } = require("@aws-sdk/client-ecs");
const Sentry = require("@sentry/serverless");
const { EventBridge } = require("@aws-sdk/client-eventbridge");
const { getRunningTasks } = require('/opt/nodejs/running-tasks');


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

    let tag;
    try {
      tag = getTypeFromBodyAndValidate(event.body);

    } catch (e) {
      console.error('Invalid request', event.body, e);
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({
          message: 'Invalid request',
          error: e,
        })      
      }
    }

    const runTaskData = await runTask(ecs, tag);
    if (runTaskData.tasks.length === 0) {
      throw String(runTaskData.failures[0].reason);
    }

    const eb = new EventBridge();
    const params = {
      Entries: [
        {
          Source: 'lambda-api-create-box',
          DetailType: 'pending-domain-creation',
          Time: new Date(),
          EventBusName: process.env.EVENT_BUS_ARN,
          Detail: JSON.stringify({
            taskArn: runTaskData.tasks[0].taskArn,
          }),
        }
      ],
    };
    const eventResult = await eb.putEvents(params);
    console.log("Pending domain event send result: ", eventResult);
    if (eventResult.FailedEntryCount > 0) {
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({
          message: 'Failed to send pending domain event',
          error: eventResult.Entries[0].ErrorMessage,
        }),
      };
    }

    return {
      statusCode: 201,
      headers: headers,
      body: JSON.stringify({
        message: 'Box created',
        box_id: getTaskId(runTaskData.tasks[0].taskArn),
        type: tag,
      }),
    };

  } catch(e) {
    console.error(e, e.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating box',
        error: e,
      })
    };
  };
});

function getTaskId(taskArn) {
  const parts = taskArn.split('/');
  return parts[parts.length - 1];
}

async function runTask(ecs, tag) {
  const taskDetails = JSON.parse(process.env.TASK_DETAILS)
  console.log('Task details', taskDetails);

  let networkConfig = undefined;
  if (taskDetails[tag].launchType === 'FARGATE') {
    networkConfig = {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
        subnets: [process.env.SUBNET_ID],
        securityGroups: [process.env.SECURITY_GROUP_ID]
      }
    };
  }

  const params = {
    taskDefinition: taskDetails[tag].arn, 
    cluster: process.env.CLUSTER_ARN,
    launchType: taskDetails[tag].launchType,
    networkConfiguration: networkConfig,
    count: 1,
    startedBy: 'lambda-create-box'
  };

  var data = await ecs.runTask(params);
  console.log(`Task executed: ${JSON.stringify(data)}`);
 
  return data;
}

function getTypeFromBodyAndValidate(rawBody) {
  if (rawBody === undefined || rawBody === null) {
    return process.env.DEFAULT_TAG;
  }

  const body = JSON.parse(rawBody)
  if (body.type === undefined || body.type === null) {
    throw "Missing type";
  }

  let isValid = false;
  const validTypes = JSON.parse(process.env.AVAILABLE_TAGS);
  validTypes.forEach(tag => {
    if (tag === body.type) {
      isValid = true;
    }
  });

  if (!isValid) {
    throw "Invalid type";
  }
  
  return body.type;
}
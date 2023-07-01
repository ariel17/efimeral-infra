const { EC2 } = require("@aws-sdk/client-ec2");
const { ECS } = require("@aws-sdk/client-ecs");
const Sentry = require("@sentry/serverless");
const { boxPorts, getRunningTaskById } = require('/opt/nodejs/running-tasks');


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

    const containerURL = await getContainerURL(task);
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
        message: 'Error checking box',
        error: `${e}`,
      })
    };
  };
});

async function getContainerURL(task) {
  const details = task.attachments[0].details;
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
  
  return `http://${data.NetworkInterfaces[0].Association.PublicDnsName}:${boxPorts[task.containers[0].name]}`
}

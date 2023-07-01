const { ECS } = require("@aws-sdk/client-ecs");
const Sentry = require("@sentry/serverless");
const { getRunningTasks } = require('/opt/nodejs/running-tasks');


Sentry.AWSLambda.init({
  dsn: process.env.LAMBDAS_SENTRY_DSN,
  tracesSampleRate: 0.1,
  timeoutWarningLimit: 40000,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  const ecs = new ECS();

  try {
    const runningTasks = await getRunningTasks(process.env.CLUSTER_ARN, ecs);
    const total = await killTimeoutedTasks(ecs, runningTasks);
    return `${total} tasks killed`

  } catch(e) {
    console.error(e, e.stack)
  };
});

async function killTimeoutedTasks(ecs, taskArns) {
    if (taskArns.length == 0) {
      return 0;
    }

    const describeParams = {
        cluster: process.env.CLUSTER_ARN,
        tasks: taskArns,
    };

    const descriptions = await ecs.describeTasks(describeParams)

    const now = new Date();
    let killed = 0;
    for (var i = 0; i < descriptions.tasks.length; i++) {
        let task = descriptions.tasks[i];
        if (!containerIsTimeouted(task.createdAt)) {
          continue;
        }
      
        console.log(`Task is timeouted: createdAt=${task.createdAt}, timeout=${process.env.CONTAINER_TIMEOUT_MINUTES}`);
        let params = {
            cluster: process.env.CLUSTER_ARN,
            task: task.taskArn,
        }
        let response = await ecs.stopTask(params);
        console.log(`Task STOPPED: ${JSON.stringify(response)}`);
        killed++;
    };

    return killed;
}

function containerIsTimeouted(createdAt) {
    const now = new Date();
    const elapsedTimeMs = now - createdAt;
    const elapsedMinutes = elapsedTimeMs / 1000 / 60;
    return elapsedMinutes >= Number(process.env.CONTAINER_TIMEOUT_MINUTES);
} 
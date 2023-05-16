const { ECS, waitUntilTasksRunning } = require("@aws-sdk/client-ecs");


exports.handler = async (event, context) => {
  const ecs = new ECS();
  let killed = 0;

  try {
    killed = await killTimeoutedTasks(ecs, getRunningTasks(ecs));
  } catch(e) {
    console.error(e, e.stack)
  };

  return `${killed} tasks killed`
};

async function getRunningTasks(ecs) {
  const params = {
    cluster: process.env.CLUSTER_ARN,
    desiredStatus: 'RUNNING',
  };
  var running = await ecs.listTasks(params);
  console.log(`Tasks running: ${JSON.stringify(running)}`);
 
  return running.taskArns;
}

async function killTimeoutedTasks(ecs, taskArns) {
    const describeParams = {
        cluster: process.env.CLUSTER_ARN,
        tasks: taskArns,
    };
    const descriptions = await ecs.describeTasks(describeParams)

    const now = new Date();
    let killed = 0;
    for (var i = 0; i < descriptions.tasks.length; i++) {
        task = descriptions.tasks[i];
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
    elapsedTimeMs = now - createdAt;
    elapsedMinutes = elapsedTimeMs / 1000 / 60;
    return elapsedMinutes >= Number(process.env.CONTAINER_TIMEOUT_MINUTES);
} 
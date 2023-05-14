const AWS = require('aws-sdk');
const ecs = new AWS.ECS();


exports.handler = async (event, context) => {
  console.log(`Env parameters: ${JSON.stringify(process.env)}`);

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
  console.log(`Creating task... parameters: ${JSON.stringify(taskParams)}`);

  try {
    const runTaskData = await ecs.runTask(taskParams).promise();
    console.log(`Task executed: ${JSON.stringify(runTaskData)}`);
  
    const waitParams = {
      cluster: process.env.CLUSTER_ARN,
      tasks: [runTaskData['tasks'][0]['taskArn'],]
    }
    console.log(`Checking task running state... parameters: ${JSON.stringify(waitParams)}`);

    const waitData = await ecs.waitFor('tasksRunning', waitParams).promise();
    console.log(`Task is in RUNNING state: ${JSON.stringify(waitData)}`);

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Container created',
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
const AWS = require('aws-sdk');
const ecs = new AWS.ECS();

exports.handler = async (event, context) => {
  const taskDefinitionArn = process.env.TASK_DEFINITION_ARN;
  const clusterArn = process.env.CLUSTER_ARN;

  // Define the ECS task input payload
  const payload = {
    key: 'value'
  };

  // Define the ECS task parameters
  const params = {
    taskDefinition: taskDefinitionArn,
    cluster: clusterArn,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [process.env.SUBNET_ID],
        securityGroups: [process.env.SECURITY_GROUP_ID],
        assignPublicIp: true,
      }
    },
    overrides: {
      timeout: {
        hardLimit: Number(process.env.CONTAINER_HARD_LIMIT_TIMEOUT),
      },
    },
    count: 1,
    platformVersion: '1.4.0',
    startedBy: 'lambda-function'
  };

  try {
    // Call the ECS RunTask API
    const data = await ecs.runTask(params).promise();
    console.log(`Task started: ${data.tasks[0].taskArn}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Task started',
        taskArn: data.tasks[0].taskArn
      })
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error starting task'
      })
    };
  }
};
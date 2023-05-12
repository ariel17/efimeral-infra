const AWS = require('aws-sdk');
const ecs = new AWS.ECS();

exports.handler = async (event, context) => {
  console.log(`Env parameters: ${JSON.stringify(process.env)}`);

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

  console.log(`Creating task... parameters: ${JSON.stringify(params)}`);
  try {
    const data = await ecs.runTask(params).promise();
    console.log(`Task executed: ${JSON.stringify(data)}`);
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Container created',
      })
    };
  
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating container',
        error: err.body,
      })
    };
  }
};
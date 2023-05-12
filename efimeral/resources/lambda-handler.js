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
  let runTaskPromise = ecs.runTask(params).promise();

  runTaskPromise.then(data => {
    console.log(`Task executed: ${JSON.stringify(data)}`);
    let params = {
      cluster: process.env.CLUSTER_ARN,
      tasks: [process.env.TASK_DEFINITION_ARN,]
    }

    ecs.waitFor('tasksRunning', params).then(data => {
      console.log(`Task is in RUNNING state: ${JSON.stringify(data)}`);
      return {
        statusCode: 201,
        body: JSON.stringify({
          message: 'Container created',
        }),
      };

    }).catch(e => {
      console.error(e, e.stack)
    });

  }).catch(err => {
    console.error(e, e.stack)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating container',
        error: err.body,
      })
    };
  });
};
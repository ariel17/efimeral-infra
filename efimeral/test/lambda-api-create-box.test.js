const { ECSClient, RunTaskCommand, ListTasksCommand } = require("@aws-sdk/client-ecs");
const { mockClient } = require("aws-sdk-client-mock");

const lambdaFunction = require("../lambdas/api/create-box");

const ecsMock = mockClient(ECSClient);

describe("Create box", () => {
  const ENV = process.env;
  
  afterEach(() => {
	ecsMock.reset();
  });

  afterAll(() => {
    process.env = ENV;
  });

  test("should create container successfully", async () => {
    ecsMock.on(ListTasksCommand).resolves({
		taskArns: [],
	});
    ecsMock.on(RunTaskCommand).resolves({
		tasks: [{
			taskArn: 'fakeARN/fakeTaskId',
		}]
	});

    const result = await lambdaFunction.handler({}, {callbackWaitsForEmptyEventLoop: false});
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Box created\",\"box_id\":\"fakeTaskId\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 201
	});
  });

  test("should return 429 if maximum boxes are up", async () => {
	process.env.MAX_ALLOWED_RUNNING_TASKS = "1";
    ecsMock.on(ListTasksCommand).resolves({
		taskArns: ['fakeARN1','fakeARN2',],
	});	

    const result = await lambdaFunction.handler({}, {callbackWaitsForEmptyEventLoop: false});
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Error creating box\",\"error\":\"Max amount of boxes reached\"}",
		"statusCode": 429,
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
	});
  });
});

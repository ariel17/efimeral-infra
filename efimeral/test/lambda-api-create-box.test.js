const { ECSClient, RunTaskCommand, ListTasksCommand } = require("@aws-sdk/client-ecs");
const { mockClient } = require("aws-sdk-client-mock");

const lambdaFunction = require("../lambdas/api/create-box");

const ecsMock = mockClient(ECSClient);
const validTags = ["alpine", "ubuntu"];

describe("Create box", () => {
  const ENV = process.env;
  
  beforeEach(() => {
	ecsMock.reset();
	process.env.DEFAULT_TAG = 'alpine';
	process.env.AVAILABLE_TAGS = JSON.stringify(validTags);
	process.env.TASK_DEFINITION_ARNS = JSON.stringify({
		alpine: 'fakeArn1',
		ubuntu: 'fakeArn2',
	});
  });

  afterEach(() => {
    process.env = ENV;
  });

  test("should create container successfully without body", async () => {
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
		"body": "{\"message\":\"Box created\",\"box_id\":\"fakeTaskId\",\"type\":\"alpine\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 201
	});
  });

  test("should create container successfully with body and valid tag", async () => {
    ecsMock.on(ListTasksCommand).resolves({
		taskArns: [],
	});
    ecsMock.on(RunTaskCommand).resolves({
		tasks: [{
			taskArn: 'fakeARN/fakeTaskId',
		}]
	});

	validTags.forEach(async tag => {
		const event = {
			body: JSON.stringify({ type: tag }),
		}
		const result = await lambdaFunction.handler(event, {callbackWaitsForEmptyEventLoop: false});
		expect(result).toStrictEqual({
			"body": `{\"message\":\"Box created\",\"box_id\":\"fakeTaskId\",\"type\":\"${tag}\"}`, 
			"headers": {
			  "Access-Control-Allow-Headers": "Content-Type",
			  "Access-Control-Allow-Methods": "POST",
			},
			"statusCode": 201
		});
	});
  }); 

  test("should return 400 with body and invalid tag", async () => {
    ecsMock.on(ListTasksCommand).resolves({
		taskArns: [],
	});
	const event = {
		body: JSON.stringify({ type: 'invalid' }),
	}
	const result = await lambdaFunction.handler(event, {callbackWaitsForEmptyEventLoop: false});
	expect(result).toStrictEqual({
		"body": "{\"message\":\"Invalid request\",\"error\":\"Invalid type\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 400
	});
  }); 

  test("should return 400 with body and missing type field", async () => {
    ecsMock.on(ListTasksCommand).resolves({
		taskArns: [],
	});
	const event = {
		body: JSON.stringify({ foo: 'bar' }),
	}
	const result = await lambdaFunction.handler(event, {callbackWaitsForEmptyEventLoop: false});
	expect(result).toStrictEqual({
		"body": "{\"message\":\"Invalid request\",\"error\":\"Missing type\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 400
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

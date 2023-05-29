const { ECSClient, DescribeTasksCommand } = require("@aws-sdk/client-ecs");
const { EC2Client, DescribeNetworkInterfacesCommand } = require("@aws-sdk/client-ec2");
const { mockClient } = require("aws-sdk-client-mock");

const lambdaFunction = require("../lambdas/api/check-box-id");

const ecsMock = mockClient(ECSClient);
const ec2Mock = mockClient(EC2Client);

describe("Check box running state by ID", () => {
  const ENV = process.env;
  const event = {
    pathParameters: {
      box_id: 'fakeTaskId',
    },
  };
  
  afterEach(() => {
	ecsMock.reset();
	ec2Mock.reset();

  });

  afterAll(() => {
    process.env = ENV;
  });

  test("should return box public URL if it is running", async () => {
	ecsMock.on(DescribeTasksCommand).resolves({
		tasks: [{
			attachments: [{
				details: [{
					name: 'networkInterfaceId',
					value: 'fakeNetworkId',
				}]
			}],
			lastStatus: 'RUNNING',
			desiredStatus: 'RUNNING',
		}],
	});
	ec2Mock.on(DescribeNetworkInterfacesCommand).resolves({
		NetworkInterfaces: [{
			Association: {
				PublicDnsName: 'publicDNS',
			},
		}],
	});

    const result = await lambdaFunction.handler(event, {callbackWaitsForEmptyEventLoop: false});
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Box is ready\",\"url\":\"http://publicDNS:8080\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 200
	});
  });

  test("should fail if task is in another state", async () => {
	ecsMock.on(DescribeTasksCommand).resolves({
		tasks: [{
			lastStatus: 'PROVISIONING',
			desiredStatus: 'RUNNING',
		}],
	});

    const result = await lambdaFunction.handler(event, {callbackWaitsForEmptyEventLoop: false});
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Not found\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 404
	});
  });

  test("should fail if network ID is not found", async () => {
	ecsMock.on(DescribeTasksCommand).resolves({
		tasks: [{
			attachments: [{
				details: []
			}],
			lastStatus: 'RUNNING',
			desiredStatus: 'RUNNING',
		}],
	});

    const result = await lambdaFunction.handler(event, {callbackWaitsForEmptyEventLoop: false});
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Error creating box\",\"error\":\"Cannot obtain network interface ID\"}",
		"statusCode": 500
	});
  });
});

const { ECSClient, RunTaskCommand, DescribeTasksCommand } = require("@aws-sdk/client-ecs");
const { EC2Client, DescribeNetworkInterfacesCommand } = require("@aws-sdk/client-ec2");
const { mockClient } = require("aws-sdk-client-mock");

const lambdaFunction = require("../lambdas/api/api");

const ecsMock = mockClient(ECSClient);
const ec2Mock = mockClient(EC2Client);

describe("Create containers", () => {
  afterEach(() => {
	ecsMock.reset();
	ec2Mock.reset();
  });

  test("should create container successfully", async () => {
    ecsMock.on(RunTaskCommand).resolves({
		tasks: [{
			taskArn: 'fakeARN',
		}]});
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

    const result = await lambdaFunction.handler();
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Container created\",\"url\":\"http://publicDNS:8080\"}", 
		"headers": {
		  "Access-Control-Allow-Headers": "Content-Type",
		  "Access-Control-Allow-Methods": "POST",
		},
		"statusCode": 201
	});
  });

  test("should fail if network ID is not found", async () => {
    ecsMock.on(RunTaskCommand).resolves({
		tasks: [{
			taskArn: 'fakeARN',
		}]});
	ecsMock.on(DescribeTasksCommand).resolves({
		tasks: [{
			attachments: [{
				details: []
			}],
			lastStatus: 'RUNNING',
			desiredStatus: 'RUNNING',
		}],
	});

    const result = await lambdaFunction.handler();
    expect(result).toStrictEqual({
		"body": "{\"message\":\"Error creating container\",\"error\":\"Cannot obtain network interface ID\"}",
		"statusCode": 500
	});
  });
});

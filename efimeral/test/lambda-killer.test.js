const { ECSClient, ListTasksCommand, DescribeTasksCommand, StopTaskCommand } = require("@aws-sdk/client-ecs");
const { mockClient } = require("aws-sdk-client-mock");

const lambdaFunction = require("../lambdas/scheduled/killer");

const ecsMock = mockClient(ECSClient);

describe("Kill containers", () => {
  afterEach(() => {
	ecsMock.reset();
  });

  test("should stop 1 timeouted container successfully", async () => {
	ecsMock.on(ListTasksCommand).resolves({
		taskArns: ['fakeArn1', 'fakeArn2'],
	});
	ecsMock.on(DescribeTasksCommand).resolves({
		tasks: [{
			createdAt: new Date('2100-01-01'),
		},{
			createdAt: new Date('2021-01-01'),
		}],
	});
	ecsMock.on(StopTaskCommand).resolves({
		tasks: [{
			taskArn: 'fakeArn',
		}],
	});

    const result = await lambdaFunction.handler({}, {callbackWaitsForEmptyEventLoop: false});
    expect(result).toStrictEqual('1 tasks killed');
  });
});

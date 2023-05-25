# Efimeral CDK infrastructure

## About CDK

## Required environment variables

* CDK_DEFAULT_ACCOUNT: The AWS account ID to use
* CDK_DEFAULT_REGION: The AWS region to use
* WEB_HOSTED_ZONE_ID: The public hosted zone ID from `efimeral-web` project.

### Steps

```bash
# export AWS_DEFAULT_PROFILE=name

$ npm install
$ cdk bootstrap  # collects required data from AWS account
$ cdk deploy
$ cdk destroy
```

### Testing

```bash
$ npm run test
```

## About lambdas

### Testing with AWS simulator on Docker

```bash
# terminal 1
$ docker build -t ariel17/lambda .
$ docker run -p 8080:8080 ariel17/lambda

# terminal 2
$ curl -XPOST "http://localhost:8080/2015-03-31/functions/function/invocations" -d '{}'
```

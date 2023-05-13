# Efimeral CDK infrastructure

## About CDK

### Steps

```bash
# export AWS_DEFAULT_PROFILE=name

$ cdk bootstrap  # collects required data from AWS account
$ cdk deploy
```

### Warnings

* Public ECR repositories are only available on `us-east-1`.

## About lambdas

### Testing with AWS simulator on Docker

```bash
# terminal 1
$ docker build -t ariel17/lambda .
$ docker run -p 8080:8080 ariel17/lambda

# terminal 2
$ curl -XPOST "http://localhost:8080/2015-03-31/functions/function/invocations" -d '{}'
```
FROM public.ecr.aws/lambda/nodejs:16
COPY ./resources/lambda-handler.js package*.json ./

ENV TASK_DEFINITION_ARN taskDefinitionArn
ENV CLUSTER_ARN clusterArn
ENV SUBNET_ID subnetId
ENV SECURITY_GROUP_ID sgId

RUN npm install
CMD [ "lambda-handler.handler" ]

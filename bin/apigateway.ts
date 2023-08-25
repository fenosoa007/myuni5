#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IctUtils } from '@usyd/cdk-constructs';
import { EnvironmentVariables } from '../config';
import { ApiGatewayStack } from '../lib/apiGatewayStack';
import { ApiLambdaStack } from '../lib/apiLambdaStack';
import { ApiMulesoftLambdaStack } from '../lib/apiMulesoftLambdaStack';
import { OktaAuthorizerLambdaStack } from '../lib/oktaAuthorizerLambdaStack';
import { CloudFrontStack } from '../lib/cloudFrontStack';
import { PipelineStack } from '../lib/pipelineStack';
import { DynamoDBStack } from '../lib/dynamoDBStack';

const app = new cdk.App();
const account =
  app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const envVars = EnvironmentVariables(account);

const tagProps = {
  app: envVars.APP_ABBREVIATION,
  repoName: envVars.BITBUCKET_REPO,
};

const apiLambdaStack = new ApiLambdaStack(
  app,
  `${envVars.RESOURCE_PREFIX}ApiLambda`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}ApiLambda`,
    description: 'MyUni5 : Lambda resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
  },
);
IctUtils.addStandardTags(apiLambdaStack, tagProps, true);

const apiMulesoftLambdaStack = new ApiMulesoftLambdaStack(
  app,
  `${envVars.RESOURCE_PREFIX}ApiMulesoftLambda`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}ApiMulesoftLambda`,
    description: 'MyUni5 : Lambda Mulesoft resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
  },
);
IctUtils.addStandardTags(apiMulesoftLambdaStack, tagProps, true);

const dynamoDBStack = new DynamoDBStack(
  app,
  `${envVars.RESOURCE_PREFIX}DynamoDB`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}DynamoDB`,
    description: 'MyUni5 : DynamoDB resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
  },
);

IctUtils.addStandardTags(dynamoDBStack, tagProps, true);

const oktaAuthorizerLambdaStack = new OktaAuthorizerLambdaStack(
  app,
  `${envVars.RESOURCE_PREFIX}OktaAuthorizerLambda`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}OktaAuthorizerLambda`,
    description: 'MyUni5 : Okta Authorizer Lambda resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
  },
);
IctUtils.addStandardTags(oktaAuthorizerLambdaStack, tagProps, true);

const apiStack = new ApiGatewayStack(
  app,
  `${envVars.RESOURCE_PREFIX}ApiGateway`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}ApiGateway`,
    description: 'MyUni5 : ApiGateway resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
  },
);
IctUtils.addStandardTags(apiStack, tagProps, true);
apiStack.addDependency(apiLambdaStack);
apiStack.addDependency(apiMulesoftLambdaStack);
apiStack.addDependency(dynamoDBStack);
apiStack.addDependency(oktaAuthorizerLambdaStack);

const cloudfrontStack = new CloudFrontStack(
  app,
  `${envVars.RESOURCE_PREFIX}CloudFront`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}CloudFront`,
    description: 'MyUni5 : CloudFront resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
    apiGateway: apiStack.apiGateway.api,
  },
);
IctUtils.addStandardTags(cloudfrontStack, tagProps, true);
cloudfrontStack.addDependency(apiStack);

const pipelineStack = new PipelineStack(
  app,
  `${envVars.RESOURCE_PREFIX}StackPipeline`,
  {
    stackName: `${envVars.RESOURCE_PREFIX}StackPipeline`,
    description: 'MyUni5 : pipeline resources',
    env: {
      account: envVars.ACCOUNT,
      region: envVars.REGION,
    },
    envVars: envVars,
  },
);
IctUtils.addStandardTags(pipelineStack, tagProps, true);

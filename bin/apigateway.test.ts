// import { EnvironmentVariables } from '../config';
// import { Constants } from '@usyd/cdk-constructs'; <----- Cannot find this in pipeline

// const envVars = EnvironmentVariables(Constants.ACCOUNT.CODERS);

describe('CDK Stacks', () => {
  test('API Lambda Created', () => {
    // const app = new cdk.App();
    // const stack = new ApiLambdaStack(app, `${envVars.RESOURCE_PREFIX}Lambda`, {
    //   stackName: `${envVars.RESOURCE_PREFIX}Lambda`,
    //   description: 'MyUni5 : Lambda resources',
    //   env: {
    //     account: envVars.ACCOUNT,
    //     region: envVars.REGION,
    //   },
    //   envVars: envVars,
    // });
    // const template = Template.fromStack(stack);
    // template.hasResourceProperties('AWS::Lambda::Function', {
    //   FunctionName: `${envVars.RESOURCE_PREFIX}LDAPILambda`,
    // });
  });

  test('Api Gateway Created', () => {
    //   const app = new cdk.App();
    //   const stack = new ApiGatewayStack(
    //     app,
    //     `${envVars.RESOURCE_PREFIX}ApiGateway`,
    //     {
    //       stackName: `${envVars.RESOURCE_PREFIX}ApiGateway`,
    //       description: 'MyUni5 : ApiGateway resources',
    //       env: {
    //         account: envVars.ACCOUNT,
    //         region: envVars.REGION,
    //       },
    //       envVars: envVars,
    //     },
    //   );
    //   const template = Template.fromStack(stack);
    //   template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    //     Name: `${envVars.RESOURCE_PREFIX}AG`,
    //   });
  });
});

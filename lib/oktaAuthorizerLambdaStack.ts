import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

interface OktaAuthorizerLambdaStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
}

export class OktaAuthorizerLambdaStack extends cdk.Stack {
  public readonly oktaAuthorizerLambda: lambda.Function;
  constructor(
    scope: Construct,
    id: string,
    props: OktaAuthorizerLambdaStackProps,
  ) {
    super(scope, id, props);

    const oktaDomain = ssm.StringParameter.valueForStringParameter(
      this,
      props.envVars.PARAMETER_OKTA_DOMAIN,
    );

    const prefix = `${props.envVars.RESOURCE_PREFIX}LDOktaAuthorizer`;
    const lambdaDir = path.join(__dirname, '..', 'lambda');
    this.oktaAuthorizerLambda = new lambda_nodejs.NodejsFunction(
      this,
      'LambdaMyUni5OktaAuthorizer',
      {
        functionName: `${prefix}OktaAuthorizerLambda`,
        description:
          'Lambda function to handle okta authorization between API Gateway and MyUni5',
        environment: {
          OKTA_ISSUER: `${oktaDomain}/oauth2/default`,
        },
        entry: path.join(lambdaDir, 'MyUni5API', 'oktaAuthorizer.ts'),
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: 'handler',
        timeout: cdk.Duration.seconds(10),
      },
    );
    new ssm.StringParameter(this, 'ParamAuthorizerLambdaApiArn', {
      parameterName: props.envVars.PARAMETER_OKTA_AUTHORIZER_LAMBDA_API_ARN,
      stringValue: this.oktaAuthorizerLambda.functionArn,
      description: `Okta Authorizer Lambda ARN for ${prefix}`,
    });
  }
}

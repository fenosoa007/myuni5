import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
interface ApiLambdaStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
}

export class ApiLambdaStack extends cdk.Stack {
  public readonly apiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiLambdaStackProps) {
    super(scope, id, props);
    const prefix = `${props.envVars.RESOURCE_PREFIX}LD`;

    const lambdaDir = path.join(__dirname, '..', 'lambda');

    const oktaDomain = ssm.StringParameter.valueForStringParameter(
      this,
      props.envVars.PARAMETER_OKTA_DOMAIN,
    );

    this.apiLambda = new lambda_nodejs.NodejsFunction(this, 'LambdaMyUni5API', {
      functionName: `${prefix}APILambda`,
      description:
        'Lambda function to operate as a medium between API Gateway and MyUni5',
      environment: {
        CORS_ALLOWED_ORIGINS: props.envVars.CORS_ALLOWED_ORIGINS.join(','),
        RESOURCE_PREFIX: props.envVars.RESOURCE_PREFIX,
        BANNERS_API: props.envVars.BANNERS_API,
        OKTA_ISSUER: `${oktaDomain}/oauth2/default`,
        LEGACY_MYUNI_API: props.envVars.LEGACY_MYUNI_API,
      },
      entry: path.join(lambdaDir, 'MyUni5API', 'apiRoutes.ts'),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
    });
    this.apiLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: ['lambda:InvokeFunction', 'dynamodb:*'],
      }),
    );
    new ssm.StringParameter(this, 'ParamLambdaApiArn', {
      parameterName: props.envVars.PARAMETER_LAMBDA_API_ARN,
      stringValue: this.apiLambda.functionArn,
      description: `Lambda ARN for ${prefix}`,
    });
  }
}

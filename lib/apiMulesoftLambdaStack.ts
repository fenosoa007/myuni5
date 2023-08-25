import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Constants, IctUtils } from '@usyd/cdk-constructs';

interface ApiMulesoftLambdaStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
}

export class ApiMulesoftLambdaStack extends cdk.Stack {
  public readonly apiLambda: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: ApiMulesoftLambdaStackProps,
  ) {
    super(scope, id, props);
    const prefix = `${props.envVars.RESOURCE_PREFIX}LDM`;

    const lambdaDir = path.join(__dirname, '..', 'lambda');

    const oktaDomain = ssm.StringParameter.valueForStringParameter(
      this,
      props.envVars.PARAMETER_OKTA_DOMAIN,
    );

    const demoEnv = props.envVars.ACCOUNT === Constants.ACCOUNT.CODERS;

    const vpc = IctUtils.getVpc(this);
    this.apiLambda = new lambda_nodejs.NodejsFunction(
      this,
      'LambdaMulesoftMyUni5API',
      {
        functionName: `${prefix}APIMulesoftLambda`,
        description:
          'Lambda function to operate as a medium between API Gateway, MyUni5 and Mulesoft',
        environment: {
          CORS_ALLOWED_ORIGINS: props.envVars.CORS_ALLOWED_ORIGINS.join(','),
          RESOURCE_PREFIX: props.envVars.RESOURCE_PREFIX,
          OKTA_ISSUER: `${oktaDomain}/oauth2/default`,
          PARAMETER_SYDPAY_API_URL: props.envVars.PARAMETER_SYDPAY_API_URL,
          PARAMETER_SYDPAY_API_USERNAME:
            props.envVars.PARAMETER_SYDPAY_API_USERNAME,
          PARAMETER_SYDPAY_API_PASSWORD:
            props.envVars.PARAMETER_SYDPAY_API_PASSWORD,
          PARAMETER_OPAL_API_URL: props.envVars.PARAMETER_OPAL_API_URL,
          PARAMETER_OPAL_API_USERNAME:
            props.envVars.PARAMETER_OPAL_API_USERNAME,
          PARAMETER_OPAL_API_PASSWORD:
            props.envVars.PARAMETER_OPAL_API_PASSWORD,
          PARAMETER_STUDENT_API_URL: props.envVars.PARAMETER_STUDENT_API_URL,
          PARAMETER_STUDENT_API_USERNAME:
            props.envVars.PARAMETER_STUDENT_API_USERNAME,
          PARAMETER_STUDENT_API_PASSWORD:
            props.envVars.PARAMETER_STUDENT_API_PASSWORD,
          PARAMETER_MULESOFT_CERTIFICATE:
            props.envVars.PARAMETER_MULESOFT_CERTIFICATE,
          PARAMETER_MULESOFT_PRIVATE_KEY:
            props.envVars.PARAMETER_MULESOFT_PRIVATE_KEY,
          DEMO_ENV: demoEnv.toString(),
        },
        entry: path.join(lambdaDir, 'MyUni5API', 'apiMulesoftRoutes.ts'),
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: 'handler',
        timeout: cdk.Duration.seconds(60),
        bundling: {
          commandHooks: {
            beforeBundling(_inputDir: string, outputDir: string): string[] {
              const handlerDir = path.join(lambdaDir, 'MyUni5API');
              return [`cp -r ${handlerDir}/services/wsdl ${outputDir}`];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },
            beforeInstall(inputDir: string, outputDir: string): string[] {
              return [];
            },
          },
        },
        vpc: vpc,
        vpcSubnets: { subnets: vpc.privateSubnets },
      },
    );
    this.apiLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: [
          'lambda:InvokeFunction',
          'dynamodb:*',
          'ssm:GetParameter',
          'kms:Decrypt',
        ],
      }),
    );
    new ssm.StringParameter(this, 'ParamLambdaApiMulesoftArn', {
      parameterName: props.envVars.PARAMETER_LAMBDA_API_MULESOFT_ARN,
      stringValue: this.apiLambda.functionArn,
      description: `Lambda ARN for ${prefix}`,
    });
  }
}

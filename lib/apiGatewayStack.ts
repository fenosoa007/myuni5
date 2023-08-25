import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambdaConstruct from 'aws-cdk-lib/aws-lambda';
import { LambdaApiGateway } from '@usyd/cdk-constructs';
import {
  AuthorizationType,
  CfnMethod,
  HttpIntegration,
  LambdaIntegration,
  Method,
  MethodOptions,
  TokenAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';

interface ApiGatewayStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly apiGateway: LambdaApiGateway;

  getLambda = (prefix: string, lambdaArnSSMPath: string) => {
    const lambdaArn = ssm.StringParameter.valueForStringParameter(
      this,
      lambdaArnSSMPath,
    );
    const lambdaFunction = lambdaConstruct.Function.fromFunctionAttributes(
      this,
      `${prefix}Lambda`,
      {
        functionArn: lambdaArn,
        sameEnvironment: true,
      },
    );
    return lambdaFunction;
  };

  getAuthorizerMethodOptions = (prefix: string, lambdaArnSSMPath: string) => {
    const authorizerLambda = this.getLambda(prefix, lambdaArnSSMPath);
    authorizerLambda.addPermission('authorizer-function-permission', {
      principal: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });
    const tokenAuthorizer = new TokenAuthorizer(
      this,
      `${prefix}TokenAuthorizer`,
      {
        handler: authorizerLambda,
        resultsCacheTtl: cdk.Duration.seconds(0),
      },
    );
    const tokenAuthorizerMethodOptions = {
      authorizationType: AuthorizationType.CUSTOM,
      authorizer: tokenAuthorizer,
    };
    return tokenAuthorizerMethodOptions;
  };

  addRouteAuth = (
    apiGateway: LambdaApiGateway,
    path: string,
    httpMethod: string,
    lambda: lambdaConstruct.IFunction,
    methodOptions: MethodOptions,
  ) => {
    const method = apiGateway.api.root
      .resourceForPath(path)
      .addMethod(httpMethod, new LambdaIntegration(lambda), methodOptions);
  };

  addRouteNoAuth = (
    apiGateway: LambdaApiGateway,
    path: string,
    httpMethod: string,
    lambda?: lambdaConstruct.IFunction,
  ) => {
    let method: Method | undefined;
    if (lambda) {
      method = apiGateway.api.root
        .resourceForPath(path)
        .addMethod(httpMethod, new LambdaIntegration(lambda));
    } else {
      method = apiGateway.api.root.resourceForPath(path).addMethod(httpMethod);
    }

    if (method) {
      const apiGatewayMethod = method.node.defaultChild as CfnMethod;
      apiGatewayMethod.authorizationType = AuthorizationType.NONE;
      apiGatewayMethod.authorizerId = undefined;
    }
  };

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);
    const prefix = `${props.envVars.RESOURCE_PREFIX}AG`;
    // lambda for handling default routes
    const defaultApiLambda = this.getLambda(
      'Default',
      props.envVars.PARAMETER_LAMBDA_API_ARN,
    );
    // lambda for handling mulesoft routes
    const mulesoftApiLambda = this.getLambda(
      'Mulesoft',
      props.envVars.PARAMETER_LAMBDA_API_MULESOFT_ARN,
    );
    // lambda for handling okta authorizer
    const oktaAuthorizerMethodOptions = this.getAuthorizerMethodOptions(
      'Okta',
      props.envVars.PARAMETER_OKTA_AUTHORIZER_LAMBDA_API_ARN,
    );
    // API Gateway
    this.apiGateway = new LambdaApiGateway(this, 'ApiGateway', {
      prefix: prefix,
      lambda: defaultApiLambda,
      allowedOrigins: props.envVars.CORS_ALLOWED_ORIGINS,
      lambdaRestApiProps: {
        minCompressionSize: cdk.Size.bytes(0),
      },
    });

    // ROUTES
    this.addRouteAuth(
      this.apiGateway,
      '/api',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/banners/{ids}',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    // preferences
    this.addRouteAuth(
      this.apiGateway,
      '/api/preferences',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/preferences',
      'DELETE',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/preferences/item',
      'POST',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/preferences/item',
      'DELETE',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    // notifications
    this.addRouteAuth(
      this.apiGateway,
      '/api/notifications',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/notifications/ids/{ids}',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/notifications/{notificationId}',
      'DELETE',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/notifications/unread',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/notifications/read/{notificationIds}',
      'POST',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );

    // Campus map saved locations
    this.addRouteAuth(
      this.apiGateway,
      '/api/savedlocations',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/savedlocations/poi',
      'DELETE',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/savedlocations/poi',
      'POST',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );

    this.addRouteAuth(
      this.apiGateway,
      '/api/careers-centre/jobs/domestic',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/careers-centre/jobs/international',
      'GET',
      defaultApiLambda,
      oktaAuthorizerMethodOptions,
    );
    // Okta eligibility check
    this.addRouteAuth(
      this.apiGateway,
      '/api/student/opal',
      'GET',
      mulesoftApiLambda,
      oktaAuthorizerMethodOptions,
    );

    this.addRouteAuth(
      this.apiGateway,
      '/api/student/degrees',
      'GET',
      mulesoftApiLambda,
      oktaAuthorizerMethodOptions,
    );

    this.addRouteAuth(
      this.apiGateway,
      '/api/sydpay/{unikey}',
      'GET',
      mulesoftApiLambda,
      oktaAuthorizerMethodOptions,
    );
    // Leave commented out for now and let fallback proxy catch it.
    // TODO: commented out because SOAP isn't connecting.
    // this.addRouteAuth(
    //   this.apiGateway,
    //   '/api/student/credits',
    //   'GET',
    //   mulesoftApiLambda,
    //   oktaAuthorizerMethodOptions,
    // );

    this.addRouteAuth(
      this.apiGateway,
      '/api/student/info',
      'GET',
      mulesoftApiLambda,
      oktaAuthorizerMethodOptions,
    );

    const getLibcalEventsLambda = this.getLambda(
      'GetLibcalEvents',
      props.envVars.GET_LIBCAL_EVENTS_FUNCTION_ARN,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/library/public/events',
      'GET',
      getLibcalEventsLambda,
      oktaAuthorizerMethodOptions,
    );

    const getOrientationEventsLambda = this.getLambda(
      'GetOrientationEvents',
      props.envVars.GET_ORIENTATION_EVENTS_FUNCTION_ARN,
    );
    this.addRouteAuth(
      this.apiGateway,
      '/api/orientation-events/public/list',
      'GET',
      getOrientationEventsLambda,
      oktaAuthorizerMethodOptions,
    );

    // Fallback: catch all to legacy myuni api
    this.apiGateway.api.root.addProxy({
      defaultIntegration: new HttpIntegration(
        `${props.envVars.LEGACY_MYUNI_API}/{proxy}`,
        {
          httpMethod: 'ANY',
          options: {
            requestParameters: {
              'integration.request.path.proxy': 'method.request.path.proxy',
            },
          },
        },
      ),
      defaultMethodOptions: {
        requestParameters: {
          'method.request.path.proxy': true,
        },
      },
      anyMethod: true,
    });

    // save API Gateway to SSM param
    new ssm.StringParameter(this, 'ParamApiGatewayUrl', {
      parameterName: props.envVars.PARAMETER_API_GATEWAY_URL,
      stringValue: this.apiGateway.api.url,
      description: `API Gateway URL for ${prefix}`,
    });

    /* CloudFormation outputs for local development */
    new cdk.CfnOutput(this, 'APIGatewayEndpoint', {
      exportName: `${prefix}APIGatewayEndpoint`,
      description: 'Root URL of API Gateway.',
      value: this.apiGateway.api.url,
    });
  }
}

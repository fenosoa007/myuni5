import { Constants } from '@usyd/cdk-constructs';

export const vars: Record<string, any> = {
  REGION: Constants.REGION_SYDNEY,
  APP_ABBREVIATION: 'MUN5',
  // CodeBuild - infra
  BASE_REPO_NAME: 'node',
  BASE_REPO_TAG: 'latest',
  CODE_PATH_INFRA: 'infra',
  BUILD_TRIGGER_PATH_INFRA: '^infra/.*$',
  ORIGIN_PATH: '/',
  DEFAULT_ROOT_OBJECT: 'index.html',
  // CodeBuild - app
  CODE_PATH_APP: 'app',
  BUILD_TRIGGER_PATH_APP: '^app/.*$',
  // Bitbucket
  BITBUCKET_OWNER: 'sydneyuni',
  BITBUCKET_REPO: 'myuni5',
  // Environment Parameters
  PARAMETER_API_GATEWAY_URL: '/myuni5/apigateway/url',
  PARAMETER_LAMBDA_API_ARN: '/myuni5/lambda/api/arn',
  PARAMETER_LAMBDA_API_MULESOFT_ARN: '/myuni5/lambda/api-mulesoft/arn',
  PARAMETER_LAMBDA_OKTA_CALLBACK_ARN: '/myuni5/lambda/okta-callback/arn',
  PARAMETER_OKTA_AUTHORIZER_LAMBDA_API_ARN:
    '/myuni5/lambda/okta-authorizer/arn',
  PARAMETER_OKTA_DOMAIN: '/myuni5/okta/domain',
  PARAMETER_OKTA_CLIENT_ID: '/myuni5/okta/client_id',
  PARAMETER_OPAL_API_URL: '/myuni5/opal/url',
  PARAMETER_OPAL_API_USERNAME: '/myuni5/opal/username',
  PARAMETER_OPAL_API_PASSWORD: '/myuni5/opal/password',
  PARAMETER_SYDPAY_API_URL: '/myuni5/sydpay/url',
  PARAMETER_SYDPAY_API_USERNAME: '/myuni5/sydpay/username',
  PARAMETER_SYDPAY_API_PASSWORD: '/myuni5/sydpay/password',
  PARAMETER_STUDENT_API_URL: '/myuni5/student/url',
  PARAMETER_STUDENT_API_USERNAME: '/myuni5/student/username',
  PARAMETER_STUDENT_API_PASSWORD: '/myuni5/student/password',
  PARAMETER_MULESOFT_CERTIFICATE: '/myuni5/mulesoft/certificate',
  PARAMETER_MULESOFT_PRIVATE_KEY: '/myuni5/mulesoft/privatekey',
};

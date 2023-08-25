import { Constants } from '@usyd/cdk-constructs';
import { vars as commonVars } from './common';

const domainZone = 'sydney.edu.au';
const domainPrefix = 'myuni-beta';
const domainName = `${domainPrefix}.${domainZone}`;

export const vars: Record<string, any> = {
  ...commonVars,
  ACCOUNT: Constants.ACCOUNT.PROD,
  RESOURCE_PREFIX: `P${commonVars['APP_ABBREVIATION']}`,
  NODE_ENV: 'production',
  DOMAIN_ZONE_NAME: domainZone,
  DOMAIN_PREFIX: domainPrefix,
  DOMAIN_NAME: domainName,
  APPLICATION_URLS: [`https://${domainName.toLowerCase()}/`],
  CORS_ALLOWED_ORIGINS: [`https://${domainName.toLowerCase()}`],
  BITBUCKET_BRANCH: 'master',
  MYUNI_API: 'https://myuni-beta-api.sydney.edu.au',
  LEGACY_MYUNI_API: 'https://myuni.sydney.edu.au/v5',
  BANNERS_API: 'https://85s66xqjh1.execute-api.ap-southeast-2.amazonaws.com/T',
  ENROLMENT_SERVICE_ENDPOINT_WSDL:
    'https://api.sydney.edu.au/usyd-enrolment-soap-exp-api-v1-0/SITSEnrolmentDetailsService/EnrolmentDetailsServicePortTypeEndpoint',
  GET_LIBCAL_EVENTS_FUNCTION_ARN: '/liba/P/GetLibcalEventsFunctionARN',
  GET_ORIENTATION_EVENTS_FUNCTION_ARN:
    '/epai/P/GetOrientationEventsFunctionARN',
  CAMPUS_MAP_URL: 'https://maps.sydney.edu.au',
};

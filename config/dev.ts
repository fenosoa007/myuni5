import { Constants } from '@usyd/cdk-constructs';
import { vars as commonVars } from './common';

const domainZone = 'develop.sydney.edu.au';
const domainPrefix = 'myuni-beta';
const domainName = `${domainPrefix}.${domainZone}`;

export const vars: Record<string, any> = {
  ...commonVars,
  ACCOUNT: Constants.ACCOUNT.DEV,
  RESOURCE_PREFIX: `D${commonVars['APP_ABBREVIATION']}`,
  NODE_ENV: 'development',
  DOMAIN_ZONE_NAME: domainZone,
  DOMAIN_PREFIX: domainPrefix,
  DOMAIN_NAME: domainName,
  APPLICATION_URLS: [`https://${domainName.toLowerCase()}/`],
  CORS_ALLOWED_ORIGINS: [`https://${domainName.toLowerCase()}`],
  BITBUCKET_BRANCH: 'develop',
  MYUNI_API: 'https://myuni-beta-api.develop.sydney.edu.au',
  LEGACY_MYUNI_API: 'https://dev.myuni.sydney.edu.au/v5',
  BANNERS_API: 'https://jq5v95tjfh.execute-api.ap-southeast-2.amazonaws.com/D',
  ENROLMENT_SERVICE_ENDPOINT_WSDL:
    'https://uat.api.sydney.edu.au/usyd-enrolment-soap-exp-api-v1-0/SITSEnrolmentDetailsService/EnrolmentDetailsServicePortTypeEndpoint',
  GET_LIBCAL_EVENTS_FUNCTION_ARN: '/liba/D/GetLibcalEventsFunctionARN',
  GET_ORIENTATION_EVENTS_FUNCTION_ARN:
    '/epai/D/GetOrientationEventsFunctionARN',
  CAMPUS_MAP_URL: 'https://maps.sydney.edu.au',
};

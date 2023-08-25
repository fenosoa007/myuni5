import { Constants } from '@usyd/cdk-constructs';
import { vars as commonVars } from './common';

const domainZone = 'sandbox.sydney.edu.au';
const domainPrefix = 'myuni-beta';
const domainName = `${domainPrefix}.${domainZone}`;

export const vars: Record<string, any> = {
  ...commonVars,
  ACCOUNT: Constants.ACCOUNT.CODERS,
  RESOURCE_PREFIX: `C${commonVars['APP_ABBREVIATION']}`,
  NODE_ENV: 'development',
  DOMAIN_ZONE_NAME: domainZone,
  DOMAIN_PREFIX: domainPrefix,
  DOMAIN_NAME: domainName,
  APPLICATION_URLS: [
    `https://${domainName.toLowerCase()}/`,
    'http://localhost:3000/',
  ],
  CORS_ALLOWED_ORIGINS: [
    `https://${domainName.toLowerCase()}`,
    'http://localhost:3000',
  ],
  BITBUCKET_BRANCH: 'develop',
  MYUNI_API: 'https://jbykisd2i5.execute-api.ap-southeast-2.amazonaws.com/prod', // 'https://myuni-beta-api.sandbox.sydney.edu.au',
  LEGACY_MYUNI_API: 'https://coders.myuni.sydney.edu.au/v5',
  BANNERS_API: 'https://mj02f9hi1d.execute-api.ap-southeast-2.amazonaws.com/C',
  SYDPAY_API:"https://uat.api.sydney.edu.au/usyd-sydpay-sys-api-v1-0/api",
  ENROLMENT_SERVICE_ENDPOINT_WSDL:
    'https://uat.api.sydney.edu.au/usyd-enrolment-soap-exp-api-v1-0/SITSEnrolmentDetailsService/EnrolmentDetailsServicePortTypeEndpoint',
  GET_LIBCAL_EVENTS_FUNCTION_ARN: '/liba/C/GetLibcalEventsFunctionARN',
  GET_ORIENTATION_EVENTS_FUNCTION_ARN:
    '/epai/C/GetOrientationEventsFunctionARN',
  CAMPUS_MAP_URL: 'https://campusmap.sandbox.sydney.edu.au',
};

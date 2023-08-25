import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { getJWTClaims } from './utils/jwt';
import { MulesoftService } from './services/mulesoftService';
import { MulesoftStudentService } from './services/mulesoftStudentService';
import { SydpayService } from './services/sydpayService';

const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(
  ',',
);
const oktaIssuer = process.env.OKTA_ISSUER ?? '';
const demoEnv = process.env.DEMO_ENV == 'true' ? true : false;

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const corsAllowedOrigin =
    event.headers &&
    event.headers.origin &&
    CORS_ALLOWED_ORIGINS.includes(event.headers.origin)
      ? event.headers.origin
      : undefined;

  const mulesoftService = new MulesoftService();
  const mulesoftStudentService = new MulesoftStudentService();

  const sydpayService = new SydpayService();
  const corsHeaders = {
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Allow-Origin': corsAllowedOrigin,
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
  };
  const noCacheHeaders = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
  };

  let result: APIGatewayProxyResult | null = null;
  const _Result = (
    data: any,
    statusCode = 200,
    cacheSeconds = 0,
  ): APIGatewayProxyResult => {
    let headers = {};
    if (corsAllowedOrigin) {
      headers = { ...headers, ...corsHeaders };
    }
    if (cacheSeconds > 0) {
      const cacheHeaders = {
        'Cache-Control': `public, max-age=${cacheSeconds}`,
      };
      headers = { ...headers, ...cacheHeaders };
    } else {
      headers = { ...headers, ...noCacheHeaders };
    }
    const output = {
      body: JSON.stringify(data),
      headers: headers,
      statusCode: statusCode,
    };
    if (statusCode !== 200) {
      console.log(output);
    }
    return output;
  };

  let res: any = null;
  let claims;
  try {
    claims = await getJWTClaims(event.headers.Authorization ?? '', oktaIssuer);
  } catch {}

  switch (event.requestContext?.resourcePath) {
    case '/api/student/opal':
      if (!claims || !claims['custom:studentId']) {
        res = { data: 'Missing studentId' };
      } else {
        res = await mulesoftService.getOpalEligibility(
          claims['custom:studentId'],
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/student/degrees':
      if (!claims || !claims['custom:studentId']) {
        res = { data: 'Missing studentId' };
      } else {
        res = await mulesoftStudentService.getDegrees(
          claims['custom:studentId'],
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/student/credits':
      if (!claims || !claims['custom:studentId']) {
        res = { data: 'Missing studentId' };
      } else {
        res = await mulesoftStudentService.getCredits(
          claims['custom:studentId'],
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/student/info':
      if (!claims || !claims['custom:studentId']) {
        res = { data: 'Missing studentId' };
      } else {
        res = await mulesoftStudentService.getStudentInfo(
          claims['custom:studentId'],
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/sydpay/{unikey}':
      if (event.pathParameters && event.pathParameters['unikey']) {
        res = await sydpayService.getBalance(event.pathParameters['unikey']);
        result = _Result(res, 200, 3600); // cache for 1 hour
      } else {
        result = _Result('Missing parameters', 404);
      }
      break;
    default:
      result = _Result({ data: 'Unknown method' }, 404);
      break;
  }

  return result;
};

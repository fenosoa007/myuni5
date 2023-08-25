import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { getJWTUnikey, getJWTClaims } from './utils/jwt';
import bannerService from './services/bannerService';
import rssService from './services/rssService';
import { Preference } from './services/preferenceService';
import { Notification } from './services/notificationService';
import { SavedLocation } from './services/savedLocationService';
import { StudyDatesService } from './services/studyDatesService';

const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(
  ',',
);
const oktaIssuer = process.env.OKTA_ISSUER ?? '';

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const corsAllowedOrigin =
    event.headers &&
    event.headers.origin &&
    CORS_ALLOWED_ORIGINS.includes(event.headers.origin)
      ? event.headers.origin
      : undefined;

  const preference = new Preference();
  const notification = new Notification();
  const savedLocationsService = new SavedLocation();
  const studyDatesService = new StudyDatesService();

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

  let data: any;
  let body: any = null;
  let res: any = null;
  // var query = event.queryStringParameters || { ids: '', id: '' };
  const method = event.httpMethod;
  const params = event.pathParameters || { id: '' };
  let unikey = '';
  try {
    unikey = await getJWTUnikey(event.headers.Authorization ?? '', oktaIssuer);
  } catch {}

  switch (event.requestContext?.resourcePath) {
    case '/api':
      try {
        data = await getJWTClaims(
          event.headers.Authorization ?? '',
          oktaIssuer,
        );
        result = _Result(data);
      } catch (err) {
        result = _Result((err as Error).message, 500);
      }
      break;
    case '/api/banners/{ids}':
      if (event.pathParameters && event.pathParameters['ids']) {
        data = await bannerService.getBanners(
          event.pathParameters['ids'].split(','),
        );
        result = _Result(data, 200, 3600); // cache for 1 hour
      } else {
        result = _Result('Missing parameters', 404);
      }
      break;
    case '/api/preferences':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else if (method === 'GET') {
        res = await preference.readDoc(unikey);
      } else if (method === 'DELETE') {
        res = await preference.deleteDoc(unikey);
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/preferences/item':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else if (method === 'POST') {
        body = JSON.parse(event.body || '{}');
        res = await preference.upsertPreference(unikey, body);
      } else if (method === 'DELETE') {
        body = JSON.parse(event.body || '{}');
        if (body.PreferenceKey) {
          const preferenceKey = body.PreferenceKey;
          res = await preference.deletePreference(unikey, preferenceKey);
        } else {
          res = { data: 'Invalid Preference Key' };
        }
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/notifications':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else {
        res = await notification.getActiveNotificationsForUser(
          unikey,
          new Date(),
          event.headers.Authorization ?? '',
        );
      }
      result = _Result(res.data, res.success === true ? 200 : 500);
      break;
    case '/api/notifications/ids/{ids}':
      if (event.pathParameters && event.pathParameters['ids']) {
        res =
          await notification.getActiveNotificationsForUserWithNotificationIds(
            unikey,
            event.pathParameters['ids'].split(','),
            event.headers.Authorization ?? '',
          );
        result = _Result(res.data, res.success === true ? 200 : 500);
      } else {
        result = _Result('Missing parameters', 404);
      }
      break;
    case '/api/notifications/{notificationId}':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else {
        res = await notification.archiveNotificationForUser(
          unikey,
          params.notificationId ?? '-1',
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/notifications/unread':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else {
        res = await notification.hasUnreadNotificationsForUser(
          unikey,
          new Date(),
          event.headers.Authorization ?? '',
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/notifications/read/{notificationIds}':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else {
        res = await notification.updateNotificationsAsReadForUser(
          unikey,
          params.notificationIds ? params.notificationIds.split(',') : [],
        );
      }
      result = _Result(res.data, res.status);
      break;
    case '/api/calendar/weeks/{sessions}':
      if (params.sessions) {
        data = await studyDatesService.getStudyWeeks(
          params.sessions.split(','),
        );
        result = _Result(data, 200, 3600); // cache for 1 hour
      } else {
        result = _Result({ data: 'Missing parameters' }, 404);
      }
      break;
    case '/api/careers-centre/jobs/domestic':
      data = await rssService.getJobsDomestic();
      result = _Result(data);
      break;
    case '/api/careers-centre/jobs/international':
      data = await rssService.getJobsInternational();
      result = _Result(data);
      break;
    case '/api/savedlocations':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else {
        res = await savedLocationsService.getSavedLocations(unikey);
      }
      result = _Result(res.data, res.success === true ? 200 : 500);
      break;
    case '/api/savedlocations/poi':
      if (!unikey) {
        res = { data: 'Invalid Unikey' };
      } else if (method === 'POST') {
        body = JSON.parse(event.body || '{}');
        res = await savedLocationsService.addFavLocation(unikey, body);
      } else if (method === 'DELETE') {
        body = JSON.parse(event.body || '{}');
        if (body.locationKey) {
          const locationKey = body.locationKey;
          res = await savedLocationsService.deleteLocation(unikey, locationKey);
        } else {
          res = 'Invalid LocationKey Key';
        }
      }
      result = _Result(res.data, res.success === true ? 200 : 500);
      break;
    default:
      result = _Result({ data: 'Unknown method' }, 404);
      break;
  }

  return result;
};

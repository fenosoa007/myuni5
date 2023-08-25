import {
  APIGatewayTokenAuthorizerHandler,
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';
import { verifyAccessToken } from './utils/jwt';

const oktaIssuer = process.env.OKTA_ISSUER ?? '';

export const handler: APIGatewayTokenAuthorizerHandler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const accessToken = event.authorizationToken;
  let effect = 'Deny';
  try {
    await verifyAccessToken(accessToken, oktaIssuer);
    effect = 'Allow';
  } catch (err) {
    console.error(err);
  }
  const policy = {
    principalId: 'user',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: event.methodArn,
        },
      ],
    },
  };
  return policy;
};

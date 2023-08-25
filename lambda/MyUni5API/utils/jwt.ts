import OktaJwtVerifier from '@okta/jwt-verifier';

// reuse the following while lambda is hot
const verifiers: { [key: string]: OktaJwtVerifier } = {};

const expectedAudience = 'api://default';

type ClaimsProps = { [key: string]: any };

export const verifyAccessToken = async (
  accessToken: string,
  issuer: string,
) => {
  if (!verifiers[issuer]) {
    verifiers[issuer] = new OktaJwtVerifier({
      issuer,
      cacheMaxAge: 60 * 60 * 1000,
      jwksRequestsPerMinute: 10,
    });
  }
  const oktaJwtVerifier = verifiers[issuer];
  const match = accessToken.match(/Bearer (.+)/);
  if (!match) {
    throw new Error(
      'Incorrectly formatted access token or missing Bearer prefix.',
    );
  }
  const token = match[1];
  return await oktaJwtVerifier.verifyAccessToken(token, expectedAudience);
};

export const getJWTUnikey = async (accessToken: string, issuer: string) => {
  const jwt = await verifyAccessToken(accessToken, issuer);
  if (jwt.claims.sub && jwt.claims.sub.length > 0) {
    return jwt.claims.sub;
  }
  throw new Error('Access token invalid.');
};

const mapClaim = (
  outputClaims: ClaimsProps,
  sourceClaims: OktaJwtVerifier.JwtClaims,
  outputKey: string,
  sourceKey: string,
) => {
  if (sourceClaims[sourceKey]) {
    outputClaims[outputKey] = sourceClaims[sourceKey];
  }
};

export const getJWTClaims = async (
  accessToken: string,
  issuer: string,
): Promise<ClaimsProps> => {
  const jwt = await verifyAccessToken(accessToken, issuer);
  if (jwt.claims.sub && jwt.claims.sub.length > 0) {
    const outputClaims = {
      sub: jwt.claims.sub,
      unikey: jwt.claims.sub,
      username: jwt.claims.sub,
      exp: jwt.claims.exp,
      iss: jwt.claims.iss,
      'custom:api': 'myuni5',
    };
    mapClaim(outputClaims, jwt.claims, 'email', 'emailaddress');
    mapClaim(outputClaims, jwt.claims, 'given_name', 'givenname');
    mapClaim(outputClaims, jwt.claims, 'family_name', 'surname');
    mapClaim(outputClaims, jwt.claims, 'custom:studentId', 'studentId');
    mapClaim(outputClaims, jwt.claims, 'username', 'uid');
    mapClaim(
      outputClaims,
      jwt.claims,
      'custom:student_degree_level',
      'student_degree_level',
    );
    mapClaim(outputClaims, jwt.claims, 'custom:staff', 'staff');
    mapClaim(outputClaims, jwt.claims, 'custom:atsi', 'atsi');
    mapClaim(outputClaims, jwt.claims, 'custom:faculty', 'faculty');
    mapClaim(
      outputClaims,
      jwt.claims,
      'custom:student_fee_type',
      'student_fee_type',
    );
    mapClaim(
      outputClaims,
      jwt.claims,
      'custom:notifications_admins',
      'myuni-notifications-admins',
    );
    mapClaim(outputClaims, jwt.claims, 'custom:staff_department', 'staffDept');
    mapClaim(outputClaims, jwt.claims, 'custom:staff_faculty', 'staffFaculty');
    mapClaim(
      outputClaims,
      jwt.claims,
      'custom:staff_id',
      'http://schemas.microsoft.com/2012/01/devicecontext/claims/staffid',
    );
    mapClaim(
      outputClaims,
      jwt.claims,
      'custom:group',
      'http://schemas.xmlsoap.org/claims/Group',
    );
    mapClaim(
      outputClaims,
      jwt.claims,
      'custom:uidNumber',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/uidNumber',
    );
    return outputClaims;
  }
  throw new Error('Access token invalid.');
};

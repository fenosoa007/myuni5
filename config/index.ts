import { Constants } from '@usyd/cdk-constructs';
import { vars as coders } from './coders';
import { vars as dev } from './dev';
import { vars as test } from './test';
import { vars as prod } from './prod';

export const EnvironmentVariables = (
  account: Constants.ACCOUNT,
): Record<string, any> => {
  switch (account) {
    case Constants.ACCOUNT.CODERS:
      return coders;
    case Constants.ACCOUNT.DEV:
      return dev;
    case Constants.ACCOUNT.TEST:
      return test;
    case Constants.ACCOUNT.PROD:
      return prod;
    default:
      throw new Error(
        `Unknown environment - is CDK context variable '${Constants.CONTEXT_VARIABLE_ACCOUNT}' set?`,
      );
  }
};

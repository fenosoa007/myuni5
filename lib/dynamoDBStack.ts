import * as cdk from 'aws-cdk-lib';
import * as constructs from 'constructs';

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { DynamoDB } from '@usyd/cdk-constructs';

interface DynamoDBStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
}
export class DynamoDBStack extends cdk.Stack {
  constructor(
    scope: constructs.Construct,
    id: string,
    props: DynamoDBStackProps,
  ) {
    super(scope, id, props);
    const prefix = `${props.envVars.RESOURCE_PREFIX}DB`;

    // Preferences
    new DynamoDB(this, 'PreferencesMyUni5DB', {
      prefix: prefix,
      name: 'Preferences',
    });

    // Notifications
    const notificationsDB = new DynamoDB(this, 'NotificationsMyUni5DB', {
      prefix: prefix,
      name: 'Notifications',
    });
    notificationsDB.table.addGlobalSecondaryIndex({
      indexName: 'source-start_date-index',
      partitionKey: {
        name: 'source',
        type: dynamodb.AttributeType.NUMBER,
      },
      sortKey: {
        name: 'start_date',
        type: dynamodb.AttributeType.STRING,
      },
    });
    const notificationUsersDB = new DynamoDB(
      this,
      'NotificationUsersMyUni5DB',
      {
        prefix: prefix,
        name: 'NotificationUsers',
      },
    );
    notificationUsersDB.table.addGlobalSecondaryIndex({
      indexName: 'unikey-notificationId-index',
      partitionKey: {
        name: 'unikey',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'notificationId',
        type: dynamodb.AttributeType.STRING,
      },
    });
    new DynamoDB(this, 'NotificationCategoriesMyUni5DB', {
      prefix: prefix,
      name: 'NotificationCategories',
    });

    // Fav Locations
    new DynamoDB(this, 'FavLocationsMyUni5DB', {
      prefix: prefix,
      name: 'FavLocations',
    });
  }
}

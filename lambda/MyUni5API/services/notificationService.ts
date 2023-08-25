import * as AWS from 'aws-sdk';
const ddb = new AWS.DynamoDB.DocumentClient();
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const constDB = {
  NotificationsTableName: `${process.env.RESOURCE_PREFIX}DBNotifications`,
  NotificationUsersTableName: `${process.env.RESOURCE_PREFIX}DBNotificationUsers`,
  NotificationCategoriesTableName: `${process.env.RESOURCE_PREFIX}DBNotificationCategories`,
  NotificationsIndexSourceStartDate: 'source-start_date-index',
  NotificationUsersIndexUnikeyNotificationId: 'unikey-notificationId-index',
};

const legacyApi = process.env.LEGACY_MYUNI_API || '';

type LegacyNotificationProps = {
  id: number;
  category: string;
  title: string;
  body?: string;
  start_date: string;
};

type NotificationProps = {
  id: string;
  category: string;
  title: string;
  body?: string;
  start_date: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
  source: number;
  faculty?: string;
  staff_department?: string;
  read: boolean;
};

interface NotificationResponseProps extends NotificationProps {
  read: boolean;
}

type NotificationUserProps = {
  id: string;
  unikey: string;
  notificationId: string;
  read: string;
  archived: string;
};

type NotificationCategoryProps = {
  id: string;
  title: string;
};

type NotificationReadPutRequestProps = {
  PutRequest: {
    Item: {
      id: string;
      read: string;
      unikey?: string;
      notificationId?: string;
    };
  };
};

export class Notification {
  async getNotificationUserWithNotificationId(
    unikey: string,
    notificationId: string,
  ) {
    try {
      const params: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: constDB.NotificationUsersTableName,
        IndexName: constDB.NotificationUsersIndexUnikeyNotificationId,
        KeyConditionExpression:
          'unikey = :v_unikey and notificationId = :v_notificationId',
        ExpressionAttributeValues: {
          ':v_unikey': unikey,
          ':v_notificationId': notificationId,
        },
      };
      const result = await ddb.query(params).promise();
      if (result.Items && result.Items.length > 0) {
        const data = result.Items[0] as NotificationUserProps;
        return { data, success: true };
      } else {
        throw new Error('Record not found');
      }
    } catch (err) {
      return { message: (err as Error).message, success: false };
    }
  }

  async getNotificationUserWithNotificationIds(
    unikey: string,
    notificationIds: string[],
  ) {
    try {
      // Note: Unable to use filter expression notificationId IN because it either Primary or Sort Key
      const params: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: constDB.NotificationUsersTableName,
        IndexName: constDB.NotificationUsersIndexUnikeyNotificationId,
        KeyConditionExpression: 'unikey = :v_unikey',
        ExpressionAttributeValues: {
          ':v_unikey': unikey,
        },
      };
      const result = await ddb.query(params).promise();
      if (result.Items) {
        const notificationUsers = result.Items as NotificationUserProps[];
        return {
          data: notificationUsers.filter((n) =>
            notificationIds.includes(n.notificationId),
          ),
          success: true,
        };
      }
      return { data: [], success: true };
    } catch (err) {
      return { message: (err as Error).message, success: false };
    }
  }

  excludeArchivedNotifications(
    notifications: NotificationProps[],
    notificationUsers?: NotificationUserProps[],
  ) {
    const notificationIdsArchived = notificationUsers
      ? notificationUsers.filter((u) => u.archived).map((u) => u.notificationId)
      : [];
    return notifications.filter((n) => !notificationIdsArchived.includes(n.id));
  }

  mapReadNotifications(
    notifications: NotificationProps[],
    notificationUsers?: NotificationUserProps[],
  ) {
    const notificationIdsRead = notificationUsers
      ? notificationUsers.filter((u) => u.read).map((u) => u.notificationId)
      : [];
    const notificationRecords: NotificationResponseProps[] = notifications.map(
      (n) => ({
        ...n,
        read: notificationIdsRead.includes(n.id),
      }),
    );
    return notificationRecords;
  }

  async getActiveNotificationsForUserAndSource(
    unikey: string,
    activeDate: Date,
    source: number,
  ) {
    try {
      const activeDateISO = activeDate.toISOString();
      const params: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: constDB.NotificationsTableName,
        IndexName: constDB.NotificationsIndexSourceStartDate,
        KeyConditionExpression:
          '#col_source = :v_source and start_date <= :v_start_date',
        FilterExpression: 'end_date >= :v_end_date',
        ExpressionAttributeValues: {
          ':v_source': source,
          ':v_start_date': activeDateISO,
          ':v_end_date': activeDateISO,
        },
        ExpressionAttributeNames: {
          '#col_source': 'source',
        },
        ScanIndexForward: false, // DESC order
      };
      const result = await ddb.query(params).promise();
      if (result.Items) {
        const notifications = result.Items as NotificationProps[];
        const notificationIds = notifications.map((n) => n.id.toString());
        const notificationUsersResponse =
          await this.getNotificationUserWithNotificationIds(
            unikey,
            notificationIds,
          );
        const notificationsVisible = this.excludeArchivedNotifications(
          notifications,
          notificationUsersResponse.data,
        );
        const notificationRecords = this.mapReadNotifications(
          notificationsVisible,
          notificationUsersResponse.data,
        );
        // TODO: filter also if found by persona, faculty, staff_dept
        return { data: notificationRecords, success: true };
      }
      return { data: [], success: true };
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async getActiveNotificationsForUserAndLegacy(
    unikey: string,
    accessToken: string,
  ) {
    try {
      const res = await axios.get<LegacyNotificationProps[]>(
        `${legacyApi}/api/notifications`,
        {
          headers: {
            Authorization: accessToken,
          },
        },
      );
      if (res.status === 200) {
        const legacyNotifications = res.data ?? [];
        const notifications: NotificationProps[] = legacyNotifications.map(
          (n) => ({
            id: n.id.toString(),
            category: n.category,
            title: n.title,
            body: n.body,
            start_date: n.start_date,
            source: 2,
            read: false,
          }),
        );
        const notificationIds = notifications.map((n) => n.id.toString());
        const notificationUsersResponse =
          await this.getNotificationUserWithNotificationIds(
            unikey,
            notificationIds,
          );
        const notificationsVisible = this.excludeArchivedNotifications(
          notifications,
          notificationUsersResponse.data,
        );
        const notificationRecords = this.mapReadNotifications(
          notificationsVisible,
          notificationUsersResponse.data,
        );
        return { data: notificationRecords, success: true };
      }
      return { data: [], success: true };
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async getActiveNotificationsForUser(
    unikey: string,
    activeDate: Date,
    accessToken: string,
  ): Promise<{
    data?: NotificationResponseProps[];
    success: boolean;
    message?: string;
  }> {
    try {
      const sourceManualPromise = this.getActiveNotificationsForUserAndSource(
        unikey,
        activeDate,
        0,
      );
      const sourceAEMPromise = this.getActiveNotificationsForUserAndSource(
        unikey,
        activeDate,
        1,
      );
      const sourceLegacyPromise = this.getActiveNotificationsForUserAndLegacy(
        unikey,
        accessToken,
      );
      const result = await Promise.all([
        sourceManualPromise,
        sourceAEMPromise,
        sourceLegacyPromise,
      ]);
      let data: NotificationResponseProps[] = [];
      result.forEach((r) => {
        if (r.success) {
          data = [...data, ...(r.data ?? [])];
        } else {
          // short circuit loop and return error response
          throw new Error(r.message);
        }
      });
      return { data, success: true };
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async getActiveNotificationsForUserWithNotificationIds(
    unikey: string,
    notificationIds: string[],
    accessToken: string,
  ): Promise<{
    data?: NotificationResponseProps[];
    success: boolean;
    message?: string;
  }> {
    try {
      let filterExpression = 'id in (';
      const expressionAttributeValues: any = {};
      for (let i = 0; i < notificationIds.length; i++) {
        const idName = ':id' + (i + 1);
        if (i === 0) {
          filterExpression = filterExpression + idName;
        } else {
          filterExpression = filterExpression + ', ' + idName;
        }
        expressionAttributeValues[idName] = notificationIds[i];
      }
      filterExpression = filterExpression + ')';

      const params: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: constDB.NotificationsTableName,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      };
      const result = await ddb.scan(params).promise();
      if (result.Items) {
        let legacyNotifications: NotificationProps[] = [];
        const resLegacyNotifications =
          await this.getActiveNotificationsForUserAndLegacy(
            unikey,
            accessToken,
          );
        if (resLegacyNotifications.success && resLegacyNotifications.data) {
          legacyNotifications = resLegacyNotifications.data.filter((n) =>
            notificationIds.includes(n.id),
          );
        }
        const notifications: NotificationProps[] = [
          ...(result.Items as NotificationProps[]),
          ...legacyNotifications,
        ];
        const ids = notifications.map((n) => n.id.toString());
        const notificationUsersResponse =
          await this.getNotificationUserWithNotificationIds(unikey, ids);
        const notificationRecords = this.mapReadNotifications(
          notifications,
          notificationUsersResponse.data,
        );
        // TODO: filter also if found by persona, faculty, staff_dept
        return { data: notificationRecords, success: true };
      }
      return { data: [], success: true };
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async archiveNotificationForUser(unikey: string, notificationId: string) {
    try {
      const notificationUserResponse =
        await this.getNotificationUserWithNotificationId(
          unikey,
          notificationId,
        );
      if (notificationUserResponse.success && notificationUserResponse.data) {
        const notificationUser = notificationUserResponse.data;
        const params = {
          TableName: constDB.NotificationUsersTableName,
          Key: {
            id: notificationUser.id,
          },
          UpdateExpression: 'set archived = :v_archived',
          ExpressionAttributeValues: {
            ':v_archived': new Date().toISOString(),
          },
        };
        const result = await ddb.update(params).promise();
        return { data: result, success: true };
      } else {
        const params = {
          TableName: constDB.NotificationUsersTableName,
          Item: {
            id: uuidv4(),
            unikey,
            notificationId,
            archived: new Date().toISOString(),
          },
        };
        const result = await ddb.put(params).promise();
        return { data: result, success: true };
      }
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async hasUnreadNotificationsForUser(
    unikey: string,
    activeDate: Date,
    accessToken: string,
  ) {
    try {
      const activeNotificationsResponse =
        await this.getActiveNotificationsForUser(
          unikey,
          activeDate,
          accessToken,
        );
      const hasUnread =
        activeNotificationsResponse.success &&
        activeNotificationsResponse.data &&
        activeNotificationsResponse.data.length > 0;
      return {
        data: hasUnread,
        success: true,
      };
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async updateNotificationsAsReadForUser(
    unikey: string,
    notificationIds: string[],
  ) {
    try {
      const notificationUsersResponse =
        await this.getNotificationUserWithNotificationIds(
          unikey,
          notificationIds,
        );
      const nowISO = new Date().toISOString();
      const notificationUsers = notificationUsersResponse.data ?? [];
      const requests: NotificationReadPutRequestProps[] = [];
      notificationIds.forEach((nId) => {
        const notificationUser = notificationUsers.find(
          (n) => n.notificationId === nId,
        );
        requests.push({
          PutRequest: {
            Item: {
              id: notificationUser ? notificationUser.id : uuidv4(),
              read: nowISO,
              unikey,
              notificationId: nId,
            },
          },
        });
      });
      if (requests.length > 0) {
        const params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput = {
          RequestItems: {
            [constDB.NotificationUsersTableName]: requests,
          },
        };
        const result = await ddb.batchWrite(params).promise();
        return { data: result, success: true };
      }
      return { data: undefined, success: true };
    } catch (err) {
      return {
        data: undefined,
        message: (err as Error).message,
        success: false,
      };
    }
  }

  async getNotificationCategories() {
    try {
      const params: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: constDB.NotificationCategoriesTableName,
      };
      const result = await ddb.scan(params).promise();
      return {
        data: result.Items as NotificationCategoryProps[],
        success: true,
      };
    } catch (err) {
      return { message: (err as Error).message, success: false };
    }
  }
}

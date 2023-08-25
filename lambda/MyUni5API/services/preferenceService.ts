import * as AWS from 'aws-sdk';
const params = {
  TableName: `${process.env.RESOURCE_PREFIX}DBPreferences`,
};
const dynamoDb = new AWS.DynamoDB.DocumentClient();
interface PreferenceProps {
  PreferenceKey: string;
  PreferenceValue: string;
}

interface DocProps {
  createdAt?: string;
  updatedAt?: string;
  preferences?: any[];
}
export class Preference {
  async listDoc() {
    const callback = new Promise((resolve, reject) => {
      dynamoDb.scan(params, (err, result) => {
        if (err) {
          resolve({ message: err.message, success: false });
          return;
        }
        resolve({ data: result.Items, success: true });
      });
    });
    return callback;
  }
  async createDoc(id: string, body?: DocProps) {
    const callback = new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      if (!body) {
        body = {};
      }
      if (!body.createdAt) {
        body.createdAt = now;
      }
      if (!body.updatedAt) {
        body.updatedAt = now;
      }
      if (!body.preferences) {
        body.preferences = [];
      }
      dynamoDb.put(
        {
          ...params,
          Item: {
            id,
            ...body,
          },
          ReturnValues: 'ALL_OLD',
        },
        function (err, result) {
          if (err) {
            return resolve({ message: err.message, success: false });
          }
          resolve({ success: true, data: result.Attributes });
        },
      );
    });
    return callback;
  }

  async readDoc(id: string) {
    const callback = new Promise((resolve, reject) => {
      dynamoDb.get(
        {
          ...params,
          Key: {
            id,
          },
        },
        function (err, result) {
          if (err) {
            return resolve({ message: err.message, id, success: false });
          }
          if (result.Item) {
            resolve({ success: true, data: result.Item });
          } else {
            resolve({ success: false, data: null });
          }
        },
      );
    });
    return callback;
  }

  async updateDoc(id: string, body: DocProps) {
    const callback = new Promise((resolve, reject) => {
      const UpdateExpression = 'set preferences = :nd, updatedAt = :ua';
      const ExpressionAttributeValues = {
        ':nd': body.preferences,
        ':ua': new Date().toISOString(),
      };
      dynamoDb.update(
        {
          ...params,
          Key: {
            id,
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ReturnValues: 'UPDATED_NEW',
        },
        function (err, result) {
          if (err) {
            return resolve({
              message: err.message,
              id,
              body,
              success: false,
            });
          }
          resolve({ success: true, data: result.Attributes });
        },
      );
    });
    return callback;
  }
  async deleteDoc(id: string) {
    const callback = new Promise((resolve, reject) => {
      dynamoDb.delete(
        {
          ...params,
          Key: {
            id,
          },
        },
        function (err, result) {
          if (err) {
            return resolve({ message: err.message, id, success: false });
          }
          resolve({ success: true });
        },
      );
    });
    return callback;
  }

  async upsertPreference(id: string, body: PreferenceProps) {
    return this.readDoc(id).then((docResult: any) => {
      const callback = new Promise(async (resolve, reject) => {
        if (!docResult.success) {
          // create doc if it doesn't exist
          await this.createDoc(id);
          docResult = await this.readDoc(id);
          if (!docResult.success) {
            return resolve({
              success: false,
              message: 'No document record',
            });
          }
        }
        const items: any[] = docResult.data?.preferences;
        const pId = items.findIndex((i) =>
          Object.keys(i).includes(body.PreferenceKey),
        );
        if (pId > -1) {
          items[pId] = {
            [body.PreferenceKey]: body.PreferenceValue,
            createdAt: new Date().toISOString(),
          };
        } else {
          items.push({
            [body.PreferenceKey]: body.PreferenceValue,
            createdAt: new Date().toISOString(),
          });
        }
        const UpdateExpression = 'set preferences = :nd, updatedAt = :ua';
        const ExpressionAttributeValues = {
          ':nd': items,
          ':ua': new Date().toISOString(),
        };
        dynamoDb.update(
          {
            ...params,
            Key: {
              id,
            },
            UpdateExpression,
            ExpressionAttributeValues,
            ReturnValues: 'UPDATED_NEW',
          },
          function (err, result) {
            if (err) {
              return resolve({
                message: err.message,
                id,
                body,
                success: false,
              });
            }
            resolve({ success: true, data: result.Attributes });
          },
        );
      });
      return callback;
    });
  }

  async deletePreference(id: string, preferenceKey: string) {
    return this.readDoc(id).then((docResult: any) => {
      const callback = new Promise((resolve, reject) => {
        if (docResult.success) {
          const items: any[] = docResult.data?.preferences;
          const restItems = items.filter(
            (i) => !Object.keys(i).includes(preferenceKey),
          );
          const UpdateExpression = 'set preferences = :nd';
          const ExpressionAttributeValues = {
            ':nd': restItems,
          };
          dynamoDb.update(
            {
              ...params,
              Key: {
                id,
              },
              UpdateExpression,
              ExpressionAttributeValues,
              ReturnValues: 'UPDATED_NEW',
            },
            function (err, result) {
              if (err) {
                return resolve({
                  message: err.message,
                  id,
                  preferenceKey,
                  success: false,
                });
              }
              resolve({ success: true, data: result.Attributes });
            },
          );
        } else {
          resolve({ success: false, message: 'no document' });
        }
      });
      return callback;
    });
  }
}

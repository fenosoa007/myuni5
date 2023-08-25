import * as AWS from 'aws-sdk';
const params = {
  TableName: `${process.env.RESOURCE_PREFIX}DBFavLocations`,
};
const dynamoDb = new AWS.DynamoDB.DocumentClient();
interface SavedLocationProps {
  LocationKey: string;
  LocationValue: string;
}

interface DocProps {
  createdAt?: string;
  updatedAt?: string;
  locations?: any[];
}
export class SavedLocation {
  async listDoc() {
    const callback = new Promise((resolve, reject) => {
      dynamoDb.scan(params, (err, result) => {
        if (err) {
          console.error(err);
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
      if (!body.locations) {
        body.locations = [];
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
            console.error(err);
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
            console.error(err);
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
      const UpdateExpression = 'set locations = :nd, updatedAt = :ua';
      const ExpressionAttributeValues = {
        ':nd': body.locations,
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
            console.error(err);
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
            console.error(err);
            return resolve({ message: err.message, id, success: false });
          }
          resolve({ success: true });
        },
      );
    });
    return callback;
  }

  async addFavLocation(id: string, body: SavedLocationProps) {
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
        const items: any[] = docResult.data?.locations;
        const pId = items.findIndex((i) =>
          Object.keys(i).includes(body.LocationKey),
        );
        if (pId > -1) {
          items[pId] = {
            [body.LocationValue]: body.LocationValue,
            createdAt: new Date().toISOString(),
          };
        } else {
          items.push({
            [body.LocationValue]: body.LocationValue,
            createdAt: new Date().toISOString(),
          });
        }
        const UpdateExpression = 'set locations = :nd, updatedAt = :ua';
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
              console.error(err);
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

  async deleteLocation(id: string, locationKey: string) {
    return this.readDoc(id).then((docResult: any) => {
      const callback = new Promise((resolve, reject) => {
        if (docResult.success) {
          const items: any[] = docResult.data?.locations;
          const restItems = items.filter(
            (i) => !Object.keys(i).includes(locationKey),
          );
          const UpdateExpression = 'set locations = :nd';
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
                console.error(err);
                return resolve({
                  message: err.message,
                  id,
                  locationKey,
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

  async getSavedLocations(id: string) {
    const result: any = await this.readDoc(id);
    if (result && result.success) {
      return result;
    }
    return { success: true, data: null };
  }
}

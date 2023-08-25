import axios from 'axios';
import * as https from 'https';
import AWS from 'aws-sdk';

// reuse the following while lambda is hot
let ssm: AWS.SSM | undefined;
let sydpayUrl: string | undefined;
let sydpayUsername: string | undefined;
let sydpayPassword: string | undefined;
let mulesoftCertificate: string | undefined;
let mulesoftKey: string | undefined;

export class SydpayService {
  addParamPromise(tasks: any[], key?: string, decrypt?: boolean) {
    if (ssm) {
      tasks.push(
        ssm
          .getParameter({
            Name: key ?? '',
            WithDecryption: decrypt,
          })
          .promise(),
      );
    }
  }

  async hydrateParams() {
    if (!ssm) {
      try {
        ssm = new AWS.SSM();
        const tasks: any[] = [];
        this.addParamPromise(tasks, process.env.PARAMETER_SYDPAY_API_URL);
        this.addParamPromise(tasks, process.env.PARAMETER_SYDPAY_API_USERNAME);
        this.addParamPromise(
          tasks,
          process.env.PARAMETER_SYDPAY_API_PASSWORD,
          true,
        );
        this.addParamPromise(tasks, process.env.PARAMETER_MULESOFT_CERTIFICATE);
        this.addParamPromise(
          tasks,
          process.env.PARAMETER_MULESOFT_PRIVATE_KEY,
          true,
        );
        const result = await Promise.all(tasks);
        sydpayUrl = result[0].Parameter?.Value;
        sydpayUsername = result[1].Parameter?.Value;
        sydpayPassword = result[2].Parameter?.Value;
        mulesoftCertificate = result[3].Parameter?.Value;
        mulesoftKey = result[4].Parameter?.Value;
      } catch (err) {
        console.log('### Error getting SSM Params');
        console.log(err);
      }
    }
  }

  async getBalance(unikey: string): Promise<any> {
    await this.hydrateParams();
    const auth = {
      username: sydpayUsername || '',
      password: sydpayPassword || '',
    };
    const endpoint = `${sydpayUrl}balance/${unikey}?balance_name=sydpay`;
    const cert = mulesoftCertificate;
    const key = mulesoftKey;
    const options = {
      cert,
      key,
      rejectUnauthorized: false,
    };
    const httpsAgent = new https.Agent(options);
    console.log({ endpoint, auth });
    return axios.get(endpoint, { auth, httpsAgent }).catch((err) => {
      console.log(err);
    });
  }
}

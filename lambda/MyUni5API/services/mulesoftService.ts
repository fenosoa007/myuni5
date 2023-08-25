import axios from 'axios';
import * as https from 'https';
import AWS from 'aws-sdk';

// reuse the following while lambda is hot
let ssm: AWS.SSM | undefined;
let opalUrl: string | undefined;
let opalUsername: string | undefined;
let opalPassword: string | undefined;
let mulesoftCertificate: string | undefined;
let mulesoftKey: string | undefined;

export class MulesoftService {
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
        this.addParamPromise(tasks, process.env.PARAMETER_OPAL_API_URL);
        this.addParamPromise(tasks, process.env.PARAMETER_OPAL_API_USERNAME);
        this.addParamPromise(
          tasks,
          process.env.PARAMETER_OPAL_API_PASSWORD,
          true,
        );
        this.addParamPromise(tasks, process.env.PARAMETER_MULESOFT_CERTIFICATE);
        this.addParamPromise(
          tasks,
          process.env.PARAMETER_MULESOFT_PRIVATE_KEY,
          true,
        );
        const result = await Promise.all(tasks);
        opalUrl = result[0].Parameter?.Value;
        opalUsername = result[1].Parameter?.Value;
        opalPassword = result[2].Parameter?.Value;
        mulesoftCertificate = result[3].Parameter?.Value;
        mulesoftKey = result[4].Parameter?.Value;
      } catch (err) {
        console.log('### Error getting SSM Params');
        console.log(err);
      }
    }
  }

  async getOpalEligibility(studentId: string | number) {
    await this.hydrateParams();
    const endpoint = `${opalUrl}/v1/students/${studentId}/eligibility/opal`;
    const auth = {
      username: opalUsername || '',
      password: opalPassword || '',
    };

    const cert = mulesoftCertificate;
    const key = mulesoftKey;
    const options = {
      cert,
      key,
      rejectUnauthorized: false,
    };
    const httpsAgent = new https.Agent(options);
    return axios.get(endpoint, { auth, httpsAgent });
  }
}

import axios from 'axios';
import { xml2js } from 'xml-js';

const careerDomesticApi =
  'https://careerhub.sydney.edu.au/rss/job.aspx?max=90&days=14&labels=328&sso=true';
const careerInternationalApi =
  'https://careerhub.sydney.edu.au/rss/job.aspx?max=90&days=14&labels=327&sso=true';

type CareerRSS = {
  rss: {
    channel: {
      item: {
        guid: {
          _text: string;
        };
        link: {
          _text: string;
        };
        title: {
          _text: string;
        };
        description: {
          _text: string;
        };
        pubDate: {
          _text: string;
        };
        ClosingDate: {
          _text: string;
        };
      }[];
    };
  };
};

const getJobs = async (sourceUrl: string) => {
  const res = await axios.get<string>(sourceUrl);
  const items = xml2js(res.data, {
    compact: true,
    ignoreAttributes: true,
    ignoreDeclaration: true,
    ignoreDoctype: true,
  }) as CareerRSS;
  return items.rss.channel.item.map(
    ({ link, title, description, pubDate, ClosingDate }) => {
      return {
        link: link._text,
        title: title._text,
        description: description._text,
        publishedDate: pubDate._text,
        closingDate: ClosingDate._text,
      };
    },
  );
};

const getJobsDomestic = async () => {
  return getJobs(careerDomesticApi);
};

const getJobsInternational = async () => {
  return getJobs(careerInternationalApi);
};

export default {
  getJobsDomestic,
  getJobsInternational,
};

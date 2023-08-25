import axios from 'axios';

const bannersApi = process.env.BANNERS_API || '';

type Banner = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  link?: string;
  body?: string;
};

const getBanners = async (ids: string[]): Promise<Banner[]> => {
  const res = await axios.get<Banner[]>(`${bannersApi}/${ids.join(',')}`);
  return res.data;
};

export default {
  getBanners,
};

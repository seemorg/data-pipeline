import { env } from '@/env';
import Airtable from 'airtable';

export const airtable = new Airtable({
  apiKey: env.AIRTABLE_API_TOKEN,
}).base(env.AIRTABLE_APP_ID);

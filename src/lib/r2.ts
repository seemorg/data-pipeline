import { env } from '@/env';
import S3 from 'aws-sdk/clients/s3';

const s3 = new S3({
  endpoint: env.R2_ENDPOINT,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_KEY,
  signatureVersion: 'v4',
});

export const uploadToR2 = async (
  key: string,
  body: Buffer,
  options: {
    contentType?: string;
  } = {},
) => {
  await s3
    .putObject({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ...(options.contentType && { ContentType: options.contentType }),

      ACL: 'public-read',
    })
    .promise();
};

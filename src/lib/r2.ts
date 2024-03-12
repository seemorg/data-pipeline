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

export const listAllObjects = async (prefix: string) => {
  let lastItem: string | undefined = undefined;
  let hasMore = true;
  const allObjects: S3.ObjectList = [];

  while (hasMore) {
    // @ts-ignore
    const objects = await s3
      .listObjectsV2({
        Bucket: env.R2_BUCKET,
        Prefix: prefix,
        ...((lastItem ? { StartAfter: lastItem } : {}) as any),
      })
      .promise();

    allObjects.push(...(objects.Contents ?? []));

    if (objects.Contents?.length === 0) {
      hasMore = false;
    } else {
      lastItem = objects.Contents?.[objects.Contents.length - 1]?.Key;
    }
  }

  return allObjects;
};

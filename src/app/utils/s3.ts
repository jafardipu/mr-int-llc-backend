/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import config from '@app/config/index.js';
import AppError from '@app/error/AppError.js';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { s3Client } from '@app/constants/aws.js';
import httpStatus from 'http-status';

const saveLocalUpload = async ({
  file,
  fileName,
}: {
  file: any;
  fileName: string;
}) => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const relativePath = fileName.replace(/^\/+/, '');
  const dest = join(process.cwd(), 'public', relativePath);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, file.buffer);
  const base = (config.server_url || `http://127.0.0.1:${config.port || 5000}`).replace(
    /\/$/,
    '',
  );
  return `${base}/${relativePath}`;
};

export const uploadToS3 = async ({
  file,
  fileName,
}: {
  file: any;
  fileName: string;
}): Promise<string | null> => {
  if (!config.aws.bucket) {
    return saveLocalUpload({ file, fileName });
  }

  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  try {
    const key = await s3Client.send(command);
    if (!key) {
      throw new AppError(httpStatus.BAD_REQUEST, 'File Upload failed');
    }

    const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${fileName}`;

    return url;
  } catch {
    return saveLocalUpload({ file, fileName });
  }
};

export const deleteFromS3 = async (key: string) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.log('🚀 ~ deleteFromS3 ~ error:', error);
    throw new Error('s3 file delete failed');
  }
};

export const uploadManyToS3 = async (
  files: {
    file: any;
    path: string;
    key?: string;
  }[],
): Promise<{ url: string; key: string }[]> => {
  try {
    const uploadPromises = files.map(async ({ file, path, key }) => {
      const newFileName = key
        ? key
        : `${Math.floor(100000 + Math.random() * 900000)}${Date.now()}`;

      const fileKey = `${path}/${newFileName}`;
      const command = new PutObjectCommand({
        Bucket: config.aws.bucket as string,
        Key: fileKey,
        Body: file?.buffer,
      });

      await s3Client.send(command);

      const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${fileKey}`;
      return { url, key: newFileName };
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    return uploadedUrls;
  } catch (error) {
    throw new Error('File Upload failed');
  }
};

export const deleteManyFromS3 = async (keys: string[]) => {
  try {
    const deleteParams = {
      Bucket: config.aws.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false,
      },
    };

    const command = new DeleteObjectsCommand(deleteParams);

    const response = await s3Client.send(command);

    return response;
  } catch (error) {
    console.error('Error deleting S3 files:', error);
    throw new AppError(httpStatus.BAD_REQUEST, 'S3 file delete failed');
  }
};

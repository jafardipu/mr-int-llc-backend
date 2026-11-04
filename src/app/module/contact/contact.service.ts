/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { sendEmail } from '@app/utils/mailSender.js';
import {
  ContactMessageStatus,
  type Prisma,
} from '../../../../generated/prisma/index.js';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const createContact = async (payload: {
  name: string;
  email: string;
  subject?: string;
  message: string;
  userId?: string;
}) => {
  const data: Prisma.ContactMessageUncheckedCreateInput = {
    name: payload.name,
    email: payload.email,
    message: payload.message,
    status: ContactMessageStatus.pending,
  };
  if (payload.subject) data.subject = payload.subject;
  if (payload.userId) data.userId = payload.userId;

  const result = await prisma.contactMessage.create({ data });
  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create contact message');
  return result;
};

const getAllContact = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.ContactMessageWhereInput = {};

  if (searchTerm) {
    where.OR = ['name', 'email', 'subject', 'message', 'reply'].map(field => ({
      [field]: { contains: searchTerm },
    }));
  }
  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: { equals: value },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.ContactMessageOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.contactMessage.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  const total = await prisma.contactMessage.count({ where });
  return { data, meta: { page, limit, total } };
};

const getContactById = async (id: string) => {
  const result = await prisma.contactMessage.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!result)
    throw new AppError(httpStatus.NOT_FOUND, 'Support message not found');
  return result;
};

const replyContact = async (id: string, reply: string) => {
  const message = await getContactById(id);
  const trimmed = reply.trim();
  if (!trimmed)
    throw new AppError(httpStatus.BAD_REQUEST, 'Reply message is required');

  const result = await prisma.contactMessage.update({
    where: { id },
    data: {
      reply: trimmed,
      status: ContactMessageStatus.replied,
      repliedAt: new Date(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const subject = message.subject
    ? `Re: ${message.subject}`
    : 'Reply from MR International LLC Support';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e1b18;max-width:640px;margin:0 auto">
      <div style="background:#0b607e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;font-size:18px">MR International LLC Support</h2>
      </div>
      <div style="border:1px solid #d5e4ea;border-top:0;padding:20px;border-radius:0 0 12px 12px">
        <p>Hi ${message.name},</p>
        <p>Thanks for contacting us. Here is our reply:</p>
        <div style="background:#f3f8fb;border-radius:10px;padding:14px;margin:16px 0;white-space:pre-wrap">${escapeHtml(trimmed)}</div>
        <p style="color:#5f7580;font-size:13px;margin-top:24px">Your original message:</p>
        <blockquote style="margin:8px 0 0;padding:12px 14px;border-left:3px solid #0b607e;background:#faf8f5;white-space:pre-wrap">${escapeHtml(message.message)}</blockquote>
      </div>
    </div>
  `;

  try {
    await sendEmail(message.email, subject, html);
  } catch {
    // Reply is saved even if email delivery fails; admin can resend later if needed.
  }

  return result;
};

export const contactService = {
  createContact,
  getAllContact,
  getContactById,
  replyContact,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import type { Prisma } from '../../../../generated/prisma/index.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';

type FaqInput = { question?: string; answer?: string };

// Display order: position first, then oldest first for any ties.
const DISPLAY_ORDER: Prisma.FaqOrderByWithRelationInput[] = [
  { order: 'asc' },
  { createdAt: 'asc' },
];

// Position after the current last FAQ.
const nextOrder = async () => {
  const { _max } = await prisma.faq.aggregate({ _max: { order: true } });
  return (_max.order ?? 0) + 1;
};

const createFaq = async (payload: FaqInput) => {
  const result = await prisma.faq.create({
    data: {
      question: String(payload.question).trim(),
      answer: String(payload.answer).trim(),
      order: await nextOrder(),
    },
  });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create faq');
  return result;
};

const getAllFaq = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;

  const where: Prisma.FaqWhereInput = {};
  if (searchTerm) {
    where.OR = ['question', 'answer'].map(field => ({
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
  const orderBy: Prisma.FaqOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : DISPLAY_ORDER;

  const data = await prisma.faq.findMany({ where, skip, take: limit, orderBy });
  const total = await prisma.faq.count({ where });
  return { data, meta: { page, limit, total } };
};

const getFaqById = async (id: string) => {
  const result = await prisma.faq.findUnique({ where: { id } });
  if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Faq not found!');
  return result;
};

// Only question and answer can be edited here; position changes go through
// reorderFaqs so two FAQs never end up fighting over the same slot.
const updateFaq = async (id: string, payload: FaqInput) => {
  await getFaqById(id);
  const data: Prisma.FaqUpdateInput = {};
  if (payload.question !== undefined) data.question = payload.question.trim();
  if (payload.answer !== undefined) data.answer = payload.answer.trim();

  const result = await prisma.faq.update({ where: { id }, data });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Faq');
  return result;
};

// `ids` is every FAQ id in the new display order. Requiring the full list
// keeps positions unique and catches a list that is out of date.
const reorderFaqs = async (ids: string[]) => {
  if (new Set(ids).size !== ids.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Each FAQ can appear only once');
  }

  const existing = await prisma.faq.findMany({ select: { id: true } });
  const known = new Set(existing.map(faq => faq.id));
  const unknown = ids.filter(id => !known.has(id));
  if (unknown.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `FAQ not found: ${unknown.join(', ')}`,
    );
  }
  if (ids.length !== existing.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Send every FAQ id. The FAQ list changed, so reload it and try again',
    );
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.faq.update({ where: { id }, data: { order: index + 1 } }),
    ),
  );

  return prisma.faq.findMany({ orderBy: DISPLAY_ORDER });
};

const deleteFaq = async (id: string) => {
  const result = await prisma.faq.delete({ where: { id } });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete faq');
  return result;
};

// FAQs saved before `order` existed have no position, and Prisma cannot read
// a record that is missing a required field. Give them positions after the
// ordered ones, oldest first. Runs at startup; does nothing once all are set.
export const assignMissingFaqOrder = async () => {
  type RawFaq = { _id: { $oid: string }; order?: number };
  const rows = (await prisma.faq.findRaw({
    options: { projection: { _id: 1, order: 1 }, sort: { createdAt: 1, _id: 1 } },
  })) as unknown as RawFaq[];

  const missing = rows.filter(row => typeof row.order !== 'number');
  if (missing.length === 0) return;

  const last = Math.max(
    0,
    ...rows.map(row => (typeof row.order === 'number' ? row.order : 0)),
  );
  await prisma.$transaction(
    missing.map((row, index) =>
      prisma.faq.updateMany({
        where: { id: row._id.$oid },
        data: { order: last + index + 1 },
      }),
    ),
  );
};

export const faqService = {
  createFaq,
  getAllFaq,
  getFaqById,
  updateFaq,
  reorderFaqs,
  deleteFaq,
};

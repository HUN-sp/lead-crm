const { PrismaClient } = require('@prisma/client');
const cache = require('../utils/cache');
const { validateTransition } = require('../utils/stateMachine');

const prisma = new PrismaClient();

// Cache keys are prefixed so we can namespace them easily
const cacheKey = (id) => `lead:${id}`;

// ─── Single Lead Operations ────────────────────────────────────────────────

async function create(data) {
  return prisma.lead.create({ data });
}

/**
 * List leads with optional filters and pagination.
 * Supported filters: status, source
 * Pagination: page (1-based), limit
 */
async function list({ status, source, page = 1, limit = 20 } = {}) {
  const where = {};
  if (status) where.status = status;
  if (source) where.source = source;

  const skip = (page - 1) * limit;

  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    data: leads,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getById(id) {
  const key = cacheKey(id);

  // Try cache first
  const cached = await cache.get(key);
  if (cached) return cached;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (lead) await cache.set(key, lead); // Store in cache for next time
  return lead;
}

async function update(id, data) {
  const lead = await prisma.lead.update({ where: { id }, data });
  await cache.del(cacheKey(id)); // Invalidate cache on update
  return lead;
}

async function remove(id) {
  const lead = await prisma.lead.delete({ where: { id } });
  await cache.del(cacheKey(id)); // Invalidate cache on delete
  return lead;
}

/**
 * Transition a lead's status. Enforces state machine rules.
 * Throws an Error with a descriptive message on invalid transition.
 */
async function updateStatus(id, newStatus) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return null;

  const result = validateTransition(lead.status, newStatus);
  if (!result.valid) throw new Error(result.message);

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: newStatus },
  });

  await cache.del(cacheKey(id)); // Invalidate cache on status change
  return updated;
}

// ─── Bulk Operations ───────────────────────────────────────────────────────

/**
 * Create multiple leads. Returns per-record success/failure results.
 * One failure does NOT stop the rest from being processed.
 */
async function bulkCreate(leads) {
  const results = [];

  for (let i = 0; i < leads.length; i++) {
    try {
      const { name, email, phone, source } = leads[i];
      const created = await create({
        name: name.trim(),
        email: email.trim(),
        phone: phone ?? null,
        source: source ?? null,
      });
      results.push({ index: i, success: true, lead: created });
    } catch (err) {
      const message =
        err.code === 'P2002'
          ? 'A lead with this email already exists'
          : err.message;
      results.push({ index: i, success: false, error: message });
    }
  }

  return results;
}

/**
 * Update multiple leads by ID. Returns per-record success/failure results.
 */
async function bulkUpdate(updates) {
  const results = [];

  for (let i = 0; i < updates.length; i++) {
    const { id, ...data } = updates[i];

    try {
      const lead = await update(id, data);
      results.push({ index: i, success: true, lead });
    } catch (err) {
      let message = err.message;
      if (err.code === 'P2025') message = 'Lead not found';
      if (err.code === 'P2002') message = 'A lead with this email already exists';
      results.push({ index: i, success: false, error: message });
    }
  }

  return results;
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  updateStatus,
  bulkCreate,
  bulkUpdate,
};

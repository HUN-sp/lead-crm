const leadService = require('../services/leadService');
const { validateLeadCreate, validateLeadUpdate } = require('../utils/validators');
const { ALL_STATUSES } = require('../utils/stateMachine');

// ─── Single Lead Endpoints ─────────────────────────────────────────────────

async function create(req, res, next) {
  try {
    const errors = validateLeadCreate(req.body);
    if (errors.length) return res.status(422).json({ errors });

    const { name, email, phone, source } = req.body;

    const lead = await leadService.create({
      name: name.trim(),
      email: email.trim(),
      phone: phone ?? null,
      source: source ?? null,
    });

    return res.status(201).json(lead);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A lead with this email already exists' });
    }
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { status, source, page, limit } = req.query;

    if (status && !ALL_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${ALL_STATUSES.join(', ')}`,
      });
    }

    const result = await leadService.list({
      status,
      source,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const lead = await leadService.getById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    return res.json(lead);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validateLeadUpdate(req.body);
    if (errors.length) return res.status(422).json({ errors });

    // Only pick fields we allow to be updated (exclude id, status, timestamps)
    const { name, email, phone, source } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (email !== undefined) data.email = email.trim();
    if (phone !== undefined) data.phone = phone;
    if (source !== undefined) data.source = source;

    const lead = await leadService.update(req.params.id, data);
    return res.json(lead);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Lead not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'A lead with this email already exists' });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await leadService.remove(req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Lead not found' });
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!ALL_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${ALL_STATUSES.join(', ')}`,
      });
    }

    const lead = await leadService.updateStatus(req.params.id, status);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    return res.json(lead);
  } catch (err) {
    // State machine violations come back as plain Errors from the service
    if (err.message.startsWith('Invalid status transition')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

// ─── Bulk Endpoints ────────────────────────────────────────────────────────

async function bulkCreate(req, res, next) {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array of leads' });
    }

    // Validate each item upfront; invalid ones are marked as failed immediately
    const toCreate = [];
    const earlyFails = [];

    req.body.forEach((item, index) => {
      const errors = validateLeadCreate(item);
      if (errors.length) {
        earlyFails.push({ index, success: false, error: errors.join(', ') });
      } else {
        toCreate.push({ item, index });
      }
    });

    // Run DB inserts for valid items
    const dbResults = await leadService.bulkCreate(toCreate.map((t) => t.item));

    // Map DB results back to original indices
    const mappedDbResults = dbResults.map((r, i) => ({
      ...r,
      index: toCreate[i].index,
    }));

    // Merge early validation failures with DB results, sorted by original index
    const allResults = [...earlyFails, ...mappedDbResults].sort(
      (a, b) => a.index - b.index
    );

    const successful = allResults.filter((r) => r.success).length;

    return res.status(207).json({
      total: allResults.length,
      successful,
      failed: allResults.length - successful,
      results: allResults,
    });
  } catch (err) {
    next(err);
  }
}

async function bulkUpdate(req, res, next) {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array of updates' });
    }

    const toUpdate = [];
    const earlyFails = [];

    req.body.forEach((item, index) => {
      if (!item.id) {
        earlyFails.push({ index, success: false, error: 'id is required' });
        return;
      }
      const { id, ...fields } = item;
      const errors = validateLeadUpdate(fields);
      if (errors.length) {
        earlyFails.push({ index, success: false, error: errors.join(', ') });
      } else {
        toUpdate.push({ item, index });
      }
    });

    const dbResults = await leadService.bulkUpdate(toUpdate.map((t) => t.item));

    const mappedDbResults = dbResults.map((r, i) => ({
      ...r,
      index: toUpdate[i].index,
    }));

    const allResults = [...earlyFails, ...mappedDbResults].sort(
      (a, b) => a.index - b.index
    );

    const successful = allResults.filter((r) => r.success).length;

    return res.status(207).json({
      total: allResults.length,
      successful,
      failed: allResults.length - successful,
      results: allResults,
    });
  } catch (err) {
    next(err);
  }
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

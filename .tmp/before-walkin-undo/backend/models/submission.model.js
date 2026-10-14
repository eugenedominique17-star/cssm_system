const { db } = require('../config/db');
const supabase = require('../config/supabase');

const SubmissionModel = {
  async create({ type, data, submitted_by }) {
    const submission = await db.pending_submissions.insert({
      type, data: typeof data === 'object' ? data : JSON.parse(data),
      submitted_by, status: 'pending'
    });
    return submission.id;
  },

  async getAll(status = 'pending') {
    const submissions = await db.pending_submissions.find({ status });
    const sortedSubmissions = submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return Promise.all(sortedSubmissions.map(async s => {
      // submitted_by may be a staff (product/promo submission) or a client (walk-in request)
      const staff = await db.staff.findById(s.submitted_by);
      const user = staff || await db.clients.findById(s.submitted_by);
      return { ...s, submitted_by_name: user ? user.name : 'Unknown' };
    }));
  },

  async getById(id) {
    const submission = await db.pending_submissions.findById(id);
    if (!submission) return null;
    // submitted_by may be a staff or a client
    const staff = await db.staff.findById(submission.submitted_by);
    const user = staff || await db.clients.findById(submission.submitted_by);
    return { ...submission, submitted_by_name: user ? user.name : 'Unknown' };
  },

  async getByUserId(userId) {
    const submissions = await db.pending_submissions.find({ submitted_by: userId });
    return submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getClientWalkInRequests(userId) {
    const submissions = await db.pending_submissions.find({
      submitted_by: userId,
      type: 'walk_in_order',
    });

    return submissions
      .filter((submission) => ['pending', 'cancelled'].includes(submission.status))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getByType(type, status = 'pending') {
    const submissions = await db.pending_submissions.find({ type, status });
    const sortedSubmissions = submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.all(sortedSubmissions.map(async (submission) => {
      const staff = await db.staff.findById(submission.submitted_by);
      const client = staff || await db.clients.findById(submission.submitted_by);
      return {
        ...submission,
        submitted_by_name: client ? client.name : 'Unknown',
      };
    }));
  },

  async updateStatus(id, status, admin_notes = null) {
    const updates = { status, reviewed_at: new Date().toISOString() };
    if (admin_notes) updates.admin_notes = admin_notes;
    return await db.pending_submissions.update(id, updates);
  },

  async cancelPendingWalkIn(id, admin_notes) {
    const { data, error } = await supabase.from('pending_submissions')
      .update({ status: 'cancelled', reviewed_at: new Date().toISOString(), admin_notes })
      .eq('id', id).eq('type', 'walk_in_order').eq('status', 'pending')
      .select('id').maybeSingle();
    if (error) throw error;
    return data;
  },

  async getPendingCount() {
    const submissions = await db.pending_submissions.find({ status: 'pending' });
    return submissions.filter(submission => submission.type !== 'walk_in_order').length;
  }
};

module.exports = SubmissionModel;

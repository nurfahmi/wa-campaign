const CampaignService = require('../services/CampaignService');
const UserService = require('../services/UserService');
const Campaign = require('../models/Campaign');
const Job = require('../models/Job');
const CreditLog = require('../models/CreditLog');
const WhatsappSession = require('../models/WhatsappSession');
const WebhookLog = require('../models/WebhookLog');
const SystemSetting = require('../models/SystemSetting');
const User = require('../models/User');
const MessageTemplate = require('../models/MessageTemplate');
const TargetList = require('../models/TargetList');

class AdminController {
  // Dashboard
  async dashboard(req, res, next) {
    try {
      const campaignStats = await Campaign.getStats();
      const jobStats = await Job.getStats();
      const userCount = await User.count();
      res.render('admin/dashboard', {
        title: 'Dashboard',
        user: req.user,
        campaignStats,
        jobStats,
        userCount,
        activePage: 'dashboard',
      });
    } catch (err) { next(err); }
  }

  // ==================== MESSAGE TEMPLATES ====================
  async templateList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const data = await MessageTemplate.getAllPaginated(page, 20);
      res.render('admin/templates', { title: 'Message Templates', user: req.user, ...data, activePage: 'templates' });
    } catch (err) { next(err); }
  }

  async templateCreate(req, res, next) {
    try {
      res.render('admin/template-form', { title: 'New Template', user: req.user, template: null, activePage: 'templates' });
    } catch (err) { next(err); }
  }

  async templateStore(req, res, next) {
    try {
      const data = req.body;
      data.created_by = req.user.id;
      if (data.button_json && typeof data.button_json === 'string') {
        try { data.button_json = JSON.parse(data.button_json); } catch (e) { data.button_json = null; }
      }
      await MessageTemplate.create(data);
      req.flash('success', 'Template created');
      res.redirect('/admin/templates');
    } catch (err) { next(err); }
  }

  async templateEdit(req, res, next) {
    try {
      const template = await MessageTemplate.findById(req.params.id);
      if (!template) { req.flash('error', 'Template not found'); return res.redirect('/admin/templates'); }
      res.render('admin/template-form', { title: 'Edit Template', user: req.user, template, activePage: 'templates' });
    } catch (err) { next(err); }
  }

  async templateUpdate(req, res, next) {
    try {
      const data = req.body;
      if (data.button_json && typeof data.button_json === 'string') {
        try { data.button_json = JSON.parse(data.button_json); } catch (e) { data.button_json = null; }
      }
      await MessageTemplate.update(req.params.id, data);
      req.flash('success', 'Template updated');
      res.redirect('/admin/templates');
    } catch (err) { next(err); }
  }

  async templateDelete(req, res, next) {
    try {
      await MessageTemplate.delete(req.params.id);
      req.flash('success', 'Template deleted');
      res.redirect('/admin/templates');
    } catch (err) { next(err); }
  }

  // ==================== TARGET LISTS ====================
  async targetListPage(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const data = await TargetList.getAllPaginated(page, 20);
      res.render('admin/target-lists', { title: 'Target Lists', user: req.user, ...data, activePage: 'targets' });
    } catch (err) { next(err); }
  }

  async targetListCreate(req, res, next) {
    try {
      const data = req.body;
      data.created_by = req.user.id;
      const result = await TargetList.create(data);
      const listId = result.insertId || result;
      if (req.file) {
        await TargetList.uploadCSV(listId, req.file.buffer);
      }
      req.flash('success', 'Target list created');
      res.redirect('/admin/targets');
    } catch (err) { next(err); }
  }

  async targetListDetail(req, res, next) {
    try {
      const list = await TargetList.findById(req.params.id);
      if (!list) { req.flash('error', 'List not found'); return res.redirect('/admin/targets'); }
      const page = parseInt(req.query.page) || 1;
      const items = await TargetList.getItems(req.params.id, page, 50);
      res.render('admin/target-list-detail', { title: list.name, user: req.user, list, ...items, activePage: 'targets' });
    } catch (err) { next(err); }
  }

  async targetListUpload(req, res, next) {
    try {
      if (!req.file) {
        req.flash('error', 'Upload a CSV file');
        return res.redirect(`/admin/targets/${req.params.id}`);
      }
      const result = await TargetList.uploadCSV(req.params.id, req.file.buffer);
      req.flash('success', `Added ${result.inserted} numbers (${result.duplicates} duplicates skipped). Total: ${result.total}`);
      res.redirect(`/admin/targets/${req.params.id}`);
    } catch (err) { next(err); }
  }

  async targetListDelete(req, res, next) {
    try {
      await TargetList.deleteWithItems(req.params.id);
      req.flash('success', 'Target list deleted');
      res.redirect('/admin/targets');
    } catch (err) { next(err); }
  }

  // ==================== CAMPAIGNS ====================
  async campaignList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const status = req.query.status || null;
      const data = await CampaignService.list(page, 20, status);
      res.render('admin/campaigns', { title: 'Campaigns', user: req.user, ...data, activePage: 'campaigns' });
    } catch (err) { next(err); }
  }

  async campaignCreate(req, res, next) {
    try {
      const templates = await MessageTemplate.findAll();
      const targetLists = await TargetList.findAll();
      res.render('admin/campaign-form', { title: 'New Campaign', user: req.user, campaign: null, templates, targetLists, activePage: 'campaigns' });
    } catch (err) { next(err); }
  }

  async campaignStore(req, res, next) {
    try {
      await CampaignService.create(req.body, req.user.id);
      req.flash('success', 'Campaign created');
      res.redirect('/admin/campaigns');
    } catch (err) { next(err); }
  }

  async campaignDetail(req, res, next) {
    try {
      const campaign = await CampaignService.getById(req.params.id);
      const allTemplates = await MessageTemplate.findAll();
      const allTargetLists = await TargetList.findAll();
      res.render('admin/campaign-detail', { title: campaign.name, user: req.user, campaign, allTemplates, allTargetLists, activePage: 'campaigns' });
    } catch (err) { next(err); }
  }

  async campaignUpdate(req, res, next) {
    try {
      await CampaignService.update(req.params.id, req.body);
      req.flash('success', 'Campaign updated');
      res.redirect(`/admin/campaigns/${req.params.id}`);
    } catch (err) { next(err); }
  }

  // ==================== USERS ====================
  async userList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      const data = await UserService.listUsers(page, 20, search);
      res.render('admin/users', { title: 'Users', user: req.user, ...data, search, activePage: 'users' });
    } catch (err) { next(err); }
  }

  async userUpdate(req, res, next) {
    try {
      await UserService.updateUserAdmin(req.params.id, req.body);
      req.flash('success', 'User updated');
      res.redirect('/admin/users');
    } catch (err) { next(err); }
  }

  async userAdjustCredit(req, res, next) {
    try {
      const { amount, description } = req.body;
      await UserService.adjustCredit(req.params.id, parseFloat(amount), description);
      req.flash('success', 'Credit adjusted');
      res.redirect('/admin/users');
    } catch (err) { next(err); }
  }

  // Job Logs
  async jobLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.campaignId) filters.campaignId = req.query.campaignId;
      const data = await Job.getAllPaginated(page, 50, filters);
      res.render('admin/job-logs', { title: 'Job Logs', user: req.user, ...data, filters, activePage: 'jobs' });
    } catch (err) { next(err); }
  }

  // Credit Logs
  async creditLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const userId = req.query.userId || null;
      const data = await CreditLog.getAllPaginated(page, 50, userId);
      res.render('admin/credit-logs', { title: 'Credit Logs', user: req.user, ...data, activePage: 'credits' });
    } catch (err) { next(err); }
  }

  // WhatsApp Sessions
  async sessionsList(req, res, next) {
    try {
      const sessions = await WhatsappSession.findAll();
      res.render('admin/sessions', { title: 'WhatsApp Sessions', user: req.user, sessions, activePage: 'sessions' });
    } catch (err) { next(err); }
  }

  async sessionCreate(req, res, next) {
    try {
      await WhatsappSession.create({
        session_id: req.body.session_id,
        phone_number: req.body.phone_number || null,
        status: req.body.status || 'disconnected',
      });
      req.flash('success', 'Session added');
      res.redirect('/admin/sessions');
    } catch (err) { next(err); }
  }

  async sessionUpdate(req, res, next) {
    try {
      await WhatsappSession.update(req.params.id, {
        status: req.body.status,
        phone_number: req.body.phone_number,
      });
      req.flash('success', 'Session updated');
      res.redirect('/admin/sessions');
    } catch (err) { next(err); }
  }

  async sessionDelete(req, res, next) {
    try {
      await WhatsappSession.delete(req.params.id);
      req.flash('success', 'Session removed');
      res.redirect('/admin/sessions');
    } catch (err) { next(err); }
  }

  // Webhook Logs
  async webhookLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const data = await WebhookLog.getAllPaginated(page, 50);
      res.render('admin/webhook-logs', { title: 'Webhook Logs', user: req.user, ...data, activePage: 'webhooks' });
    } catch (err) { next(err); }
  }

  // System Settings
  async settingsPage(req, res, next) {
    try {
      const settings = await SystemSetting.getAll();
      res.render('admin/settings', { title: 'Settings', user: req.user, settings, activePage: 'settings' });
    } catch (err) { next(err); }
  }

  async settingsUpdate(req, res, next) {
    try {
      const entries = Object.entries(req.body);
      for (const [key, value] of entries) {
        await SystemSetting.set(key, value);
      }
      req.flash('success', 'Settings saved');
      res.redirect('/admin/settings');
    } catch (err) { next(err); }
  }
}

module.exports = new AdminController();
